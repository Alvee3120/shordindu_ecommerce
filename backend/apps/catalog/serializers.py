from decimal import Decimal

from django.db.models import Avg, Min
from rest_framework import serializers

from .models import (
    Attribute,
    AttributeValue,
    Category,
    Discount,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductImage,
    ProductVariation,
    StockNotification,
    VariationAttributeValue,
)
from .pricing import categories_with_descendants, pricing_engine_for


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
    # `price` is always the base price (what admins edit). These two are the
    # price customers pay right now, after any live automatic discount.
    effective_price = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariation
        fields = [
            "id",
            "product",
            "sku",
            "price",
            "compare_at_price",
            "effective_price",
            "discount",
            "stock_quantity",
            "is_active",
            "attribute_values",
            "attribute_value_ids",
            "images",
        ]

    def _quote(self, obj):
        cache = self.context.setdefault("price_quotes", {}) if self.context is not None else {}
        if obj.pk not in cache:
            cache[obj.pk] = pricing_engine_for(self.context).quote(obj)
        return cache[obj.pk]

    def get_effective_price(self, obj):
        return serializers.DecimalField(max_digits=10, decimal_places=2).to_representation(
            self._quote(obj).final_price
        )

    def get_discount(self, obj):
        info = self._quote(obj).discount_info()
        if info is None:
            return None
        money = serializers.DecimalField(max_digits=10, decimal_places=2)
        return {**info, "value": money.to_representation(info["value"]), "amount": money.to_representation(info["amount"])}

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
        avg = obj.reviews.filter(status="approved").aggregate(avg=Avg("rating"))["avg"]
        return round(avg, 2) if avg is not None else None

    def get_review_count(self, obj):
        return obj.reviews.filter(status="approved").count()

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


