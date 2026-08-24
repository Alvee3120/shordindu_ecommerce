from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsStaffOrReadOnly

from . import imports as bulk_imports
from .filters import ProductFilter
from .models import (
    Attribute,
    AttributeValue,
    Category,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductImage,
    ProductVariation,
)
from .serializers import (
    AttributeSerializer,
    AttributeValueSerializer,
    CategoryDetailSerializer,
    CategorySerializer,
    ProductAddonSerializer,
    ProductAttributeValueSerializer,
    ProductImageSerializer,
    ProductSerializer,
    ProductVariationSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by("name")
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CategoryDetailSerializer
        return CategorySerializer


class AttributeViewSet(viewsets.ModelViewSet):
    queryset = Attribute.objects.all().order_by("name")
    serializer_class = AttributeSerializer
    permission_classes = [IsStaffOrReadOnly]


class AttributeValueViewSet(viewsets.ModelViewSet):
    queryset = AttributeValue.objects.all()
    serializer_class = AttributeValueSerializer
    permission_classes = [IsStaffOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related("categories").order_by("-created_at")
    serializer_class = ProductSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "description", "sku_prefix"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_staff = bool(self.request.user and self.request.user.is_authenticated and self.request.user.is_staff)
        if self.action == "list" and not is_staff:
            # Addon-only products aren't sold on their own, so they're hidden from the public
            # shop listing - but staff still need to see and manage them in the admin dashboard.
            queryset = queryset.exclude(visibility_type=Product.VisibilityType.ADDON_ONLY)
        return queryset.distinct()

    @action(detail=True, methods=["get"])
    def addons(self, request, pk=None):
        product = self.get_object()
        addon_links = product.addon_links.select_related("addon_product").order_by("sort_order", "id")
        serializer = ProductAddonSerializer(addon_links, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file uploaded. Attach it as 'file'."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = bulk_imports.BulkImporter().import_workbook(file)
        except bulk_imports.ImportValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=["get"], url_path="import-template")
    def import_template(self, request):
        workbook = bulk_imports.build_template_workbook()
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="product_import_template.xlsx"'
        workbook.save(response)
        return response


class ProductVariationViewSet(viewsets.ModelViewSet):
    queryset = ProductVariation.objects.all().select_related("product")
    serializer_class = ProductVariationSerializer
    permission_classes = [IsStaffOrReadOnly]

    def create(self, request, *args, **kwargs):
        if not request.data.get("product"):
            return Response({"product": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)


class ProductImageViewSet(viewsets.ModelViewSet):
    queryset = ProductImage.objects.all().select_related("product", "variation")
    serializer_class = ProductImageSerializer
    permission_classes = [IsStaffOrReadOnly]


class ProductAttributeValueViewSet(viewsets.ModelViewSet):
    queryset = ProductAttributeValue.objects.all().select_related("product", "attribute_value")
    serializer_class = ProductAttributeValueSerializer
    permission_classes = [IsStaffOrReadOnly]


class ProductAddonViewSet(viewsets.ModelViewSet):
    queryset = ProductAddon.objects.all().select_related("parent_product", "addon_product")
    serializer_class = ProductAddonSerializer
    permission_classes = [IsStaffOrReadOnly]
