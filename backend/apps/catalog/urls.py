from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("attributes", views.AttributeViewSet, basename="attribute")
router.register("attribute-values", views.AttributeValueViewSet, basename="attribute-value")
router.register("products", views.ProductViewSet, basename="product")
router.register("product-variations", views.ProductVariationViewSet, basename="product-variation")
router.register("product-images", views.ProductImageViewSet, basename="product-image")
router.register(
    "product-attribute-values", views.ProductAttributeValueViewSet, basename="product-attribute-value"
)
router.register("product-addons", views.ProductAddonViewSet, basename="product-addon")

urlpatterns = router.urls
