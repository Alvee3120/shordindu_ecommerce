from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("attributes", views.AttributeViewSet, basename="attribute")
router.register("attribute-values", views.AttributeValueViewSet, basename="attribute-value")

urlpatterns = router.urls
