from django.contrib import admin

from .models import CampaignBanner


@admin.register(CampaignBanner)
class CampaignBannerAdmin(admin.ModelAdmin):
    list_display = ["__str__", "is_enabled", "heading", "starts_at", "ends_at", "updated_at"]
    readonly_fields = ["created_at", "updated_at", "updated_by"]

    def has_add_permission(self, request):
        return not CampaignBanner.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
