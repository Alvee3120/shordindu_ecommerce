from django.db import models
from django.utils import timezone


class CampaignBanner(models.Model):
    """Singleton (always pk=1): the homepage campaign banner, edited by admins.

    Images are stored through the configured media storage (local MEDIA_ROOT
    or S3); the database only keeps their storage paths.
    """

    class ImageMode(models.TextChoices):
        RESPONSIVE = "responsive", "Desktop image on desktop, mobile image on mobile"
        DESKTOP = "desktop", "Desktop image on every screen"
        MOBILE = "mobile", "Mobile image on every screen"

    class Status(models.TextChoices):
        DISABLED = "disabled", "Disabled"
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        ENDED = "ended", "Ended"

    is_enabled = models.BooleanField(default=True)
    image_mode = models.CharField(max_length=20, choices=ImageMode.choices, default=ImageMode.RESPONSIVE)
    desktop_image = models.ImageField(upload_to="campaign/", blank=True)
    mobile_image = models.ImageField(upload_to="campaign/", blank=True)
    image_alt = models.CharField(max_length=150, blank=True)

    eyebrow = models.CharField(max_length=60, blank=True)
    # Newlines are rendered as line breaks in the banner heading.
    heading = models.CharField(max_length=120)
    description = models.TextField(max_length=300, blank=True)

    button_enabled = models.BooleanField(default=True)
    button_label = models.CharField(max_length=40, blank=True)
    button_url = models.CharField(max_length=500, blank=True)

    # Optional schedule, interpreted in settings.TIME_ZONE (Asia/Dhaka).
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "campaign_banner"

    def __str__(self):
        return "Campaign banner"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        banner, _ = cls.objects.get_or_create(pk=1, defaults={"heading": "Campaign"})
        return banner

    def status_at(self, now=None):
        now = now or timezone.now()
        if not self.is_enabled:
            return self.Status.DISABLED
        if self.starts_at and now < self.starts_at:
            return self.Status.SCHEDULED
        if self.ends_at and now > self.ends_at:
            return self.Status.ENDED
        return self.Status.LIVE

    @property
    def is_live(self):
        return self.status_at() == self.Status.LIVE


class HeroBanner(models.Model):
    """One homepage hero slide. Admins can manage up to three, ordered by
    sort_order. Images live in the configured media storage (local or S3)."""

    class TextAlignment(models.TextChoices):
        LEFT = "left", "Left"
        CENTER = "center", "Center"
        RIGHT = "right", "Right"

    class ButtonStyle(models.TextChoices):
        SOLID = "solid", "Solid"
        OUTLINE = "outline", "Outline"

    desktop_image = models.ImageField(upload_to="hero-banners/")
    mobile_image = models.ImageField(upload_to="hero-banners/", blank=True)
    image_alt = models.CharField(max_length=150, blank=True)

    bold_heading = models.CharField(max_length=120, blank=True)
    normal_heading = models.CharField(max_length=160, blank=True)
    text_color = models.CharField(max_length=7, default="#FFFFFF")
    text_alignment = models.CharField(
        max_length=10, choices=TextAlignment.choices, default=TextAlignment.CENTER
    )
    show_text = models.BooleanField(default=True)

    button_text = models.CharField(max_length=40, blank=True)
    button_link = models.CharField(max_length=500, blank=True)
    button_background_color = models.CharField(max_length=7, default="#003333")
    button_text_color = models.CharField(max_length=7, default="#FFFFFF")
    button_radius = models.PositiveIntegerField(default=8)
    button_style = models.CharField(
        max_length=10, choices=ButtonStyle.choices, default=ButtonStyle.SOLID
    )
    show_button = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hero_banners"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.bold_heading or f"Hero banner {self.pk}"


class HeroBannerSettings(models.Model):
    """Singleton carousel settings for the homepage hero."""

    autoplay_delay_ms = models.PositiveIntegerField(default=5000)

    class Meta:
        db_table = "hero_banner_settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

