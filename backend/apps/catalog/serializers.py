import re
from decimal import Decimal

from django.db.models import Avg, Max, Min
from rest_framework import serializers

from .models import (
    Attribute,
    AttributeValue,
    Category,
    Discount,
    Product,
    ProductAddon,
    ProductAttributeValue,
    ProductColor,
    ProductImage,
    ProductVariation,
    StockNotification,
    VariationAttributeValue,
    is_color_attribute,
)
from .pricing import categories_with_descendants, pricing_engine_for
from .promotions import PromotionEngine

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
DEFAULT_COLOR_HEX = "#D1D5DB"


def normalize_hex(value):
    value = (value or "").strip()
    if not value:
        return ""
    if not HEX_COLOR_RE.match(value):
        raise serializers.ValidationError("Use a hex colour like #000000.")
    return value.upper()


def absolute_file_url(request, field_file):
    if not field_file:
        return None
    url = field_file.url
    return request.build_absolute_uri(url) if request else url


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "image",
            "parent",
            "parent_name",
            "products_count",
            "description",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent_id else None

    def get_products_count(self, obj):
        counts = self.context.get("category_product_counts")
        return counts.get(obj.pk, 0) if counts is not None else None


class CategoryDetailSerializer(CategorySerializer):
    children = CategorySerializer(many=True, read_only=True)

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ["children"]


class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ["id", "attribute", "value", "hex_code", "sort_order"]

    def validate_hex_code(self, value):
        return normalize_hex(value)


class AttributeSerializer(serializers.ModelSerializer):
    values = AttributeValueSerializer(many=True, read_only=True)

    class Meta:
        model = Attribute
        fields = ["id", "name", "values"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "variation", "image", "alt_text", "sort_order", "is_primary"]


