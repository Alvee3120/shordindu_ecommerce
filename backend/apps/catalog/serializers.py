from django.db.models import Avg
from rest_framework import serializers

from .models import (
    Attribute,
    AttributeValue,
    Category,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductImage,
    ProductVariation,
    StockNotification,
    VariationAttributeValue,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "image", "parent", "description"]
        extra_kwargs = {"slug": {"required": False}}


class CategoryDetailSerializer(CategorySerializer):
    children = CategorySerializer(many=True, read_only=True)

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ["children"]


class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ["id", "attribute", "value", "sort_order"]


class AttributeSerializer(serializers.ModelSerializer):
    values = AttributeValueSerializer(many=True, read_only=True)

    class Meta:
        model = Attribute
        fields = ["id", "name", "values"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "variation", "image", "alt_text", "sort_order", "is_primary"]


class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute = serializers.CharField(source="attribute_value.attribute.name", read_only=True)
    value = serializers.CharField(source="attribute_value.value", read_only=True)

    class Meta:
        model = ProductAttributeValue
        fields = ["id", "product", "attribute_value", "attribute", "value"]


class VariationAttributeValueReadSerializer(serializers.ModelSerializer):
    attribute = serializers.CharField(source="attribute_value.attribute.name", read_only=True)
    value = serializers.CharField(source="attribute_value.value", read_only=True)

    class Meta:
        model = VariationAttributeValue
        fields = ["attribute_value", "attribute", "value"]


class ProductVariationSerializer(serializers.ModelSerializer):
    # Only required for the standalone /api/product-variations/ endpoint;
    # when nested under ProductSerializer.create() the product is injected
    # after validation, so it's optional here.
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False)
    attribute_values = VariationAttributeValueReadSerializer(
        source="variation_attribute_values", many=True, read_only=True
    )
    attribute_value_ids = serializers.PrimaryKeyRelatedField(
        queryset=AttributeValue.objects.all(), many=True, write_only=True, required=False
    )
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = ProductVariation
        fields = [
            "id",
            "product",
            "sku",
            "price",
            "compare_at_price",
            "stock_quantity",
            "is_active",
            "attribute_values",
            "attribute_value_ids",
            "images",
        ]

    def create(self, validated_data):
        attribute_values = validated_data.pop("attribute_value_ids", [])
        variation = ProductVariation.objects.create(**validated_data)
        VariationAttributeValue.objects.bulk_create(
            [VariationAttributeValue(variation=variation, attribute_value=av) for av in attribute_values]
        )
        return variation

    def update(self, instance, validated_data):
        attribute_values = validated_data.pop("attribute_value_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if attribute_values is not None:
            instance.variation_attribute_values.all().delete()
            VariationAttributeValue.objects.bulk_create(
                [VariationAttributeValue(variation=instance, attribute_value=av) for av in attribute_values]
            )
        return instance


class StockNotificationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variation_sku = serializers.CharField(source="variation.sku", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = StockNotification
        fields = [
            "id",
            "product",
            "variation",
            "product_name",
            "variation_sku",
            "user",
            "user_email",
            "customer_name",
            "phone",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        if attrs["variation"].product_id != attrs["product"].id:
            raise serializers.ValidationError({"variation": "This variation does not belong to the selected product."})
        if attrs["variation"].stock_quantity > 0:
            raise serializers.ValidationError({"variation": "This variation is currently in stock."})
        return attrs

class ProductSerializer(serializers.ModelSerializer):
    categories = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), many=True)
    category_names = serializers.StringRelatedField(source="categories", many=True, read_only=True)
    attribute_values = ProductAttributeValueSerializer(
        source="product_attribute_values", many=True, read_only=True
    )
    attribute_value_ids = serializers.PrimaryKeyRelatedField(
        queryset=AttributeValue.objects.all(), many=True, write_only=True, required=False
    )
    variations = ProductVariationSerializer(many=True, required=False)
    images = ProductImageSerializer(many=True, read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "categories",
            "category_names",
            "name",
            "slug",
            "description",
            "product_type",
            "visibility_type",
            "status",
            "sku_prefix",
            "attribute_values",
            "attribute_value_ids",
            "variations",
            "images",
            "average_rating",
            "review_count",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def get_average_rating(self, obj):
        avg = obj.reviews.aggregate(avg=Avg("rating"))["avg"]
        return round(avg, 2) if avg is not None else None

    def get_review_count(self, obj):
        return obj.reviews.count()

    def validate(self, attrs):
        if self.instance is None:
            product_type = attrs.get("product_type", Product.ProductType.SIMPLE)
            if product_type == Product.ProductType.VARIABLE and not attrs.get("variations"):
                raise serializers.ValidationError(
                    {"variations": "A variable product needs at least one variation."}
                )
        categories = attrs.get("categories")
        if categories is not None and len(categories) == 0:
            raise serializers.ValidationError(
                {"categories": "A product must have at least one category."}
            )
        return attrs

    def create(self, validated_data):
        attribute_value_ids = validated_data.pop("attribute_value_ids", [])
        variations_data = validated_data.pop("variations", [])
        categories = validated_data.pop("categories", [])
        product = Product.objects.create(**validated_data)
        product.categories.set(categories)

        ProductAttributeValue.objects.bulk_create(
            [ProductAttributeValue(product=product, attribute_value=av) for av in attribute_value_ids]
        )

        if not variations_data:
            variations_data = [
                {
                    "sku": f"{product.sku_prefix or product.slug}-DEFAULT",
                    "price": 0,
                    "stock_quantity": 0,
                }
            ]

        for variation_data in variations_data:
            variation_data["product"] = product
            ProductVariationSerializer().create(variation_data)

        return product

    def update(self, instance, validated_data):
        validated_data.pop("attribute_value_ids", None)
        validated_data.pop("variations", None)
        categories = validated_data.pop("categories", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if categories is not None:
            instance.categories.set(categories)
        return instance


class ProductAddonSerializer(serializers.ModelSerializer):
    addon_product_detail = ProductSerializer(source="addon_product", read_only=True)

    class Meta:
        model = ProductAddon
        fields = [
            "id",
            "parent_product",
            "addon_product",
            "addon_product_detail",
            "is_required",
            "min_select",
            "max_select",
            "price_override",
            "sort_order",
        ]
