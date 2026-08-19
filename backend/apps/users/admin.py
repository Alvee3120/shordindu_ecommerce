from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Address, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["email"]
    list_display = ["email", "name", "role", "is_staff", "is_active", "created_at"]
    list_filter = ["role", "is_staff", "is_active"]
    search_fields = ["email", "name", "phone"]
    readonly_fields = ["created_at", "updated_at", "last_login"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("name", "phone")}),
        (
            "Permissions",
            {
                "fields": (
                    "role",
                    "force_password_change",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "name", "password1", "password2", "role"),
            },
        ),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "district", "user", "is_default"]
    list_filter = ["district", "is_default"]
    search_fields = ["name", "phone", "user__email", "district"]
