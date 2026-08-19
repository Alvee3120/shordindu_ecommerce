from django.contrib import admin

from .models import Coupon, Order, OrderCoupon, OrderItem, Payment


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = [
        "product",
        "variation",
        "product_name_snapshot",
        "variation_label_snapshot",
        "quantity",
        "unit_price",
        "line_total",
        "parent_order_item",
    ]


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


class OrderCouponInline(admin.TabularInline):
    model = OrderCoupon
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number",
        "user",
        "guest_email",
        "status",
        "payment_status",
        "grand_total",
        "placed_at",
    ]
    list_filter = ["status", "payment_status"]
    search_fields = ["order_number", "guest_email", "user__email"]
    readonly_fields = ["order_number", "placed_at"]
    inlines = [OrderItemInline, PaymentInline, OrderCouponInline]


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ["code", "type", "value", "min_order_amount", "usage_limit", "starts_at", "ends_at"]
    search_fields = ["code"]
