from django.db.models import Q
from django.utils import timezone
from PIL import Image
from rest_framework import serializers

from apps.orders.models import Order, OrderItem

from .models import Review, ReviewImage

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_REVIEW_IMAGES = 5


def validate_review_image(image):
    if image.size > MAX_IMAGE_BYTES:
        raise serializers.ValidationError("Images must be 5 MB or smaller.")

    # Serializer ImageFields populate `.image` (Pillow); raw multipart files
    # attached in the view don't, so inspect those directly.
    fmt = getattr(getattr(image, "image", None), "format", None)
    if not fmt:
        try:
            with Image.open(image) as inspected:
                fmt = inspected.format
        except Exception:
            raise serializers.ValidationError("Upload a valid image file.")
        finally:
            image.seek(0)

    if fmt and fmt.upper() not in ALLOWED_IMAGE_FORMATS:
        raise serializers.ValidationError("Use a JPEG, PNG or WebP image.")
    return image


def _absolute(request, field_file):
    if not field_file:
        return None
    url = field_file.url
    return request.build_absolute_uri(url) if request else url


def has_delivered_purchase(review):
    """A review only earns a verified badge when a delivered order supports it."""
    if review.user_id:
        return OrderItem.objects.filter(
            order__user_id=review.user_id,
            product_id=review.product_id,
            order__status=Order.Status.DELIVERED,
        ).exists()

    email = (review.customer_email or "").strip()
    if not email:
        return False
    return (
        OrderItem.objects.filter(
            product_id=review.product_id,
            order__status=Order.Status.DELIVERED,
        )
        .filter(Q(order__user__email__iexact=email) | Q(order__guest_email__iexact=email))
        .exists()
    )


def is_verified(review):
    return bool(review.verified_purchase and has_delivered_purchase(review))


def review_image_urls(review, request):
    urls = []
    if review.image:
        urls.append(_absolute(request, review.image))
    for image in review.images.all():
        urls.append(_absolute(request, image.image))
    return [url for url in urls if url]


class ReviewSerializer(serializers.ModelSerializer):
    """Public/customer API. Creation still forces a pending review."""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    user_name = serializers.CharField(source="user.name", read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    is_verified_purchase = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "user",
            "user_name",
            "display_name",
            "avatar_url",
            "rating",
            "title",
            "comment",
            "image",
            "images",
            "status",
            "is_verified_purchase",
            "review_date",
            "created_at",
        ]
        read_only_fields = ["status", "review_date", "created_at"]

    def get_display_name(self, obj):
        return obj.customer_name or (obj.user.name if obj.user_id else "Customer")

    def get_avatar_url(self, obj):
        return _absolute(self.context.get("request"), obj.avatar)

    def get_images(self, obj):
        return review_image_urls(obj, self.context.get("request"))

    def get_is_verified_purchase(self, obj):
        return is_verified(obj)

    def validate_image(self, image):
        return validate_review_image(image) if image else image

    def create(self, validated_data):
        product = validated_data["product"]
        user = validated_data["user"]
        validated_data["status"] = Review.Status.PENDING
        validated_data["review_date"] = timezone.localdate()
        validated_data["verified_purchase"] = OrderItem.objects.filter(
            order__user=user,
            product=product,
            order__status=Order.Status.DELIVERED,
        ).exists()
        return super().create(validated_data)


class AdminReviewImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ReviewImage
        fields = ["id", "image_url", "sort_order"]

    def get_image_url(self, obj):
        return _absolute(self.context.get("request"), obj.image)


class AdminReviewSerializer(serializers.ModelSerializer):
    """Admin/CCE management. Manual reviews have no linked user account."""

    user = serializers.IntegerField(source="user_id", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    display_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False, allow_null=True, write_only=True)
    avatar_url = serializers.SerializerMethodField()
    remove_avatar = serializers.BooleanField(required=False, default=False, write_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    image = serializers.ImageField(read_only=True)
    remove_legacy_image = serializers.BooleanField(required=False, default=False, write_only=True)
    images = AdminReviewImageSerializer(many=True, read_only=True)
    status = serializers.ChoiceField(choices=Review.Status.choices, required=False)
    is_verified_purchase = serializers.SerializerMethodField()
    created_by = serializers.IntegerField(source="created_by_id", read_only=True)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, default=None)

    class Meta:
        model = Review
        fields = [
            "id",
            "user",
            "user_name",
            "user_email",
            "customer_name",
            "customer_email",
            "display_name",
            "avatar",
            "avatar_url",
            "remove_avatar",
            "product",
            "product_name",
            "rating",
            "title",
            "comment",
            "image",
            "remove_legacy_image",
            "images",
            "review_date",
            "status",
            "verified_purchase",
            "is_verified_purchase",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_by", "created_at", "updated_at"]

    def get_display_name(self, obj):
        return obj.customer_name or (obj.user.name if obj.user_id else "Customer")

    def get_avatar_url(self, obj):
        return _absolute(self.context.get("request"), obj.avatar)

    def get_is_verified_purchase(self, obj):
        return is_verified(obj)

    def validate_customer_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Customer name is required.")
        return value

    def validate_customer_email(self, value):
        return (value or "").strip().lower()

    def validate_comment(self, value):
        value = (value or "").strip()
        if self.instance is None or "comment" in self.initial_data:
            if not value:
                raise serializers.ValidationError("Review description is required.")
        return value

    def validate_avatar(self, image):
        return validate_review_image(image) if image else image

    def validate(self, attrs):
        instance = self.instance
        if instance is None:
            if not (attrs.get("customer_name") or "").strip():
                raise serializers.ValidationError({"customer_name": ["Customer name is required."]})
            if not (attrs.get("comment") or "").strip():
                raise serializers.ValidationError({"comment": ["Review description is required."]})

        product = attrs.get("product") or getattr(instance, "product", None)
        email = (
            attrs["customer_email"]
            if "customer_email" in attrs
            else getattr(instance, "customer_email", "")
        )
        email = (email or "").strip().lower()
        if email and product:
            duplicates = Review.objects.filter(product=product).filter(
                Q(customer_email__iexact=email) | Q(user__email__iexact=email)
            )
            if instance is not None:
                duplicates = duplicates.exclude(pk=instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {"customer_email": ["A review for this customer and product already exists."]}
                )
        return attrs

    def create(self, validated_data):
        validated_data.pop("remove_avatar", None)
        validated_data.pop("remove_legacy_image", None)
        validated_data.setdefault("review_date", timezone.localdate())
        validated_data["user"] = None
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.pop("remove_avatar", False) and "avatar" not in validated_data:
            validated_data["avatar"] = ""
        if validated_data.pop("remove_legacy_image", False) and "image" not in validated_data:
            validated_data["image"] = ""
        instance.updated_at = timezone.now()
        return super().update(instance, validated_data)
