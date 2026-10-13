from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.cart_resolver import CART_COOKIE_NAME
from apps.core.permissions import CanManageOrders, IsAdminOnly, IsAdminOrOrderManagerReadOnly, can_manage_orders
from apps.users.cookies import set_auth_cookies
from apps.users.tasks import send_account_created_email

from .filters import OrderFilter
from .models import Coupon, DeliveryChargeSettings, Order
from .serializers import (
    CheckoutSerializer,
    CouponSerializer,
    DeliveryChargeSettingsSerializer,
    ManualOrderQuoteSerializer,
    ManualOrderSerializer,
    OrderSerializer,
)
from .services import CheckoutError, change_order_status, checkout, create_manual_order, quote_manual_order
from .tasks import send_order_confirmation_email


class CheckoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        was_authenticated = request.user.is_authenticated
        try:
            order, created_account_password = checkout(request, serializer.validated_data)
        except CheckoutError as exc:
            return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)

        if created_account_password:
            send_account_created_email.delay(order.user_id, created_account_password)
        send_order_confirmation_email.delay(order.id)

        response = Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

        if not was_authenticated:
            if order.user_id:
                refresh = RefreshToken.for_user(order.user)
                set_auth_cookies(response, str(refresh.access_token), str(refresh))
            response.delete_cookie(CART_COOKIE_NAME, path="/")

        return response


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = OrderFilter
    search_fields = [
        "order_number",
        "guest_email",
        "user__email",
        "user__name",
        "shipping_address__name",
        "shipping_address__phone",
    ]

    STATUS_ACTIONS = ("confirm", "process", "cancel", "ship", "deliver")

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.select_related("user", "created_by", "shipping_address")
        if can_manage_orders(user):
            return queryset.order_by("-placed_at")
        return queryset.filter(user=user).order_by("-placed_at")

    def get_permissions(self):
        if self.action in self.STATUS_ACTIONS + ("manual", "quote"):
            return [CanManageOrders()]
        return super().get_permissions()

    def _set_status(self, new_status):
        try:
            order = change_order_status(self.get_object(), new_status)
        except CheckoutError as exc:
            return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._set_status(Order.Status.CONFIRMED)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        return self._set_status(Order.Status.PROCESSING)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._set_status(Order.Status.CANCELLED)

    @action(detail=True, methods=["post"])
    def ship(self, request, pk=None):
        return self._set_status(Order.Status.SHIPPED)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        return self._set_status(Order.Status.DELIVERED)

    @action(detail=False, methods=["post"])
    def manual(self, request):
        """CCE/admin "Add Order": create an order for a customer from the dashboard."""
        serializer = ManualOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order, created = create_manual_order(request, serializer.validated_data)
        except CheckoutError as exc:
            return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)

        if created:
            send_order_confirmation_email.delay(order.id)
        return Response(
            self.get_serializer(order).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def quote(self, request):
        """Server-calculated totals for a dashboard order before it's created."""
        serializer = ManualOrderQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(quote_manual_order(serializer.validated_data))
        except CheckoutError as exc:
            return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)


class CouponViewSet(viewsets.ModelViewSet):
    """Admins manage coupons; CCE users get the same data read-only."""

    serializer_class = CouponSerializer
    permission_classes = [IsAdminOrOrderManagerReadOnly]
    search_fields = ["code"]
    filterset_fields = ["type"]
    ordering_fields = ["code", "value", "starts_at", "ends_at"]

    def get_queryset(self):
        queryset = Coupon.objects.annotate(usage_count=Count("order_coupons")).order_by("-id")
        return self._filter_status(queryset, self.request.query_params.get("status"))

    @staticmethod
    def _filter_status(queryset, value):
        # Same rules as serializers.coupon_status, expressed as a query.
        now = timezone.now()
        scheduled = Q(starts_at__gt=now)
        expired = Q(ends_at__lt=now)
        exhausted = Q(usage_limit__isnull=False, usage_count__gte=F("usage_limit"))
        if value == "scheduled":
            return queryset.filter(scheduled)
        if value == "expired":
            return queryset.filter(expired).exclude(scheduled)
        if value == "exhausted":
            return queryset.filter(exhausted).exclude(scheduled | expired)
        if value == "active":
            return queryset.exclude(scheduled | expired | exhausted)
        return queryset


class DeliveryChargeView(APIView):
    """The configured delivery charges.

    GET is public — checkout (guests included) needs the current fees and zone
    rules to show the customer. Only administrators may change them.
    """

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsAdminOnly()]

    def get(self, request):
        return Response(DeliveryChargeSettingsSerializer(DeliveryChargeSettings.load()).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        charges = DeliveryChargeSettings.load()
        serializer = DeliveryChargeSettingsSerializer(charges, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)
