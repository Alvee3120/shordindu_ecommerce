import re
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.catalog.models import ProductVariation
from apps.users.models import User
from apps.users.serializers import AddressSerializer

from .models import Coupon, DeliveryChargeSettings, Order, OrderCoupon, OrderItem, Payment
from .pricing import DHAKA_DISTRICT, DHAKA_ZONES, TIER_LABELS, is_dhaka

# Bangladeshi mobile number — same rule the storefront checkout uses.
BD_PHONE_RE = re.compile(r"^(?:\+?880|0)1[3-9]\d{8}$")


class OrderItemSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "variation",
            "product_name_snapshot",
            "product_image",
            "variation_label_snapshot",
            "quantity",
            "unit_price",
            "original_unit_price",
            "discount_name_snapshot",
            "line_total",
            "parent_order_item",
            "children",
        ]

    def get_children(self, obj):
        return OrderItemSerializer(obj.children.all(), many=True, context=self.context).data

    def get_product_image(self, obj):
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


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "transaction_id", "amount", "status", "paid_at"]


class OrderCouponSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="coupon.code", read_only=True)

    class Meta:
        model = OrderCoupon
        fields = ["coupon", "code", "discount_amount"]


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)
    coupons = OrderCouponSerializer(source="order_coupons", many=True, read_only=True)
    shipping_address_detail = AddressSerializer(source="shipping_address", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, default=None)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "user",
            "user_name",
            "guest_email",
            "status",
            "subtotal",
            "discount_total",
            "shipping_total",
            "tax_total",
            "grand_total",
            "shipping_address",
            "shipping_address_detail",
            "billing_address",
            "payment_status",
            "note",
            "created_by",
            "created_by_name",
            "placed_at",
            "items",
            "payments",
            "coupons",
        ]

    def get_items(self, obj):
        top_level = obj.items.filter(parent_order_item__isnull=True).order_by("id")
        return OrderItemSerializer(top_level, many=True, context=self.context).data


class CheckoutSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    create_account = serializers.BooleanField(default=False)
    shipping_address_id = serializers.IntegerField(required=False)
    shipping_name = serializers.CharField(required=False, allow_blank=True)
    shipping_phone = serializers.CharField(required=False, allow_blank=True)
    shipping_address = serializers.CharField(required=False, allow_blank=True)
    shipping_district = serializers.CharField(required=False, allow_blank=True)
    shipping_zone = serializers.CharField(required=False, allow_blank=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    order_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.is_authenticated:
            if not attrs.get("shipping_address_id") and not attrs.get("shipping_address"):
                raise serializers.ValidationError(
                    "Provide shipping_address_id or inline shipping address fields."
                )
        else:
            if attrs.get("create_account"):
                if not attrs.get("email"):
                    raise serializers.ValidationError({"email": "Required to create an account."})
                if User.objects.filter(email__iexact=attrs["email"]).exists():
                    raise serializers.ValidationError(
                        {"email": "An account with this email already exists. Please sign in first."}
                    )
            if not attrs.get("shipping_address"):
                raise serializers.ValidationError({"shipping_address": "Required for guest checkout."})
        return attrs


def coupon_status(coupon, usage_count, now=None):
    """Derived lifecycle status — the model has no stored on/off flag.

    Mirrors ``CouponViewSet``'s ``status`` filter and ``Coupon.is_valid_for``.
    """
    now = now or timezone.now()
    if coupon.starts_at and now < coupon.starts_at:
        return "scheduled"
    if coupon.ends_at and now > coupon.ends_at:
        return "expired"
    if coupon.usage_limit is not None and usage_count >= coupon.usage_limit:
        return "exhausted"
    return "active"


class CouponSerializer(serializers.ModelSerializer):
    # Read-only extras: populated from the viewset's annotated queryset.
    usage_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "type",
            "value",
            "min_order_amount",
            "starts_at",
            "ends_at",
            "usage_limit",
            "usage_count",
            "status",
        ]

    def get_usage_count(self, obj):
        count = getattr(obj, "usage_count", None)
        return obj.order_coupons.count() if count is None else count

    def get_status(self, obj):
        return coupon_status(obj, self.get_usage_count(obj))


class DeliveryChargeSettingsSerializer(serializers.ModelSerializer):
    inside_dhaka = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    dhaka_outer_zones = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    outside_dhaka = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    # The zone -> tier rules, so the frontend never keeps its own copy.
    dhaka_district = serializers.SerializerMethodField()
    dhaka_zones = serializers.SerializerMethodField()
    tier_labels = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryChargeSettings
        fields = [
            "inside_dhaka",
            "dhaka_outer_zones",
            "outside_dhaka",
            "dhaka_district",
            "dhaka_zones",
            "tier_labels",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_dhaka_district(self, obj):
        return DHAKA_DISTRICT

    def get_dhaka_zones(self, obj):
        return [{"name": name, "tier": tier} for name, tier in DHAKA_ZONES.items()]

    def get_tier_labels(self, obj):
        return TIER_LABELS


class ManualOrderItemSerializer(serializers.Serializer):
    variation = serializers.PrimaryKeyRelatedField(queryset=ProductVariation.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=10000)


class ManualOrderQuoteSerializer(serializers.Serializer):
    items = ManualOrderItemSerializer(many=True, allow_empty=False)
    district = serializers.CharField(required=False, allow_blank=True)
    zone = serializers.CharField(required=False, allow_blank=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)


class ManualOrderSerializer(ManualOrderQuoteSerializer):
    """An order a CCE/admin enters from the dashboard (phone/social orders)."""

    customer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.CUSTOMER, is_active=True),
        required=False,
        allow_null=True,
    )
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField()
    district = serializers.CharField(max_length=100)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    client_request_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Customer name is required.")
        return value.strip()

    def validate_phone(self, value):
        value = value.strip()
        if not BD_PHONE_RE.match(value):
            raise serializers.ValidationError("Enter a valid Bangladeshi mobile number.")
        return value

    def validate_address(self, value):
        if not value.strip():
            raise serializers.ValidationError("Delivery address is required.")
        return value.strip()

    def validate(self, attrs):
        if is_dhaka(attrs["district"]) and (attrs.get("zone") or "").strip() not in DHAKA_ZONES:
            raise serializers.ValidationError({"zone": ["Select a Dhaka zone."]})
        return attrs
