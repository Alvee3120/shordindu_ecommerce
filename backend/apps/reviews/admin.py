from django.contrib import admin

from .models import Review, Wishlist


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["product", "user", "rating", "created_at"]
    list_filter = ["rating"]
    search_fields = ["product__name", "user__email", "comment"]


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ["user", "product", "variation", "created_at"]
    search_fields = ["user__email", "product__name"]
