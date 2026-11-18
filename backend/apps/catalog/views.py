from collections import defaultdict

from django.db.models import Count, Prefetch, Q
from django.db.models.functions import Lower
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminOnly, IsAdminOrReadOnly, is_admin

from . import imports as bulk_imports
from .filters import ProductFilter, color_condition
from .pricing import PricingEngine, discounted_product_ids
from .promotions import promotion_product_ids
from .models import (
    Attribute,
    AttributeValue,
    Category,
    Discount,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductColor,
    ProductImage,
    ProductVariation,
    StockNotification,
    VariationAttributeValue,
    is_color_attribute,
)
from .serializers import (
    AttributeSerializer,
    AttributeValueSerializer,
    CategoryDetailSerializer,
    CategorySerializer,
    DiscountSerializer,
    ProductAddonSerializer,
    ProductAttributeValueSerializer,
    ProductColorSerializer,
    ProductImageSerializer,
    ProductSerializer,
    ProductVariationSerializer,
    StockNotificationSerializer,
)


def _category_product_counts():
    """Active product counts for every category, including its descendants.

    One query reads the category tree and one reads the active product-category
    links. Counting unique product ids in each subtree keeps a product that is
    linked to both a parent and a child from being counted twice.
    """
    parents = dict(Category.objects.values_list("id", "parent_id"))
    children = defaultdict(list)
    for category_id, parent_id in parents.items():
        if parent_id is not None:
            children[parent_id].append(category_id)

    direct_products = defaultdict(set)
    links = Product.categories.through.objects.filter(
        product__status=Product.Status.ACTIVE
    )
    for product_id, category_id in links.values_list("product_id", "category_id"):
        direct_products[category_id].add(product_id)

    counts = {}

    def collect(category_id, visiting):
        if category_id in visiting:
            return set()
        visiting.add(category_id)
        product_ids = set(direct_products[category_id])
        for child_id in children.get(category_id, ()):
            product_ids |= collect(child_id, visiting)
        visiting.discard(category_id)
        counts[category_id] = len(product_ids)
        return product_ids

    for category_id, parent_id in parents.items():
        if parent_id is None:
            collect(category_id, set())
    for category_id in parents:
        if category_id not in counts:
            collect(category_id, set())
    return counts


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("parent").order_by("name")
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CategoryDetailSerializer
        return CategorySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if is_admin(self.request.user):
            context["category_product_counts"] = _category_product_counts()
        return context


class AttributeViewSet(viewsets.ModelViewSet):
    queryset = Attribute.objects.all().order_by("name")
    serializer_class = AttributeSerializer
    permission_classes = [IsAdminOrReadOnly]


class AttributeValueViewSet(viewsets.ModelViewSet):
    queryset = AttributeValue.objects.select_related("attribute").order_by(
        "attribute__name", "sort_order", "value"
    )
    serializer_class = AttributeValueSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["attribute"]
    search_fields = ["value"]
    ordering_fields = ["sort_order", "value"]

    @action(detail=False, methods=["get"], url_path="color-library")
    def color_library(self, request):
        """Reusable colors, shared by every product, with usage counts."""
        queryset = (
            AttributeValue.objects.filter(
                Q(attribute__name__iexact="color") | Q(attribute__name__iexact="colour")
            )
            .order_by("sort_order", "value")
        )
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(value__icontains=search)
        values = list(queryset)
        color_ids = [value.id for value in values]

        # A color is "in use" if any product links it directly, as a variation
        # color, or through a product color config. All three cascade on delete,
        # so the count has to include all of them.
        usage = {}

        def record(product_id, color_id):
            usage.setdefault(color_id, set()).add(product_id)

        for product_id, color_id in ProductColor.objects.filter(
            attribute_value_id__in=color_ids
        ).values_list("product_id", "attribute_value_id"):
            record(product_id, color_id)
        for product_id, color_id in ProductAttributeValue.objects.filter(
            attribute_value_id__in=color_ids
        ).values_list("product_id", "attribute_value_id"):
            record(product_id, color_id)
        for product_id, color_id in VariationAttributeValue.objects.filter(
            attribute_value_id__in=color_ids
        ).values_list("variation__product_id", "attribute_value_id"):
            if product_id:
                record(product_id, color_id)

        return Response(
            [
                {
                    "id": value.id,
                    "name": value.value,
                    "hex_code": value.hex_code or "#D1D5DB",
                    "usage_count": len(usage.get(value.id, ())),
                }
                for value in values
            ]
        )


PRICE_ORDERINGS = ("price", "-price")
NAME_ORDERINGS = ("name", "-name")


