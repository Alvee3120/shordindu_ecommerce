from django.contrib import admin
from django.utils.html import format_html

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["product", "user", "rating", "image_preview", "created_at"]
    list_filter = ["rating"]
    search_fields = ["product__name", "user__email", "comment"]

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height: 40px;" />', obj.image.url)
        return "—"

    image_preview.short_description = "Image"
