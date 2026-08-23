from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product, ProductVariation
from apps.users.models import Address


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    order_number = models.CharField(max_length=32, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    guest_email = models.EmailField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    shipping_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=10, decimal_places=2)
    # SET_NULL (not PROTECT) so a customer can delete a saved address even
    # after it's been used on a past order — the order keeps its own
    # snapshot-free record either way, it just loses the address link.
    shipping_address = models.ForeignKey(
        Address, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipping_orders"
    )
    billing_address = models.ForeignKey(
        Address, on_delete=models.SET_NULL, null=True, blank=True, related_name="billing_orders"
    )
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    placed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orders"

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    variation = models.ForeignKey(ProductVariation, on_delete=models.PROTECT, related_name="order_items")
    product_name_snapshot = models.CharField(max_length=255)
    variation_label_snapshot = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    parent_order_item = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )

    class Meta:
        db_table = "order_items"

    def __str__(self):
        return f"{self.product_name_snapshot} x{self.quantity}"


class Payment(models.Model):
    class Method(models.TextChoices):
        COD = "cod", "Cash on Delivery"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.COD)
    transaction_id = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments"

    def __str__(self):
        return f"Payment for {self.order.order_number} ({self.status})"


class Coupon(models.Model):
    class Type(models.TextChoices):
        FLAT = "flat", "Flat"
        PERCENT = "percent", "Percent"

    code = models.CharField(max_length=50, unique=True)
    type = models.CharField(max_length=10, choices=Type.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "coupons"

    def __str__(self):
        return self.code

    def is_valid_for(self, subtotal):
        now = timezone.now()
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        if subtotal < self.min_order_amount:
            return False
        if self.usage_limit is not None and self.order_coupons.count() >= self.usage_limit:
            return False
        return True

    def compute_discount(self, subtotal):
        if self.type == self.Type.FLAT:
            discount = self.value
        else:
            discount = subtotal * self.value / Decimal("100")
        return min(discount, subtotal)


class OrderCoupon(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="order_coupons")
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="order_coupons")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "order_coupons"
        unique_together = ("order", "coupon")

    def __str__(self):
        return f"{self.order.order_number} - {self.coupon.code}"
