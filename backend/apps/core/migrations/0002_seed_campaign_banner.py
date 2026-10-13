"""Seed the banner with the content that was hardcoded in the frontend, so the
homepage looks the same right after this ships.

The two original images are copied from the frontend's public folder into
media storage (once — an existing copy is reused). If the frontend isn't next
to the backend (separate deploy), the text is still seeded and the admin can
upload the images from the dashboard.
"""

from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import migrations

LEGACY_IMAGES = {
    "desktop_image": ("banner.jpeg", "campaign/banner.jpeg"),
    "mobile_image": ("bannerM.jpeg", "campaign/bannerM.jpeg"),
}


def _copy_legacy_image(storage, source_name, target_name):
    source = Path(settings.BASE_DIR).parent / "frontend" / "public" / "assets" / "banner" / source_name
    if storage.exists(target_name):
        return target_name
    if not source.is_file():
        return ""
    with source.open("rb") as handle:
        return storage.save(target_name, File(handle))


def seed_campaign_banner(apps, schema_editor):
    CampaignBanner = apps.get_model("core", "CampaignBanner")
    if CampaignBanner.objects.filter(pk=1).exists():
        return

    images = {}
    for field_name, (source_name, target_name) in LEGACY_IMAGES.items():
        storage = CampaignBanner._meta.get_field(field_name).storage
        images[field_name] = _copy_legacy_image(storage, source_name, target_name)

    CampaignBanner.objects.create(
        pk=1,
        # Only switch it on if the desktop image made it across.
        is_enabled=bool(images["desktop_image"]),
        image_mode="responsive",
        image_alt="Mid Year Clearance Sale",
        eyebrow="SEASONAL OFFER",
        heading="Mid Year\nClearance\nSale",
        description="Up to 40% off on selected styles. Refresh your wardrobe before the season ends.",
        button_enabled=True,
        button_label="Explore Collection",
        button_url="/shop",
        **images,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_campaign_banner"),
    ]

    operations = [
        migrations.RunPython(seed_campaign_banner, migrations.RunPython.noop),
    ]