class DiscountSerializer(serializers.ModelSerializer):
    """Admin CRUD for automatic discounts. The backend is the final authority
    on every rule here — the dashboard form only mirrors these checks."""

    value = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    min_quantity = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    percent_off = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100"),
        required=False, allow_null=True,
    )
    free_quantity = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    bundle_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    free_same_product = serializers.BooleanField(required=False)
    categories = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), many=True, required=False)
    products = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), many=True, required=False)
    category_names = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    product_details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            "id",
            "name",
            "type",
            "value",
            "min_quantity",
            "percent_off",
            "free_quantity",
            "bundle_price",
            "free_same_product",
            "target_type",
            "categories",
            "category_names",
            "products",
            "product_count",
            "product_details",
            "starts_at",
            "ends_at",
            "is_active",
            "status",
            "label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_label(self, obj):
        return obj.label()

    def get_category_names(self, obj):
        return " › ".join(category.name for category in obj.categories.all())

    def get_status(self, obj):
        return obj.status_at()

    def get_product_count(self, obj):
        return len(obj.products.all())

    def get_product_details(self, obj):
        # Only on the detail view (the editor needs names/images to show).
        if self.context.get("view") is not None and getattr(self.context["view"], "action", None) != "retrieve":
            return None
        request = self.context.get("request")
        details = []
        for product in obj.products.all():
            images = list(product.images.all())
            image = next((img for img in images if img.is_primary), images[0] if images else None)
            variations = list(product.variations.all())
            details.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "status": product.status,
                    "sku": variations[0].sku if len(variations) == 1 else product.sku_prefix or None,
                    "image": request.build_absolute_uri(image.image.url) if image and request else None,
                    "min_price": str(min((v.price for v in variations), default=Decimal("0"))),
                }
            )
        return details

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give the discount a name.")
        return value

    def validate(self, attrs):
        instance = self.instance

        def final(name, default=None):
            if name in attrs:
                return attrs[name]
            if instance is None:
                return default
            if name == "products":
                return list(instance.products.all())
            if name == "categories":
                return list(instance.categories.all())
            return getattr(instance, name)

        errors = {}
        discount_type = final("type")

        starts_at, ends_at = final("starts_at"), final("ends_at")
        if starts_at and ends_at and ends_at <= starts_at:
            errors["ends_at"] = ["The end must be after the start."]

        target_type = final("target_type")
        categories = final("categories")
        products = final("products", [])
        if target_type == Discount.Target.CATEGORY:
            if not categories:
                errors["categories"] = ["Choose at least one category."]
            attrs["products"] = []
        elif target_type == Discount.Target.PRODUCTS:
            if not products:
                errors["products"] = ["Choose at least one product."]
            attrs["categories"] = []

        self._validate_offer(discount_type, attrs, instance, errors)

        if errors:
            raise serializers.ValidationError(errors)

        if discount_type == Discount.Type.FIXED:
            self._check_fixed_amount(final("value"), target_type, categories, products)
        return attrs

    @staticmethod
    def _validate_offer(discount_type, attrs, instance, errors):
        """Validate the fields the chosen offer type uses and clear the rest.

        A field is only cleared when it (or the type) is part of this request, so
        an unrelated PATCH never wipes a stored configuration.
        """

        def current(name):
            if name in attrs:
                return attrs[name]
            return getattr(instance, name) if instance is not None else None

        def clear(name):
            if name in attrs or "type" in attrs:
                attrs[name] = None

        if discount_type in Discount.PER_ITEM_TYPES:
            value = current("value")
            if value is None:
                errors["value"] = ["Enter a discount value."]
            elif value <= 0:
                errors["value"] = ["The value must be greater than 0."]
            elif discount_type == Discount.Type.PERCENT and value > 100:
                errors["value"] = ["A percentage discount can't be more than 100%."]
            for field in ("min_quantity", "percent_off", "free_quantity", "bundle_price"):
                clear(field)
            return

        # Basket-level offer: `value` is never used.
        clear("value")
        if discount_type in (
            Discount.Type.BXGY_PERCENT,
            Discount.Type.BXGY_FREE,
            Discount.Type.LOWEST_FREE,
            Discount.Type.BUNDLE_PRICE,
        ) and current("min_quantity") is None:
            errors["min_quantity"] = ["Enter the required quantity."]

        if discount_type == Discount.Type.BXGY_PERCENT:
            if current("percent_off") is None:
                errors["percent_off"] = ["Enter the discount percentage."]
            clear("free_quantity")
            clear("bundle_price")
        elif discount_type == Discount.Type.BXGY_FREE:
            if current("free_quantity") is None:
                errors["free_quantity"] = ["Enter how many items are free."]
            clear("percent_off")
            clear("bundle_price")
        elif discount_type == Discount.Type.BUNDLE_PRICE:
            if current("bundle_price") is None:
                errors["bundle_price"] = ["Enter the bundle price."]
            clear("percent_off")
            clear("free_quantity")
        else:  # lowest_free / three_for_two
            clear("percent_off")
            clear("free_quantity")
            clear("bundle_price")

    @staticmethod
    def _check_fixed_amount(value, target_type, categories, products):
        """A fixed discount must not exceed the price of anything it targets."""
        variations = ProductVariation.objects.filter(is_active=True)
        if target_type == Discount.Target.CATEGORY:
            ids = categories_with_descendants([category.pk for category in categories])
            variations = variations.filter(product__categories__in=ids)
        else:
            variations = variations.filter(product__in=products)
        cheapest = variations.aggregate(price=Min("price"))["price"]
        if cheapest is not None and value > cheapest:
            raise serializers.ValidationError(
                {
                    "value": [
                        f"৳{value} is more than the cheapest targeted item (৳{cheapest}) — "
                        "its price would go below zero."
                    ]
                }
            )

    def create(self, validated_data):
        products = validated_data.pop("products", [])
        categories = validated_data.pop("categories", [])
        discount = Discount.objects.create(**validated_data)
        discount.products.set(products)
        discount.categories.set(categories)
        return discount

    def update(self, instance, validated_data):
        products = validated_data.pop("products", None)
        categories = validated_data.pop("categories", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if products is not None:
            instance.products.set(products)
        if categories is not None:
            instance.categories.set(categories)
        return instance
