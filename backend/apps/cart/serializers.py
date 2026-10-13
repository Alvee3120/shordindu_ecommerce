from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Product, ProductVariation
from apps.catalog.pricing import pricing_engine_for

from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variation_sku = serializers.CharField(source="variation.sku", read_only=True)
    variation_label = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    # Set only when an automatic discount lowers this line's price.
    original_unit_price = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_image",
            "variation",
            "variation_sku",
            "variation_label",
            "quantity",
            "unit_price_snapshot",
            "original_unit_price",
            "discount",
            "line_total",
            "parent_cart_item",
            "children",
        ]
        read_only_fields = ["unit_price_snapshot", "parent_cart_item"]

    def _quote(self, obj):
        # Add-on lines follow addon pricing (price_override), not discounts.
        if obj.parent_cart_item_id:
            return None
        quote = pricing_engine_for(self.context).quote(obj.variation)
        return quote if quote.discount and quote.final_price == obj.unit_price_snapshot else None

    def get_original_unit_price(self, obj):
        quote = self._quote(obj)
        return str(quote.base_price) if quote else None

    def get_discount(self, obj):
        quote = self._quote(obj)
        if not quote:
            return None
        info = quote.discount_info()
        return {**info, "value": str(info["value"]), "amount": str(info["amount"])}

    def get_line_total(self, obj):
        return obj.unit_price_snapshot * obj.quantity

    def get_variation_label(self, obj):
        values = [av.attribute_value.value for av in obj.variation.variation_attribute_values.all()]
        return " / ".join(values)

    def get_product_image(self, obj):
        # Prefer an image tied to this exact variation, then the product's
        # primary image, then whatever's first — mirrors the storefront PDP.
        image = (
            obj.product.images.filter(variation=obj.variation).first()
            or obj.product.images.filter(is_primary=True).first()
            or obj.product.images.first()
        )
        if not image:
            return None
        request = self.context.get("request")
        url = image.image.url
        return request.build_absolute_uri(url) if request else url

    def get_children(self, obj):
        # Self-referential nesting: resolved by name at call time, not class
        # definition time, so this works despite CartItemSerializer not yet
        # existing when this method body is parsed.
        return CartItemSerializer(obj.children.all(), many=True, context=self.context).data


class CartItemCreateSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    variation = serializers.PrimaryKeyRelatedField(queryset=ProductVariation.objects.all())
    quantity = serializers.IntegerField(min_value=1, default=1)

    def validate(self, attrs):
        if attrs["variation"].product_id != attrs["product"].id:
            raise serializers.ValidationError({"variation": "Variation does not belong to this product."})
        return attrs


class CartSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "items", "subtotal", "item_count", "created_at"]

    def get_items(self, obj):
        top_level = obj.items.filter(parent_cart_item__isnull=True).order_by("id")
        return CartItemSerializer(top_level, many=True, context=self.context).data

    def get_subtotal(self, obj):
        return sum((item.unit_price_snapshot * item.quantity for item in obj.items.all()), Decimal("0.00"))

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())
