from django.contrib import admin

from .models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    fields = ["product", "variation", "quantity", "unit_price_snapshot", "parent_cart_item"]


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "token", "created_at"]
    search_fields = ["user__email", "token"]
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ["cart", "product", "variation", "quantity", "unit_price_snapshot", "parent_cart_item"]
    list_filter = ["cart"]
    search_fields = ["product__name", "variation__sku"]
