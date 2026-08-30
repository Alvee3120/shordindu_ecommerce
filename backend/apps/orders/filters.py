import django_filters

from .models import Order


class OrderFilter(django_filters.FilterSet):
    placed_after = django_filters.DateFilter(field_name="placed_at", lookup_expr="date__gte")
    placed_before = django_filters.DateFilter(field_name="placed_at", lookup_expr="date__lte")
    # CCE/admin users otherwise see every order (see OrderViewSet.get_queryset) —
    # this lets their own "My Orders" view narrow back down to just the orders
    # they personally placed, the same way a customer's view always is.
    mine = django_filters.BooleanFilter(method="filter_mine")

    class Meta:
        model = Order
        fields = ["status", "payment_status", "placed_after", "placed_before", "mine"]

    def filter_mine(self, queryset, name, value):
        if value:
            return queryset.filter(user=self.request.user)
        return queryset
