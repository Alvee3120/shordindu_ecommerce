from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.cart_resolver import CART_COOKIE_NAME
from apps.core.permissions import IsStaffOnly
from apps.users.cookies import set_auth_cookies
from apps.users.tasks import send_account_created_email

from .filters import OrderFilter
from .models import Coupon, Order
from .serializers import CheckoutSerializer, CouponSerializer, OrderSerializer
from .services import CheckoutError, checkout
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
    search_fields = ["order_number", "guest_email", "user__email", "user__name"]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Order.objects.all().order_by("-placed_at")
        return Order.objects.filter(user=user).order_by("-placed_at")

    def get_permissions(self):
        if self.action in ("confirm", "process", "cancel", "ship", "deliver"):
            return [IsStaffOnly()]
        return super().get_permissions()

    def _set_status(self, new_status):
        order = self.get_object()
        order.status = new_status
        order.save(update_fields=["status"])
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


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by("-id")
    serializer_class = CouponSerializer
    permission_classes = [IsStaffOnly]
