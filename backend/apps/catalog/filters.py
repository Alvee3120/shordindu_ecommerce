import django_filters

from .models import Discount, Product
from .pricing import PricingEngine, discounted_product_ids


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """Accepts a comma-separated list of ids, e.g. ?category=1,2,3"""


class ProductFilter(django_filters.FilterSet):
    category = NumberInFilter(field_name="categories", lookup_expr="in")
    attribute_value = django_filters.NumberFilter(field_name="product_attribute_values__attribute_value_id")
    min_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="lte")
    # Products a live automatic discount currently prices ("View All" from a
    # homepage discount section). Unknown, scheduled or expired -> no products.
    discount = django_filters.NumberFilter(method="filter_discount")

    class Meta:
        model = Product
        fields = ["category", "product_type", "visibility_type", "status", "attribute_value", "discount"]

    def filter_discount(self, queryset, name, value):
        engine = PricingEngine()
        discount = Discount.objects.live(engine.now).filter(pk=value).first()
        if discount is None:
            return queryset.none()
        return queryset.filter(pk__in=discounted_product_ids(discount, engine))
