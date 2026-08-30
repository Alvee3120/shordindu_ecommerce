from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from apps.core.permissions import IsAdminOnly, IsAdminOrReadOnly, is_admin

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
    StockNotification,
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
    StockNotificationSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by("name")
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CategoryDetailSerializer
        return CategorySerializer


class AttributeViewSet(viewsets.ModelViewSet):
    queryset = Attribute.objects.all().order_by("name")
    serializer_class = AttributeSerializer
    permission_classes = [IsAdminOrReadOnly]


class AttributeValueViewSet(viewsets.ModelViewSet):
    queryset = AttributeValue.objects.all()
    serializer_class = AttributeValueSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related("categories").order_by("-created_at")
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "description", "sku_prefix"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Addon-only products aren't meant to appear as standalone shop listings,
        # but administrators managing the catalog still need to see
        # every product regardless of visibility type.
        if self.action == "list" and not is_admin(self.request.user):
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
    permission_classes = [IsAdminOrReadOnly]

    def create(self, request, *args, **kwargs):
        if not request.data.get("product"):
            return Response({"product": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)


class ProductImageViewSet(viewsets.ModelViewSet):
    queryset = ProductImage.objects.all().select_related("product", "variation")
    serializer_class = ProductImageSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductAttributeValueViewSet(viewsets.ModelViewSet):
    queryset = ProductAttributeValue.objects.all().select_related("product", "attribute_value")
    serializer_class = ProductAttributeValueSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductAddonViewSet(viewsets.ModelViewSet):
    queryset = ProductAddon.objects.all().select_related("parent_product", "addon_product")
    serializer_class = ProductAddonSerializer
    permission_classes = [IsAdminOrReadOnly]


class StockNotificationViewSet(viewsets.GenericViewSet):
    serializer_class = StockNotificationSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        # Anyone may subscribe to a restock; only admins may read the list.
        if self.request.method in SAFE_METHODS:
            return [IsAdminOnly()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        return StockNotification.objects.select_related("product", "variation", "user").all()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user.is_authenticated:
            serializer.save(
                user=request.user,
                customer_name=request.user.name or serializer.validated_data["customer_name"],
                phone=request.user.phone or serializer.validated_data["phone"],
                note=serializer.validated_data["note"],
            )
        else:
            serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