def _lowest_effective_price(product, engine):
    """The cheapest price a shopper can pay for ``product`` right now.

    In-stock variations win, matching the storefront's color pricing; when
    nothing is in stock the whole active set still gives the product a price.
    """
    variations = list(product.variations.all())
    pool = [variation for variation in variations if variation.stock_quantity > 0] or variations
    prices = []
    for variation in pool:
        try:
            price = engine.price(variation)
            valid = price is not None and price >= 0
        except (ArithmeticError, TypeError, ValueError):
            valid = False
        if valid:
            prices.append(price)
    return min(prices) if prices else None


def _product_ids_by_price(queryset, descending=False):
    """Product ids ordered by their lowest live selling price.

    Discounts are computed in Python by ``PricingEngine``, so only the page is
    fetched with the full serializer prefetches afterwards. Products with no
    valid price are always listed last.
    """
    products = (
        Product.objects.filter(pk__in=queryset.order_by().values("pk"))
        .only("id", "name")
        .prefetch_related(
            Prefetch(
                "variations",
                queryset=ProductVariation.objects.filter(is_active=True)
                .select_related("product")
                .prefetch_related("product__categories"),
            )
        )
    )
    engine = PricingEngine()
    priced, unpriced = [], []
    for product in products:
        price = _lowest_effective_price(product, engine)
        if price is None:
            unpriced.append(product)
        else:
            priced.append((price, product))

    priced.sort(key=lambda entry: (entry[1].name.casefold(), entry[1].pk))
    priced.sort(key=lambda entry: entry[0], reverse=descending)
    unpriced.sort(key=lambda product: (product.name.casefold(), product.pk))
    return [product.pk for _, product in priced] + [product.pk for product in unpriced]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects.annotate(addon_count=Count("addon_links", distinct=True))
        .prefetch_related(
            "categories",
            "images",
            "variations__images",
            "variations__variation_attribute_values__attribute_value__attribute",
            "product_attribute_values__attribute_value__attribute",
            "product_colors__attribute_value__attribute",
        )
        .order_by("-created_at")
    )
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "description", "sku_prefix", "variations__sku"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Addon-only products aren't meant to appear as standalone shop listings,
        # but administrators managing the catalog still need to see
        # every product regardless of visibility type.
        if self.action == "list" and not is_admin(self.request.user):
            queryset = queryset.exclude(visibility_type=Product.VisibilityType.ADDON_ONLY)
        return queryset.distinct()

    def filter_queryset(self, queryset):
        if self.action != "list":
            return super().filter_queryset(queryset)
        ordering = self.request.query_params.get("ordering")
        if ordering in PRICE_ORDERINGS:
            self._price_ordering = ordering
            return self._apply_filter_backends(queryset, skip=(OrderingFilter,))
        if ordering in NAME_ORDERINGS:
            queryset = self._apply_filter_backends(queryset, skip=(OrderingFilter,))
            if ordering == "name":
                return queryset.order_by(Lower("name"), "id")
            return queryset.order_by(Lower("name").desc(), "-id")
        return super().filter_queryset(queryset)

    def _apply_filter_backends(self, queryset, skip=()):
        for backend in self.filter_backends:
            if backend in skip:
                continue
            queryset = backend().filter_queryset(self.request, queryset, self)
        return queryset

    def paginate_queryset(self, queryset):
        ordering = getattr(self, "_price_ordering", None)
        if ordering is None or self.paginator is None:
            return super().paginate_queryset(queryset)
        ordered_ids = _product_ids_by_price(queryset, descending=ordering == "-price")
        page_ids = self.paginator.paginate_queryset(ordered_ids, self.request, view=self)
        if page_ids is None:
            return None
        products = {product.pk: product for product in queryset.filter(pk__in=page_ids)}
        return [products[pk] for pk in page_ids if pk in products]

    @action(detail=False, methods=["get"], url_path="color-facets")
    def color_facets(self, request):
        """Available colors with product counts for the shop color filter."""
        params = request.query_params.copy()
        params.pop("color", None)
        base = Product.objects.filter(status=Product.Status.ACTIVE).exclude(
            visibility_type=Product.VisibilityType.ADDON_ONLY
        )
        filtered = ProductFilter(params, queryset=base).qs
        filtered = SearchFilter().filter_queryset(request, filtered, self).distinct()

        color_values = [
            attribute_value
            for attribute_value in AttributeValue.objects.select_related("attribute").order_by(
                "sort_order", "value"
            )
            if is_color_attribute(attribute_value.attribute.name)
        ]

        colors = []
        for attribute_value in color_values:
            count = (
                filtered.filter(color_condition(attribute_value.id))
                .values("pk")
                .distinct()
                .count()
            )
            colors.append(
                {
                    "attribute_value": attribute_value.id,
                    "name": attribute_value.value,
                    "hex_code": attribute_value.hex_code or "#D1D5DB",
                    "count": count,
                }
            )
        return Response({"colors": colors})

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


