from rest_framework import serializers

from .models import (
    Attribute,
    AttributeValue,
    Category,
    Product,
    ProductAttributeValue,
    ProductImage,
    ProductVariation,
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


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    attribute_values = ProductAttributeValueSerializer(
        source="product_attribute_values", many=True, read_only=True
    )
    attribute_value_ids = serializers.PrimaryKeyRelatedField(
        queryset=AttributeValue.objects.all(), many=True, write_only=True, required=False
    )
    variations = ProductVariationSerializer(many=True, required=False)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_name",
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
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        if self.instance is None:
            product_type = attrs.get("product_type", Product.ProductType.SIMPLE)
            if product_type == Product.ProductType.VARIABLE and not attrs.get("variations"):
                raise serializers.ValidationError(
                    {"variations": "A variable product needs at least one variation."}
                )
        return attrs

    def create(self, validated_data):
        attribute_value_ids = validated_data.pop("attribute_value_ids", [])
        variations_data = validated_data.pop("variations", [])
        product = Product.objects.create(**validated_data)

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
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
