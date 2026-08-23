from django.conf import settings
from django.db.models import ProtectedError
from kombu.exceptions import OperationalError as BrokerOperationalError
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.cart_resolver import CART_COOKIE_NAME
from apps.cart.services import merge_guest_cart
from apps.core.permissions import IsStaffOnly

from .cookies import clear_auth_cookies, set_auth_cookies
from .models import Address, User
from .serializers import (
    AddressSerializer,
    AdminUserSerializer,
    ChangePasswordSerializer,
    SigninSerializer,
    SignupSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .tasks import send_welcome_email


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        try:
            send_welcome_email.delay(user.id)
        except (BrokerOperationalError, ConnectionError):
            pass
        merge_guest_cart(request, user)

        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        response.delete_cookie(CART_COOKIE_NAME, path="/")
        return response


class SigninView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SigninSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        merge_guest_cart(request, user)

        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        response.delete_cookie(CART_COOKIE_NAME, path="/")
        return response


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_205_RESET_CONTENT)
        clear_auth_cookies(response)
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw_refresh:
            return Response({"detail": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response({"detail": "Refresh token invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)

        access = serializer.validated_data["access"]
        new_refresh = serializer.validated_data.get("refresh", raw_refresh)

        response = Response(status=status.HTTP_200_OK)
        set_auth_cookies(response, access, new_refresh)
        return response


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.force_password_change = False
        user.save(update_fields=["password", "force_password_change"])
        return Response(status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(instance).data)


class UserManagementViewSet(viewsets.ModelViewSet):
    """Admin-only user management: list/search accounts, change role or
    active status. No create endpoint here — accounts are made via signup."""

    queryset = User.objects.all().order_by("-created_at")
    serializer_class = AdminUserSerializer
    permission_classes = [IsStaffOnly]
    http_method_names = ["get", "patch", "delete", "head", "options"]
    filterset_fields = ["role", "is_active"]

    def perform_update(self, serializer):
        if serializer.instance == self.request.user:
            if "is_active" in serializer.validated_data:
                raise serializers.ValidationError("You can't deactivate your own account.")
            if "role" in serializer.validated_data:
                raise serializers.ValidationError("You can't change your own role.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise serializers.ValidationError("You can't delete your own account.")
        instance.delete()


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This address is used on an existing order and can't be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_create(self, serializer):
        self._unset_other_defaults(serializer.validated_data)
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        self._unset_other_defaults(serializer.validated_data, exclude_pk=serializer.instance.pk)
        serializer.save()

    def _unset_other_defaults(self, validated_data, exclude_pk=None):
        if not validated_data.get("is_default"):
            return
        qs = Address.objects.filter(user=self.request.user, is_default=True)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        qs.update(is_default=False)