class ProductColorViewSet(viewsets.ModelViewSet):
    queryset = ProductColor.objects.select_related(
        "product", "attribute_value__attribute"
    ).order_by("sort_order", "id")
    serializer_class = ProductColorSerializer
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["product", "is_active"]
    ordering_fields = ["sort_order"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if VariationAttributeValue.objects.filter(
            variation__product=instance.product,
            attribute_value=instance.attribute_value,
        ).exists():
            return Response(
                {
                    "detail": "This color is used by product variations. "
                    "Remove it from the variations first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        ProductAttributeValue.objects.filter(
            product=instance.product, attribute_value=instance.attribute_value
        ).delete()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class DiscountViewSet(viewsets.ModelViewSet):
    """Automatic category/product discounts — administrators only (read and write).

    Filters: ?search= (name), ?status=active|scheduled|expired|inactive,
    ?type=percent|fixed, ?target_type=category|products|both.
    """

    serializer_class = DiscountSerializer
    permission_classes = [IsAdminOnly]
    search_fields = ["name"]
    filterset_fields = ["type", "target_type"]
    ordering_fields = ["name", "starts_at", "ends_at", "value", "created_at"]

    def get_queryset(self):
        queryset = (
            Discount.objects.prefetch_related("categories", "products__images", "products__variations")
            .order_by("-starts_at", "-id")
        )
        return self._filter_status(queryset, self.request.query_params.get("status"))

    @staticmethod
    def _filter_status(queryset, value):
        # Same rules as Discount.status_at, expressed as a query.
        now = timezone.now()
        if value == "inactive":
            return queryset.filter(is_active=False)
        if value == "scheduled":
            return queryset.filter(is_active=True, starts_at__gt=now)
        if value == "expired":
            return queryset.filter(is_active=True, ends_at__lt=now)
        if value == "active":
            return queryset.live(now)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DiscountShowcaseView(APIView):
    """Public: every live discount with the products it currently prices, for
    the homepage — one section per discount, titled with the discount's name.

    One request for all sections; one pricing engine prices every product.
    Discounts with no eligible products are left out.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        engine = PricingEngine()
        context = {"request": request, "pricing_engine": engine}
        datetime_field = serializers.DateTimeField()  # project timezone, like every other API date
        sections = []
        for discount in Discount.objects.live(engine.now).prefetch_related("categories").order_by("-starts_at", "-id"):
            # Per-item rules price the product directly; basket offers list every
            # product they target (the saving happens in the cart).
            ids = (
                promotion_product_ids(discount)
                if discount.is_basket
                else discounted_product_ids(discount, engine)
            )
            if not ids:
                continue
            products = {
                p.pk: p
                for p in Product.objects.filter(pk__in=ids).prefetch_related(
                    "categories",
                    "images",
                    "variations__images",
                    "variations__variation_attribute_values__attribute_value__attribute",
                    "product_attribute_values__attribute_value__attribute",
                    "product_colors__attribute_value__attribute",
                )
            }
            sections.append(
                {
                    "id": discount.id,
                    "name": discount.name,
                    "type": discount.type,
                    "is_basket": discount.is_basket,
                    "label": discount.label() if discount.is_basket else None,
                    "value": str(discount.value) if discount.value is not None else None,
                    "min_quantity": discount.min_quantity,
                    "percent_off": str(discount.percent_off) if discount.percent_off is not None else None,
                    "free_quantity": discount.free_quantity,
                    "bundle_price": str(discount.bundle_price) if discount.bundle_price is not None else None,
                    "min_purchase_amount": (
                        str(discount.min_purchase_amount)
                        if discount.min_purchase_amount is not None
                        else None
                    ),
                    "max_discount_amount": (
                        str(discount.max_discount_amount)
                        if discount.max_discount_amount is not None
                        else None
                    ),
                    "target_type": discount.target_type,
                    "categories": [{"id": c.id, "name": c.name} for c in discount.categories.all()],
                    "starts_at": datetime_field.to_representation(discount.starts_at),
                    "ends_at": datetime_field.to_representation(discount.ends_at),
                    "product_count": len(ids),
                    "products": ProductSerializer(
                        [products[pk] for pk in ids if pk in products], many=True, context=context
                    ).data,
                }
            )
        return Response(sections)
