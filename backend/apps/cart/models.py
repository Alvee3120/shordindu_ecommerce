import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import Product, ProductVariation


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="cart"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "carts"

    def __str__(self):
        return f"Cart {self.id} ({'user:' + str(self.user_id) if self.user_id else 'guest'})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
    variation = models.ForeignKey(ProductVariation, on_delete=models.CASCADE, related_name="cart_items")
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    parent_cart_item = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    unit_price_snapshot = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "cart_items"

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"