class ProductColorSerializer(serializers.ModelSerializer):
    """Product-specific color config; the color identity is the shared
    AttributeValue used by variations."""

    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    attribute_value = serializers.IntegerField(source="attribute_value_id", read_only=True)
    name = serializers.CharField(max_length=100)
    hex_code = serializers.CharField(max_length=7, required=False, allow_blank=True)
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    remove_image = serializers.BooleanField(required=False, default=False, write_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductColor
        fields = [
            "id",
            "product",
            "attribute_value",
            "name",
            "hex_code",
            "image",
            "remove_image",
            "image_url",
            "is_active",
            "sort_order",
        ]

    def get_image_url(self, obj):
        return absolute_file_url(self.context.get("request"), obj.image)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Color name is required.")
        return value

    def validate_hex_code(self, value):
        return normalize_hex(value)

    def _color_attribute(self):
        return Attribute.objects.filter(name__iexact="Color").first() or Attribute.objects.create(
            name="Color"
        )

    def create(self, validated_data):
        product = validated_data.pop("product")
        name = validated_data.pop("name")
        hex_code = validated_data.pop("hex_code", "")
        validated_data.pop("remove_image", None)

        attribute = self._color_attribute()
        attribute_value = AttributeValue.objects.filter(
            attribute=attribute, value__iexact=name
        ).first()
        if attribute_value is None:
            attribute_value = AttributeValue.objects.create(
                attribute=attribute, value=name, hex_code=hex_code
            )
        elif hex_code:
            attribute_value.hex_code = hex_code
            attribute_value.save(update_fields=["hex_code"])

        if ProductColor.objects.filter(product=product, attribute_value=attribute_value).exists():
            raise serializers.ValidationError(
                {"name": ["This color is already added to the product."]}
            )

        ProductAttributeValue.objects.get_or_create(
            product=product, attribute_value=attribute_value
        )

        if "sort_order" not in validated_data:
            highest = ProductColor.objects.filter(product=product).aggregate(
                value=Max("sort_order")
            )["value"]
            validated_data["sort_order"] = 0 if highest is None else highest + 1

        return ProductColor.objects.create(
            product=product, attribute_value=attribute_value, **validated_data
        )

    def update(self, instance, validated_data):
        validated_data.pop("product", None)
        name = validated_data.pop("name", None)
        hex_code = validated_data.pop("hex_code", None)
        if validated_data.pop("remove_image", False) and "image" not in validated_data:
            validated_data["image"] = ""

        attribute_value = instance.attribute_value
        if name is not None and name != attribute_value.value:
            conflict = (
                AttributeValue.objects.filter(
                    attribute=attribute_value.attribute, value__iexact=name
                )
                .exclude(pk=attribute_value.pk)
                .exists()
            )
            if conflict:
                raise serializers.ValidationError(
                    {"name": ["Another color already uses this name."]}
                )
            attribute_value.value = name
        if hex_code is not None:
            attribute_value.hex_code = hex_code
        attribute_value.save()

        ProductAttributeValue.objects.get_or_create(
            product=instance.product, attribute_value=attribute_value
        )
        return super().update(instance, validated_data)


class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute = serializers.CharField(source="attribute_value.attribute.name", read_only=True)
    value = serializers.CharField(source="attribute_value.value", read_only=True)
    hex_code = serializers.CharField(source="attribute_value.hex_code", read_only=True)

    class Meta:
        model = ProductAttributeValue
        fields = ["id", "product", "attribute_value", "attribute", "value", "hex_code"]


class VariationAttributeValueReadSerializer(serializers.ModelSerializer):
    attribute = serializers.CharField(source="attribute_value.attribute.name", read_only=True)
    value = serializers.CharField(source="attribute_value.value", read_only=True)
    hex_code = serializers.CharField(source="attribute_value.hex_code", read_only=True)

    class Meta:
        model = VariationAttributeValue
        fields = ["attribute_value", "attribute", "value", "hex_code"]


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
    colors = serializers.SerializerMethodField()
    has_addons = serializers.SerializerMethodField()
    minimum_purchase_offers = serializers.SerializerMethodField()
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
            "colors",
            "has_addons",
            "minimum_purchase_offers",
            "average_rating",
            "review_count",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def get_has_addons(self, obj):
        count = getattr(obj, "addon_count", None)
        return bool(count) if count is not None else obj.addon_links.exists()

    def get_minimum_purchase_offers(self, obj):
        """Live "spend ৳Y, get X% off" offers that target this product, so the
        product page can advertise the offer before it's in the cart."""
        if self.context is None:
            return []
        cache = self.context.setdefault("threshold_configs", {})
        if obj.pk not in cache:
            engine = self.context.get("promotion_engine")
            if engine is None:
                engine = self.context["promotion_engine"] = PromotionEngine()
            category_ids = [category.pk for category in obj.categories.all()]
            cache[obj.pk] = engine.threshold_configs_for([obj.pk], category_ids)
        return cache[obj.pk]

    def get_colors(self, obj):
        request = self.context.get("request")
        configs = {pc.attribute_value_id: pc for pc in obj.product_colors.all()}
        values = {pc.attribute_value_id: pc.attribute_value for pc in configs.values()}

        for product_value in obj.product_attribute_values.all():
            attribute_value = product_value.attribute_value
            if is_color_attribute(attribute_value.attribute.name):
                values.setdefault(attribute_value.id, attribute_value)

        variation_images = {}
        for variation in obj.variations.all():
            images = list(variation.images.all())
            for variation_value in variation.variation_attribute_values.all():
                attribute_value = variation_value.attribute_value
                if is_color_attribute(attribute_value.attribute.name):
                    values.setdefault(attribute_value.id, attribute_value)
                    if images and attribute_value.id not in variation_images:
                        variation_images[attribute_value.id] = images[0]

        inactive = {
            color.attribute_value_id for color in configs.values() if not color.is_active
        }

        colors = []
        for attribute_value_id, attribute_value in values.items():
            if attribute_value_id in inactive:
                continue
            config = configs.get(attribute_value_id)
            image = (
                config.image
                if config and config.image
                else variation_images.get(attribute_value_id)
            )
            colors.append(
                {
                    "attribute_value": attribute_value_id,
                    "name": attribute_value.value,
                    "hex_code": attribute_value.hex_code or DEFAULT_COLOR_HEX,
                    "image_url": absolute_file_url(request, image),
                    "is_active": True,
                    "sort_order": config.sort_order if config else attribute_value.sort_order,
                }
            )

        colors.sort(key=lambda color: (color["sort_order"], color["name"].lower()))
        return colors

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
    min_purchase_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    max_discount_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
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
            "min_purchase_amount",
            "max_discount_amount",
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
            for field in (
                "min_quantity",
                "percent_off",
                "free_quantity",
                "bundle_price",
                "min_purchase_amount",
                "max_discount_amount",
            ):
                clear(field)
            return

        # Basket-level offer: `value` is never used.
        clear("value")

        if discount_type == Discount.Type.MIN_PURCHASE:
            if current("percent_off") is None:
                errors["percent_off"] = ["Enter the discount percentage."]
            if current("min_purchase_amount") is None:
                errors["min_purchase_amount"] = ["Enter the minimum purchase amount."]
            elif current("min_purchase_amount") <= 0:
                errors["min_purchase_amount"] = ["The minimum purchase amount must be greater than 0."]
            cap = current("max_discount_amount")
            if cap is not None and cap <= 0:
                errors["max_discount_amount"] = ["The maximum discount must be greater than 0."]
            for field in ("min_quantity", "free_quantity", "bundle_price"):
                clear(field)
            return

        if discount_type in (
            Discount.Type.BXGY_PERCENT,
            Discount.Type.BXGY_FREE,
            Discount.Type.LOWEST_FREE,
            Discount.Type.BUNDLE_PRICE,
        ) and current("min_quantity") is None:
            errors["min_quantity"] = ["Enter the required quantity."]

        for field in ("min_purchase_amount", "max_discount_amount"):
            clear(field)

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
