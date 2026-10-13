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
