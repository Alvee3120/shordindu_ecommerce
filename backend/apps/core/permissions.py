from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.role == user.Role.ADMIN
    )


def can_manage_orders(user):
    return bool(
        user
        and user.is_authenticated
        and user.role in (user.Role.CCE, user.Role.ADMIN)
    )


class IsAdminOrReadOnly(BasePermission):
    """Anyone can read; only administrators can write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_admin(request.user)


class IsAdminOnly(BasePermission):
    """Administrators only, for both reads and writes."""

    def has_permission(self, request, view):
        return is_admin(request.user)


class CanManageOrders(BasePermission):
    """Customer Care Executives and administrators can manage orders."""

    def has_permission(self, request, view):
        return can_manage_orders(request.user)


class IsOwnerOrReadOnly(BasePermission):
    """Anyone can read; only the object's own author (or an admin) can write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.user_id == request.user.id or is_admin(request.user)
