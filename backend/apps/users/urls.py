from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")
router.register("users", views.UserManagementViewSet, basename="admin-user")

urlpatterns = [
    path("auth/signup/", views.SignupView.as_view(), name="signup"),
    path("auth/signin/", views.SigninView.as_view(), name="signin"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/token/refresh/", views.CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("auth/change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
