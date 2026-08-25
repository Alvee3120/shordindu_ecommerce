import django_filters

from .models import Order


class OrderFilter(django_filters.FilterSet):
    placed_after = django_filters.DateFilter(field_name="placed_at", lookup_expr="date__gte")
    placed_before = django_filters.DateFilter(field_name="placed_at", lookup_expr="date__lte")

    class Meta:
        model = Order
        fields = ["status", "payment_status", "placed_after", "placed_before"]
