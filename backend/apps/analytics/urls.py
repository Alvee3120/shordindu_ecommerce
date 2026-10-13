from rest_framework.routers import DefaultRouter

from .views import AnalyticsViewSet

router = DefaultRouter()
router.register("analytics", AnalyticsViewSet, basename="analytics")

urlpatterns = router.urls
