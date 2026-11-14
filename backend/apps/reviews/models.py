from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
        null=True,
        blank=True,
    )
    customer_name = models.CharField(max_length=150, blank=True)
    customer_email = models.EmailField(blank=True)
    avatar = models.ImageField(upload_to="reviews/avatars/", blank=True, null=True)

    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=150, blank=True)
    comment = models.TextField(blank=True)
    image = models.ImageField(upload_to="reviews/", blank=True, null=True)

    verified_purchase = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    review_date = models.DateField(default=timezone.localdate)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_reviews",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviews"
        unique_together = ("product", "user")
        ordering = ["-review_date", "-created_at", "-id"]

    def __str__(self):
        name = self.customer_name or (self.user.name if self.user_id else "Customer")
        return f"{self.product.name} - {self.rating}★ by {name}"


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="reviews/")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "review_images"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"Image {self.pk} for review {self.review_id}"
