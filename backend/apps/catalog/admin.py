from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Attribute,
    AttributeValue,
    Category,
    InventoryLog,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductImage,
    ProductVariation,
    VariationAttributeValue,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "parent", "image_preview"]
    list_filter = ["parent"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height: 40px;" />', obj.image.url)
        return "—"

    image_preview.short_description = "Image"


class AttributeValueInline(admin.TabularInline):
    model = AttributeValue
    extra = 1


@admin.register(Attribute)
class AttributeAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]
    inlines = [AttributeValueInline]


@admin.register(AttributeValue)
class AttributeValueAdmin(admin.ModelAdmin):
    list_display = ["attribute", "value", "sort_order"]
    list_filter = ["attribute"]
    search_fields = ["value"]


class ProductAttributeValueInline(admin.TabularInline):
    model = ProductAttributeValue
    extra = 1


class ProductVariationInline(admin.TabularInline):
    model = ProductVariation
    extra = 1
    show_change_link = True


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductAddonInline(admin.TabularInline):
    model = ProductAddon
    fk_name = "parent_product"
    extra = 1
    fields = ["addon_product", "is_required", "min_select", "max_select", "price_override", "sort_order"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "categories_display", "product_type", "visibility_type", "status"]
    list_filter = ["categories", "product_type", "visibility_type", "status"]
    search_fields = ["name", "slug", "sku_prefix"]
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ["categories"]
    inlines = [ProductAttributeValueInline, ProductVariationInline, ProductImageInline, ProductAddonInline]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("categories")

    def categories_display(self, obj):
        return ", ".join(c.name for c in obj.categories.all())

    categories_display.short_description = "Categories"


class VariationAttributeValueInline(admin.TabularInline):
    model = VariationAttributeValue
    extra = 1


@admin.register(ProductVariation)
class ProductVariationAdmin(admin.ModelAdmin):
    list_display = ["sku", "product", "price", "stock_quantity", "is_active"]
    list_filter = ["is_active", "product"]
    search_fields = ["sku", "product__name"]
    inlines = [VariationAttributeValueInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ["product", "variation", "alt_text", "sort_order", "is_primary"]
    list_filter = ["is_primary"]
    search_fields = ["product__name", "alt_text"]


@admin.register(ProductAddon)
class ProductAddonAdmin(admin.ModelAdmin):
    list_display = ["parent_product", "addon_product", "is_required", "min_select", "max_select"]
    list_filter = ["is_required"]
    search_fields = ["parent_product__name", "addon_product__name"]


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ["variation", "change_qty", "reason", "reference_id", "created_at"]
    list_filter = ["reason"]
    search_fields = ["variation__sku", "reference_id"]

    def has_add_permission(self, request):
        # Inventory logs are only ever written by the system (checkout,
        # future restock flows), never hand-entered.
        return False

    def has_change_permission(self, request, obj=None):
        return False
