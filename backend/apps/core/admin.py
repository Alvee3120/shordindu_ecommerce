from django.contrib import admin

from .models import CampaignBanner, HeroBanner, HeroBannerSettings


@admin.register(CampaignBanner)
class CampaignBannerAdmin(admin.ModelAdmin):
    list_display = ["__str__", "is_enabled", "heading", "starts_at", "ends_at", "updated_at"]
    readonly_fields = ["created_at", "updated_at", "updated_by"]

    def has_add_permission(self, request):
        return not CampaignBanner.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(HeroBanner)
class HeroBannerAdmin(admin.ModelAdmin):
    list_display = ["__str__", "is_active", "sort_order", "text_alignment", "button_text", "updated_at"]
    list_editable = ["is_active", "sort_order"]
    readonly_fields = ["created_at", "updated_at", "updated_by"]

    def has_add_permission(self, request):
        return HeroBanner.objects.count() < 3


@admin.register(HeroBannerSettings)
class HeroBannerSettingsAdmin(admin.ModelAdmin):
    list_display = ["__str__", "autoplay_delay_ms"]
    readonly_fields = []

    def has_add_permission(self, request):
        return not HeroBannerSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
