from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.catalog.models import Product, ProductVariation
from apps.catalog.pricing import pricing_engine_for
from apps.users.models import User

from .models import Cart, CartItem
from .old_carts import OLD_CART_THRESHOLD_HOURS


def _age_seconds(value, context):
    if not value:
        return None
    now = (context or {}).get("now") or timezone.now()
    return max(0, int((now - value).total_seconds()))


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variation_sku = serializers.CharField(source="variation.sku", read_only=True)
    variation_label = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    # Set only when an automatic discount lowers this line's price.
    original_unit_price = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    # Basket-level promotional offer applied to this line (if any).
    promotion_discount = serializers.SerializerMethodField()
    promotion_label = serializers.SerializerMethodField()
    free_quantity = serializers.SerializerMethodField()
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
            "promotion_discount",
            "promotion_label",
            "free_quantity",
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

    def _promotion(self, obj):
        # Add-on lines never carry a basket promotion.
        if obj.parent_cart_item_id:
            return None
        promotions = self.context.get("promotions") if self.context else None
        if not promotions:
            return None
        return promotions["by_item"].get(obj.id)

    def get_original_unit_price(self, obj):
        quote = self._quote(obj)
        return str(quote.base_price) if quote else None

    def get_discount(self, obj):
        quote = self._quote(obj)
        if not quote:
            return None
        info = quote.discount_info()
        return {**info, "value": str(info["value"]), "amount": str(info["amount"])}

    def get_promotion_discount(self, obj):
        promotion = self._promotion(obj)
        return promotion["discount"] if promotion and promotion["discount"] > 0 else None

    def get_promotion_label(self, obj):
        promotion = self._promotion(obj)
        return promotion["label"] if promotion and promotion["discount"] > 0 else None

    def get_free_quantity(self, obj):
        promotion = self._promotion(obj)
        return promotion["free"] if promotion else 0

    def get_line_total(self, obj):
        total = obj.unit_price_snapshot * obj.quantity
        promotion = self._promotion(obj)
        if promotion:
            total -= promotion["discount"]
        return total

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
    promotion_discount_total = serializers.SerializerMethodField()
    promotions = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "items",
            "subtotal",
            "promotion_discount_total",
            "promotions",
            "item_count",
            "created_at",
        ]

    def _promotions(self):
        return self.context.get("promotions") if self.context else None

    def get_items(self, obj):
        top_level = obj.items.filter(parent_cart_item__isnull=True).order_by("id")
        return CartItemSerializer(top_level, many=True, context=self.context).data

    def get_subtotal(self, obj):
        # Net of basket promotions — the price checkout will actually charge.
        gross = sum((item.unit_price_snapshot * item.quantity for item in obj.items.all()), Decimal("0.00"))
        promotions = self._promotions()
        return gross - (promotions["total"] if promotions else Decimal("0.00"))

    def get_promotion_discount_total(self, obj):
        promotions = self._promotions()
        return promotions["total"] if promotions else Decimal("0.00")

    def get_promotions(self, obj):
        promotions = self._promotions()
        return promotions["applied"] if promotions else []

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())


class OldCartCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "phone", "email"]


class OldCartSummarySerializer(serializers.ModelSerializer):
    """One row per customer (Cart.user is unique), only for carts that contain
    at least one item older than the threshold. Counts come from annotations."""

    customer = OldCartCustomerSerializer(source="user", read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    old_item_count = serializers.IntegerField(read_only=True)
    cart_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    oldest_item_at = serializers.DateTimeField(read_only=True)
    last_item_at = serializers.DateTimeField(read_only=True)
    oldest_age_seconds = serializers.SerializerMethodField()
    last_age_seconds = serializers.SerializerMethodField()
    threshold_hours = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "customer",
            "item_count",
            "old_item_count",
            "cart_value",
            "oldest_item_at",
            "oldest_age_seconds",
            "last_item_at",
            "last_age_seconds",
            "threshold_hours",
        ]

    def get_oldest_age_seconds(self, obj):
        return _age_seconds(obj.oldest_item_at, self.context)

    def get_last_age_seconds(self, obj):
        return _age_seconds(obj.last_item_at, self.context)

    def get_threshold_hours(self, obj):
        return OLD_CART_THRESHOLD_HOURS


class OldCartItemSerializer(CartItemSerializer):
    """Cart item as seen by Admin/CCE monitoring: adds the item's own age and
    the variation's *current* stock (which may have changed since it was
    added). The item is never hidden or removed because stock hit zero."""

    created_at = serializers.DateTimeField(read_only=True)
    age_seconds = serializers.SerializerMethodField()
    stock_quantity = serializers.IntegerField(source="variation.stock_quantity", read_only=True)
    variation_is_active = serializers.BooleanField(source="variation.is_active", read_only=True)
    children = serializers.SerializerMethodField()

    class Meta(CartItemSerializer.Meta):
        fields = CartItemSerializer.Meta.fields + [
            "created_at",
            "age_seconds",
            "stock_quantity",
            "variation_is_active",
        ]

    def get_age_seconds(self, obj):
        return _age_seconds(obj.created_at, self.context)

    def get_children(self, obj):
        return OldCartItemSerializer(obj.children.all(), many=True, context=self.context).data


class OldCartDetailSerializer(CartSerializer):
    customer = OldCartCustomerSerializer(source="user", read_only=True)
    oldest_item_at = serializers.SerializerMethodField()
    oldest_age_seconds = serializers.SerializerMethodField()
    last_item_at = serializers.SerializerMethodField()
    threshold_hours = serializers.SerializerMethodField()

    class Meta(CartSerializer.Meta):
        fields = CartSerializer.Meta.fields + [
            "customer",
            "oldest_item_at",
            "oldest_age_seconds",
            "last_item_at",
            "threshold_hours",
        ]

    def _item_times(self, obj):
        return [item.created_at for item in obj.items.all()]

    def get_oldest_item_at(self, obj):
        times = self._item_times(obj)
        return min(times) if times else None

    def get_oldest_age_seconds(self, obj):
        return _age_seconds(self.get_oldest_item_at(obj), self.context)

    def get_last_item_at(self, obj):
        times = self._item_times(obj)
        return max(times) if times else None

    def get_threshold_hours(self, obj):
        return OLD_CART_THRESHOLD_HOURS

    def get_items(self, obj):
        top_level = obj.items.filter(parent_cart_item__isnull=True).order_by("id")
        return OldCartItemSerializer(top_level, many=True, context=self.context).data

