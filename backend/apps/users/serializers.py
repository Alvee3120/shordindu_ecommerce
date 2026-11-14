from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Address, User


def validate_new_password(value, user=None):
    """Run Django's password validators and surface their messages as DRF
    field errors instead of a 500."""
    try:
        validate_password(value, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return value


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role", "force_password_change", "created_at"]
        read_only_fields = fields


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "phone"]

    def validate_phone(self, value):
        phone = (value or "").strip()
        if not phone:
            return phone
        existing = User.objects.filter(phone=phone)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return phone


class AdminUserSerializer(serializers.ModelSerializer):
    """Used by the admin User Management screen: administrators can edit
    profile fields, role and active status for another account. The account's
    origin (created_via / created_by) is read-only."""

    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True, validators=[])
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "phone",
            "role",
            "is_active",
            "created_via",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_via", "created_by", "created_by_name", "created_at"]

    def validate_phone(self, value):
        phone = (value or "").strip()
        if not phone:
            raise serializers.ValidationError("Phone number is required.")
        existing = User.objects.filter(phone=phone)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return phone

    def validate_email(self, value):
        if value is None or not value.strip():
            return None
        email = value.strip().lower()
        existing = User.objects.filter(email=email)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def update(self, instance, validated_data):
        # is_staff only controls access to Django's built-in admin. CCE users
        # do not receive it; their limited order permissions are role-based.
        role = validated_data.get("role", instance.role)
        instance.is_staff = role == User.Role.ADMIN
        return super().update(instance, validated_data)


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Admin-initiated account creation. The password is set here (never from
    the client's raw hash) and the account is tagged with its origin."""

    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True, validators=[])
    phone = serializers.CharField(required=True, allow_blank=False)
    role = serializers.ChoiceField(choices=User.Role.choices, required=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
    created_by_name = serializers.CharField(source="created_by.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "password",
            "confirm_password",
            "role",
            "is_active",
            "created_via",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_via", "created_by_name", "created_at"]

    def validate_phone(self, value):
        phone = (value or "").strip()
        if not phone:
            raise serializers.ValidationError("Phone number is required.")
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return phone

    def validate_email(self, value):
        if value is None or not value.strip():
            return None
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, attrs):
        password = attrs.get("password")
        if password != attrs.get("confirm_password"):
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})

        candidate = User(
            name=attrs.get("name", ""),
            email=attrs.get("email"),
            phone=attrs.get("phone", ""),
        )
        validate_new_password(password, candidate)
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        email = validated_data.pop("email", None)
        request = self.context.get("request")
        role = validated_data.get("role", User.Role.CUSTOMER)

        user = User.objects.create_user(
            email=email,
            password=password,
            created_via=User.CreatedVia.ADMIN,
            created_by=request.user if request else None,
            is_staff=role == User.Role.ADMIN,
            **validated_data,
        )
        return user


class AdminPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        validate_new_password(attrs["new_password"], self.context.get("user"))
        return attrs


class SignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, validators=[validate_password])

    class Meta:
        model = User
        fields = ["email", "name", "phone", "password"]

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_phone(self, value):
        phone = (value or "").strip()
        if phone and User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return phone

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class SigninSerializer(serializers.Serializer):
    # `email` is kept as the field name for API compatibility, but it accepts
    # either an email address or a phone number. Admin-created accounts may
    # have no email at all, in which case the phone is the only identity.
    email = serializers.CharField(required=False, allow_blank=True)
    identifier = serializers.CharField(required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        raw = (attrs.get("email") or attrs.get("identifier") or "").strip()
        if not raw:
            raise serializers.ValidationError({"email": ["Enter your email or phone number."]})

        if "@" in raw:
            user = User.objects.filter(email=raw.lower()).first()
        else:
            user = User.objects.filter(phone=raw).first()
            if user is None and " " in raw:
                user = User.objects.filter(phone=raw.replace(" ", "")).first()

        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "name", "phone", "address", "district", "zone", "is_default"]

    def validate(self, attrs):
        # Imported here: apps.orders imports this module at load time.
        from apps.orders.pricing import DHAKA_ZONES, is_dhaka, normalize_zone

        district = attrs.get("district", getattr(self.instance, "district", ""))
        zone = attrs.get("zone", getattr(self.instance, "zone", ""))
        if is_dhaka(district) and (zone or "").strip() not in DHAKA_ZONES:
            raise serializers.ValidationError({"zone": ["Select a Dhaka zone."]})
        attrs["zone"] = normalize_zone(district, zone)
        return attrs


class CustomerLookupSerializer(serializers.ModelSerializer):
    """Minimal customer card for CCE order entry — no role/admin fields."""

    addresses = AddressSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "phone", "addresses"]
