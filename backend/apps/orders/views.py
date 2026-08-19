from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.cart_resolver import CART_COOKIE_NAME
from apps.core.permissions import IsStaffOnly
from apps.users.cookies import set_auth_cookies
from apps.users.tasks import send_account_created_email

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
    filterset_fields = ["status", "payment_status"]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Order.objects.all().order_by("-placed_at")
        return Order.objects.filter(user=user).order_by("-placed_at")


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by("-id")
    serializer_class = CouponSerializer
    permission_classes = [IsStaffOnly]
