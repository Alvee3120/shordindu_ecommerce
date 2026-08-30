from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Address, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role", "force_password_change", "created_at"]
        read_only_fields = fields


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "phone"]


class AdminUserSerializer(serializers.ModelSerializer):
    """Used by the admin User Management screen: role and is_active are the
    only fields administrators can edit for another account."""

    class Meta:
        model = User
        fields = ["id", "email", "name", "phone", "role", "is_active", "created_at"]
        read_only_fields = ["id", "email", "name", "phone", "created_at"]

    def update(self, instance, validated_data):
        # is_staff only controls access to Django's built-in admin. CCE users
        # do not receive it; their limited order permissions are role-based.
        role = validated_data.get("role", instance.role)
        instance.is_staff = role == User.Role.ADMIN
        return super().update(instance, validated_data)


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, validators=[validate_password])

    class Meta:
        model = User
        fields = ["email", "name", "phone", "password"]

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class SigninSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        request = self.context.get("request")
        user = authenticate(request, username=attrs["email"].lower(), password=attrs["password"])
        if user is None:
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
        fields = ["id", "name", "phone", "address", "district", "is_default"]
