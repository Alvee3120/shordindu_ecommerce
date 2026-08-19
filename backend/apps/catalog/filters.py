import django_filters

from .models import Product


class ProductFilter(django_filters.FilterSet):
    attribute_value = django_filters.NumberFilter(field_name="product_attribute_values__attribute_value_id")
    min_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="variations__price", lookup_expr="lte")

    class Meta:
        model = Product
        fields = ["category", "product_type", "visibility_type", "status", "attribute_value"]
