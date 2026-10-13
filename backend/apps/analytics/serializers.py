from rest_framework import serializers

from apps.catalog.models import Product
from apps.users.models import User

from .services import product_image_url, product_sku


class ProductPerformanceSerializer(serializers.ModelSerializer):
    """Reads the annotations attached by ``product_performance_queryset``."""

    categories = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    sku = serializers.SerializerMethodField()
    stock_quantity = serializers.IntegerField(read_only=True)
    units_sold = serializers.IntegerField(read_only=True)
    revenue = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    prev_units_sold = serializers.SerializerMethodField()
    prev_revenue = serializers.SerializerMethodField()
    delta_units = serializers.SerializerMethodField()
    delta_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sku",
            "image",
            "categories",
            "status",
            "stock_quantity",
            "units_sold",
            "revenue",
            "prev_units_sold",
            "prev_revenue",
            "delta_units",
            "delta_revenue",
            "created_at",
        ]

    def get_categories(self, obj):
        return [category.name for category in obj.categories.all()]

    def get_image(self, obj):
        return product_image_url(obj, self.context.get("request"))

    def get_sku(self, obj):
        return product_sku(obj)

    # These annotations only exist when the request asked for `compare=1`;
    # otherwise they serialize as null without failing.
    def get_prev_units_sold(self, obj):
        return getattr(obj, "prev_units_sold", None)

    def get_prev_revenue(self, obj):
        return getattr(obj, "prev_revenue", None)

    def get_delta_units(self, obj):
        return getattr(obj, "delta_units", None)

    def get_delta_revenue(self, obj):
        return getattr(obj, "delta_revenue", None)


class CustomerPerformanceSerializer(serializers.ModelSerializer):
    """Reads the annotations attached by ``customer_performance_queryset``."""

    total_orders = serializers.IntegerField(read_only=True)
    total_spend = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    last_order_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "created_at",
            "is_active",
            "total_orders",
            "total_spend",
            "last_order_at",
        ]
