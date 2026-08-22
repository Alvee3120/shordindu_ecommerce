from rest_framework import serializers

from apps.orders.models import Order, OrderItem

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    user_name = serializers.CharField(source="user.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    is_verified_purchase = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "user",
            "user_name",
            "rating",
            "title",
            "comment",
            "image",
            "status",
            "is_verified_purchase",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]

    def get_is_verified_purchase(self, obj):
        return OrderItem.objects.filter(
            order__user_id=obj.user_id,
            product_id=obj.product_id,
            order__status=Order.Status.DELIVERED,
        ).exists()

    def create(self, validated_data):
        validated_data["status"] = Review.Status.PENDING
        return super().create(validated_data)
