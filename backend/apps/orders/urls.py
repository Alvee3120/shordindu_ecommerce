from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("orders", views.OrderViewSet, basename="order")
router.register("coupons", views.CouponViewSet, basename="coupon")

urlpatterns = router.urls + [
    path("checkout/", views.CheckoutView.as_view(), name="checkout"),
]
