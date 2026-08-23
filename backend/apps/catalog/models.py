from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children"
    )
    description = models.TextField(blank=True)

    class Meta:
        db_table = "categories"
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.name)
        slug = base_slug
        n = 2
        while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{n}"
            n += 1
        return slug


class Attribute(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "attributes"

    def __str__(self):
        return self.name


class AttributeValue(models.Model):
    attribute = models.ForeignKey(Attribute, on_delete=models.CASCADE, related_name="values")
    value = models.CharField(max_length=100)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "attribute_values"
        ordering = ["sort_order", "id"]
        unique_together = ("attribute", "value")

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"


class Product(models.Model):
    class ProductType(models.TextChoices):
        SIMPLE = "simple", "Simple"
        VARIABLE = "variable", "Variable"

    class VisibilityType(models.TextChoices):
        STANDALONE = "standalone", "Standalone"
        ADDON_ONLY = "addon_only", "Addon only"
        BOTH = "both", "Both"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    categories = models.ManyToManyField(Category, related_name="products")
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    product_type = models.CharField(max_length=20, choices=ProductType.choices, default=ProductType.SIMPLE)
    visibility_type = models.CharField(
        max_length=20, choices=VisibilityType.choices, default=VisibilityType.STANDALONE
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    sku_prefix = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        base_slug = slugify(self.name)
        slug = base_slug
        n = 2
        while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{n}"
            n += 1
        return slug


class ProductAttributeValue(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="product_attribute_values")
    attribute_value = models.ForeignKey(
        AttributeValue, on_delete=models.CASCADE, related_name="product_attribute_values"
    )

    class Meta:
        db_table = "product_attribute_values"
        unique_together = ("product", "attribute_value")

    def __str__(self):
        return f"{self.product.name} - {self.attribute_value}"


class ProductVariation(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variations")
    sku = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "product_variations"

    def __str__(self):
        return self.sku


class VariationAttributeValue(models.Model):
    variation = models.ForeignKey(
        ProductVariation, on_delete=models.CASCADE, related_name="variation_attribute_values"
    )
    attribute_value = models.ForeignKey(
        AttributeValue, on_delete=models.CASCADE, related_name="variation_attribute_values"
    )

    class Meta:
        db_table = "variation_attribute_values"
        unique_together = ("variation", "attribute_value")

    def __str__(self):
        return f"{self.variation.sku} - {self.attribute_value}"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    variation = models.ForeignKey(
        ProductVariation, on_delete=models.CASCADE, null=True, blank=True, related_name="images"
    )
    image = models.ImageField(upload_to="products/")
    alt_text = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "product_images"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.product.name} image {self.id}"


class ProductAddon(models.Model):
    parent_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="addon_links")
    addon_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="parent_links")
    is_required = models.BooleanField(default=False)
    min_select = models.PositiveIntegerField(default=0)
    max_select = models.PositiveIntegerField(default=1)
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "product_addons"
        ordering = ["sort_order", "id"]
        unique_together = ("parent_product", "addon_product")

    def __str__(self):
        return f"{self.parent_product.name} -> {self.addon_product.name}"


class InventoryLog(models.Model):
    variation = models.ForeignKey(ProductVariation, on_delete=models.CASCADE, related_name="inventory_logs")
    change_qty = models.IntegerField()
    reason = models.CharField(max_length=100)
    reference_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.variation.sku} {self.change_qty:+d} ({self.reason})"
