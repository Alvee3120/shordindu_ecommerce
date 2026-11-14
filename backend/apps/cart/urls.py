from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("cart/items", views.CartItemViewSet, basename="cart-item")

urlpatterns = router.urls + [
    path("cart/", views.CartView.as_view(), name="cart-detail"),
    path("cart/old/", views.OldCartListView.as_view(), name="old-carts"),
    path("cart/old/summary/", views.OldCartSummaryView.as_view(), name="old-carts-summary"),
    path("cart/old/<int:pk>/", views.OldCartDetailView.as_view(), name="old-cart-detail"),
]
