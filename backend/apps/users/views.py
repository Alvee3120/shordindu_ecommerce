from django.conf import settings
from django.db.models import Prefetch, ProtectedError, Q
from kombu.exceptions import OperationalError as BrokerOperationalError
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.cart_resolver import CART_COOKIE_NAME
from apps.cart.services import merge_guest_cart
from apps.core.permissions import CanManageOrders, IsAdminOnly

from .cookies import clear_auth_cookies, set_auth_cookies
from .models import Address, User
from .serializers import (
    AddressSerializer,
    AdminPasswordResetSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    ChangePasswordSerializer,
    CustomerLookupSerializer,
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
    """Admin-only user management: create accounts, list/search them, edit
    profile fields, change role or active status, reset passwords and delete.

    Every method is admin-only; CCE and customer accounts get a 403. Two
    safety rules always apply: an administrator can never deactivate, demote
    or delete their own account, and the last remaining active administrator
    can never be removed."""

    queryset = User.objects.select_related("created_by").order_by("-created_at")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ["role", "is_active"]
    search_fields = ["name", "phone", "email"]
    ordering_fields = ["created_at", "name"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def _active_admin_count(self):
        return User.objects.filter(role=User.Role.ADMIN, is_active=True).count()

    def _ensure_not_last_admin(self, target, message):
        is_active_admin = target.role == User.Role.ADMIN and target.is_active
        if is_active_admin and self._active_admin_count() <= 1:
            raise serializers.ValidationError(message)

    def perform_update(self, serializer):
        target = serializer.instance
        data = serializer.validated_data

        if target == self.request.user:
            if "is_active" in data:
                raise serializers.ValidationError("You can't deactivate your own account.")
            if "role" in data and data["role"] != User.Role.ADMIN:
                raise serializers.ValidationError("You can't change your own role.")

        removing_admin = data.get("role", target.role) != User.Role.ADMIN or data.get(
            "is_active", target.is_active
        ) is False
        if removing_admin:
            self._ensure_not_last_admin(target, "You can't remove the last administrator.")

        serializer.save()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise serializers.ValidationError("You can't delete your own account.")
        self._ensure_not_last_admin(instance, "You can't delete the last administrator.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        target = self.get_object()
        if target == request.user:
            raise serializers.ValidationError(
                "Use Change Password to update your own password."
            )

        serializer = AdminPasswordResetSerializer(
            data=request.data, context={"user": target, "request": request}
        )
        serializer.is_valid(raise_exception=True)

        target.set_password(serializer.validated_data["new_password"])
        target.force_password_change = True
        target.save(update_fields=["password", "force_password_change"])
        return Response({"detail": "Password reset."}, status=status.HTTP_200_OK)


class CustomerLookupView(generics.ListAPIView):
    """Search existing customers (name / phone / email) while a CCE enters an
    order. Customers only, a short unpaginated list, no account-management
    fields — CCE users still can't reach the admin User Management API."""

    serializer_class = CustomerLookupSerializer
    permission_classes = [CanManageOrders]
    pagination_class = None
    filter_backends = []
    MAX_RESULTS = 8

    def get_queryset(self):
        term = self.request.query_params.get("search", "").strip()
        if len(term) < 2:
            return User.objects.none()
        return (
            User.objects.filter(role=User.Role.CUSTOMER, is_active=True)
            .filter(Q(name__icontains=term) | Q(phone__icontains=term) | Q(email__icontains=term))
            .prefetch_related(
                Prefetch("addresses", queryset=Address.objects.order_by("-is_default", "-id"))
            )
            .order_by("name")[: self.MAX_RESULTS]
        )


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
