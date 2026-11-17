import django_filters
from django.db.models import Exists, OuterRef, Q

from .models import Discount, Product, ProductColor
from .pricing import PricingEngine, discounted_product_ids
from .promotions import promotion_product_ids


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """Accepts a comma-separated list of ids, e.g. ?category=1,2,3"""


def color_condition(color_id):
    """A product has this color when an active ProductColor, a product-level
    color link, or any variation carries it. Stock and variation activity do
    not remove an assigned color: the storefront still shows the swatch. An
    inactive ProductColor config suppresses the color even if a variation
    still uses it."""
    inactive_config = ProductColor.objects.filter(
        product=OuterRef("pk"), attribute_value_id=color_id, is_active=False
    )
    return (
        Q(product_colors__attribute_value_id=color_id, product_colors__is_active=True)
        | Q(product_attribute_values__attribute_value_id=color_id)
        | Q(variations__variation_attribute_values__attribute_value_id=color_id)
    ) & ~Exists(inactive_config)


class ProductFilter(django_filters.FilterSet):
    category = NumberInFilter(field_name="categories", lookup_expr="in")
    attribute_value = django_filters.NumberFilter(field_name="product_attribute_values__attribute_value_id")
    color = NumberInFilter(method="filter_colors")
    min_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="lte")
    # Products a live automatic discount currently prices ("View All" from a
    # homepage discount section). Unknown, scheduled or expired -> no products.
    discount = django_filters.NumberFilter(method="filter_discount")

    class Meta:
        model = Product
        fields = [
            "category",
            "product_type",
            "visibility_type",
            "status",
            "attribute_value",
            "color",
            "discount",
        ]

    def filter_colors(self, queryset, name, value):
        if not value:
            return queryset
        conditions = Q()
        for color_id in value:
            conditions |= color_condition(color_id)
        return queryset.filter(conditions).distinct()

    def filter_discount(self, queryset, name, value):
        engine = PricingEngine()
        discount = Discount.objects.live(engine.now).filter(pk=value).first()
        if discount is None:
            return queryset.none()
        # Per-item rules price the product directly; basket offers list every
        # product they target (the saving happens in the cart).
        ids = (
            promotion_product_ids(discount)
            if discount.is_basket
            else discounted_product_ids(discount, engine)
        )
        return queryset.filter(pk__in=ids)
