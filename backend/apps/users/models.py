from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models import Q


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        # Accounts created by an administrator may have no email: their phone
        # number is the sign-in identity instead. Public signup still requires
        # an email (enforced by SignupSerializer).
        if email:
            email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.CUSTOMER)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        CCE = "cce", "CCE (Customer Care Executive)"
        ADMIN = "admin", "Admin"

    class CreatedVia(models.TextChoices):
        SELF = "self", "Self signup"
        CHECKOUT = "checkout", "Checkout"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True, null=True, blank=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    force_password_change = models.BooleanField(default=False)

    created_via = models.CharField(max_length=20, choices=CreatedVia.choices, default=CreatedVia.SELF)
    created_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="created_users"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=~Q(phone=""),
                name="uniq_user_phone_nonblank",
            )
        ]

    def __str__(self):
        return self.email or self.phone or self.name


class Address(models.Model):
    # user is nullable so a guest checkout (no account created) can still
    # have an address row for orders.shipping_address_id to point to.
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="addresses")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField()
    district = models.CharField(max_length=100)
    # Only set for Dhaka-district addresses (Dhaka Sadar, Savar, ...) — it
    # decides which delivery-charge tier applies (see apps.orders.pricing).
    zone = models.CharField(max_length=100, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "addresses"

    def __str__(self):
        return f"{self.name} - {self.district}"
