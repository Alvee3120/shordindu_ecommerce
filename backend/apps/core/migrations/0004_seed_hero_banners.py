"""Seed up to three hero banners from the images the homepage used to
hardcode, so the hero keeps its current look after this ships. Only banners
whose desktop image could be copied are created; the admin can edit/upload
everything from /dashboard/admin/banners afterwards.
"""

from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import migrations

SEEDS = [
    {
        "desktop": "banner.jpeg",
        "mobile": "bannerM.jpeg",
        "bold_heading": "SHORDINDU",
        "normal_heading": "Step Into Effortless Elegance",
        "button_text": "Shop Now",
    },
    {
        "desktop": "bannerD.jpeg",
        "mobile": "bannerD.jpeg",
        "bold_heading": "NEW SEASON",
        "normal_heading": "Explore the latest collection",
        "button_text": "Explore Collection",
    },
    {
        "desktop": "bannerD2.jpeg",
        "mobile": "bannerD2.jpeg",
        "bold_heading": "DISCOVER YOUR STYLE",
        "normal_heading": "Fresh arrivals, every week",
        "button_text": "Discover More",
    },
]


def _copy_legacy_image(storage, source_name, target_name):
    source = Path(settings.BASE_DIR).parent / "frontend" / "public" / "assets" / "banner" / source_name
    if storage.exists(target_name):
        return target_name
    if not source.is_file():
        return ""
    with source.open("rb") as handle:
        return storage.save(target_name, File(handle))


def seed_hero_banners(apps, schema_editor):
    HeroBanner = apps.get_model("core", "HeroBanner")
    if HeroBanner.objects.exists():
        return

    desktop_storage = HeroBanner._meta.get_field("desktop_image").storage
    mobile_storage = HeroBanner._meta.get_field("mobile_image").storage

    order = 0
    for index, seed in enumerate(SEEDS, start=1):
        desktop_name = _copy_legacy_image(
            desktop_storage, seed["desktop"], f"hero-banners/slide-{index}.jpeg"
        )
        if not desktop_name:
            continue
        mobile_name = _copy_legacy_image(
            mobile_storage, seed["mobile"], f"hero-banners/slide-{index}-mobile.jpeg"
        )

        HeroBanner.objects.create(
            desktop_image=desktop_name,
            mobile_image=mobile_name,
            image_alt=seed["bold_heading"],
            bold_heading=seed["bold_heading"],
            normal_heading=seed["normal_heading"],
            text_color="#FFFFFF",
            text_alignment="left",
            show_text=True,
            button_text=seed["button_text"],
            button_link="/shop",
            button_background_color="#003333",
            button_text_color="#FFFFFF",
            button_radius=9999,
            button_style="solid",
            show_button=True,
            is_active=True,
            sort_order=order,
        )
        order += 1


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_herobannersettings_herobanner"),
    ]

    operations = [
        migrations.RunPython(seed_hero_banners, migrations.RunPython.noop),
    ]
