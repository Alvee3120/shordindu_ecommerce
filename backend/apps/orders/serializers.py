from rest_framework import serializers

from apps.users.serializers import AddressSerializer

from .models import Coupon, Order, OrderCoupon, OrderItem, Payment


class OrderItemSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "variation",
            "product_name_snapshot",
            "variation_label_snapshot",
            "quantity",
            "unit_price",
            "line_total",
            "parent_order_item",
            "children",
        ]

    def get_children(self, obj):
        return OrderItemSerializer(obj.children.all(), many=True, context=self.context).data


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
            "placed_at",
            "items",
            "payments",
            "coupons",
        ]

    def get_items(self, obj):
        top_level = obj.items.filter(parent_order_item__isnull=True).order_by("id")
        return OrderItemSerializer(top_level, many=True, context=self.context).data


class CheckoutSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    create_account = serializers.BooleanField(default=False)
    shipping_address_id = serializers.IntegerField(required=False)
    shipping_name = serializers.CharField(required=False, allow_blank=True)
    shipping_phone = serializers.CharField(required=False, allow_blank=True)
    shipping_address = serializers.CharField(required=False, allow_blank=True)
    shipping_district = serializers.CharField(required=False, allow_blank=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.is_authenticated:
            if not attrs.get("shipping_address_id") and not attrs.get("shipping_address"):
                raise serializers.ValidationError(
                    "Provide shipping_address_id or inline shipping address fields."
                )
        else:
            if not attrs.get("email"):
                raise serializers.ValidationError({"email": "Required for guest checkout."})
            if not attrs.get("shipping_address"):
                raise serializers.ValidationError({"shipping_address": "Required for guest checkout."})
        return attrs


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ["id", "code", "type", "value", "min_order_amount", "starts_at", "ends_at", "usage_limit"]
