import io
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.core.models import CampaignBanner, HeroBanner, HeroBannerSettings
from apps.users.models import User

TEMP_MEDIA = tempfile.mkdtemp(prefix="banner-test-media-")
TEMP_HERO_MEDIA = tempfile.mkdtemp(prefix="hero-banner-test-media-")


def image_upload(name="banner.png", fmt="PNG", size=(40, 20)):
    buffer = io.BytesIO()
    Image.new("RGB", size, "teal").save(buffer, format=fmt)
    content_type = {"PNG": "image/png", "JPEG": "image/jpeg", "GIF": "image/gif"}[fmt]
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class CampaignBannerApiTests(APITestCase):
    PUBLIC = "/api/campaign-banner/"
    MANAGE = "/api/campaign-banner/manage/"

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(email="admin@x.com", password="pw", name="Admin", role=User.Role.ADMIN)
        self.cce = User.objects.create_user(email="cce@x.com", password="pw", name="CCE", role=User.Role.CCE)
        self.customer = User.objects.create_user(email="c@x.com", password="pw", name="Customer")
        # Known state, independent of whatever the seed migration found on disk.
        banner = CampaignBanner.load()
        banner.is_enabled = True
        banner.desktop_image = image_upload()
        banner.mobile_image = ""
        banner.starts_at = banner.ends_at = None
        banner.save()

    def valid_payload(self, **overrides):
        payload = {
            "is_enabled": "true",
            "image_mode": "responsive",
            "eyebrow": "SEASONAL OFFER",
            "heading": "Mid Year\r\nClearance\n\nSale",
            "description": "Up to 40% off.",
            "button_enabled": "true",
            "button_label": "Explore Collection",
            "button_url": "/shop",
        }
        payload.update(overrides)
        return payload

    def put(self, user=None, **overrides):
        if user:
            self.client.force_authenticate(user)
        return self.client.put(self.MANAGE, self.valid_payload(**overrides), format="multipart")

    # -- seed / public --------------------------------------------------------

    def test_seeded_defaults_match_the_old_hardcoded_banner(self):
        banner = CampaignBanner.load()
        self.assertEqual(banner.eyebrow, "SEASONAL OFFER")
        self.assertEqual(banner.heading, "Mid Year\nClearance\nSale")
        self.assertEqual(banner.button_url, "/shop")
        self.assertEqual(CampaignBanner.objects.count(), 1)

    def test_public_endpoint_returns_live_banner(self):
        response = self.client.get(self.PUBLIC)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["active"])
        banner = response.data["banner"]
        self.assertTrue(banner["desktop_image_url"].startswith("http://testserver/media/campaign/"))
        self.assertIsNone(banner["mobile_image_url"])
        self.assertEqual(banner["image_alt"], "Mid Year Clearance Sale")
        for admin_field in ("is_enabled", "starts_at", "status", "updated_by_name"):
            self.assertNotIn(admin_field, banner)

    def test_disabled_and_out_of_schedule_banners_are_hidden(self):
        now = timezone.now()
        cases = [
            {"is_enabled": False},
            {"starts_at": now + timedelta(hours=1)},
            {"ends_at": now - timedelta(minutes=1)},
        ]
        for changes in cases:
            CampaignBanner.objects.filter(pk=1).update(
                **{"is_enabled": True, "starts_at": None, "ends_at": None, **changes}
            )
            response = self.client.get(self.PUBLIC)
            self.assertEqual(response.data, {"active": False, "banner": None}, changes)

        CampaignBanner.objects.filter(pk=1).update(
            starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=1)
        )
        self.assertTrue(self.client.get(self.PUBLIC).data["active"])

    def test_status_reported_to_admin(self):
        now = timezone.now()
        CampaignBanner.objects.filter(pk=1).update(starts_at=now + timedelta(days=1))
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.MANAGE).data["status"], "scheduled")

    # -- permissions ----------------------------------------------------------

    def test_only_admins_can_read_or_change_the_configuration(self):
        self.assertEqual(self.client.get(self.MANAGE).status_code, 401)
        self.assertEqual(self.put().status_code, 401)
        for user in (self.cce, self.customer):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.MANAGE).status_code, 403)
            self.assertEqual(self.put(heading="Hacked").status_code, 403)
            self.assertEqual(self.client.patch(self.MANAGE, {"heading": "Hacked"}).status_code, 403)
        self.assertNotEqual(CampaignBanner.load().heading, "Hacked")

    # -- updates --------------------------------------------------------------

    def test_admin_updates_text_and_images_without_duplicating_the_record(self):
        response = self.put(
            self.admin,
            heading="Eid\nCollection",
            mobile_image=image_upload("m.jpg", "JPEG"),
            image_alt="  Eid collection  ",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["heading"], "Eid\nCollection")
        self.assertEqual(response.data["image_alt"], "Eid collection")
        self.assertTrue(response.data["mobile_image_url"].endswith(".jpg"))
        self.assertEqual(response.data["updated_by_name"], "Admin")
        self.assertEqual(CampaignBanner.objects.count(), 1)

        response = self.put(remove_mobile_image="true")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["mobile_image_url"])
        self.assertEqual(CampaignBanner.load().mobile_image.name, "")

    def test_heading_normalised(self):
        response = self.put(self.admin)
        self.assertEqual(response.data["heading"], "Mid Year\nClearance\nSale")
        self.assertEqual(self.put(heading=" \n ").status_code, 400)
        self.assertEqual(self.put(heading="a\nb\nc\nd\ne").status_code, 400)

    def test_button_url_validation(self):
        self.client.force_authenticate(self.admin)
        for good in ("/shop", "/shop?category=3#top", "https://example.com/sale", "http://example.com"):
            self.assertEqual(self.put(button_url=good).status_code, 200, good)
        bad_urls = (
            "javascript:alert(1)",
            "JaVaScRiPt:alert(1)",
            "data:text/html,hi",
            "//evil.com",
            "/\\evil.com",
            "shop",
            "ftp://example.com",
            "https://",
            "/sh op",
            "/shop\nX",
        )
        for bad in bad_urls:
            response = self.put(button_url=bad)
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("button_url", response.data)

    def test_button_fields_required_only_when_enabled(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.put(button_label="", button_url="").status_code, 400)
        self.assertEqual(self.put(button_enabled="false", button_label="", button_url="").status_code, 200)

    def test_schedule_validation(self):
        self.client.force_authenticate(self.admin)
        response = self.put(starts_at="2026-12-10T10:00", ends_at="2026-12-01T10:00")
        self.assertEqual(response.status_code, 400)
        self.assertIn("ends_at", response.data)

        response = self.put(starts_at="2026-12-01T10:00", ends_at="")
        self.assertEqual(response.status_code, 200, response.data)
        # Naive input is read in the project timezone (Asia/Dhaka, UTC+6).
        self.assertTrue(response.data["starts_at"].startswith("2026-12-01T10:00:00+06:00"))
        self.assertIsNone(response.data["ends_at"])

    def test_image_validation(self):
        self.client.force_authenticate(self.admin)
        not_an_image = SimpleUploadedFile("x.png", b"not really a png", content_type="image/png")
        self.assertEqual(self.put(desktop_image=not_an_image).status_code, 400)
        self.assertEqual(self.put(desktop_image=image_upload("x.gif", "GIF")).status_code, 400)
        with self.settings():
            from apps.core import serializers as banner_serializers

            original = banner_serializers.MAX_IMAGE_BYTES
            banner_serializers.MAX_IMAGE_BYTES = 10
            try:
                self.assertEqual(self.put(desktop_image=image_upload()).status_code, 400)
            finally:
                banner_serializers.MAX_IMAGE_BYTES = original

    def test_enabled_banner_needs_the_images_its_mode_uses(self):
        self.client.force_authenticate(self.admin)
        response = self.put(remove_desktop_image="true")
        self.assertEqual(response.status_code, 400)
        self.assertIn("desktop_image", response.data)
        self.assertEqual(self.put(image_mode="mobile").status_code, 400)
        # Disabled banners may be saved half-finished.
        self.assertEqual(self.put(is_enabled="false", remove_desktop_image="true").status_code, 200)


@override_settings(MEDIA_ROOT=TEMP_HERO_MEDIA)
class HeroBannerApiTests(APITestCase):
    PUBLIC = "/api/hero-banners/"
    MANAGE = "/api/hero-banners/manage/"
    REORDER = "/api/hero-banners/manage/reorder/"
    SETTINGS = "/api/hero-banners/manage/settings/"

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_HERO_MEDIA, ignore_errors=True)

    def setUp(self):
        HeroBanner.objects.all().delete()
        HeroBannerSettings.objects.all().delete()
        self.admin = User.objects.create_user(
            email="hero-admin@x.com", password="pw", name="Hero Admin", role=User.Role.ADMIN
        )
        self.cce = User.objects.create_user(
            email="hero-cce@x.com", password="pw", name="Hero CCE", role=User.Role.CCE
        )
        self.customer = User.objects.create_user(
            email="hero-c@x.com", password="pw", name="Hero Customer"
        )

    def payload(self, **overrides):
        data = {
            "desktop_image": image_upload("hero.png"),
            "bold_heading": "DISCOVER YOUR STYLE",
            "normal_heading": "Explore the latest collection",
            "text_color": "#FFFFFF",
            "text_alignment": "left",
            "show_text": "true",
            "button_text": "Shop Now",
            "button_link": "/shop",
            "button_background_color": "#003333",
            "button_text_color": "#FFFFFF",
            "button_radius": 8,
            "button_style": "solid",
            "show_button": "true",
            "is_active": "true",
        }
        data.update(overrides)
        return data

    def create(self, user=None, **overrides):
        self.client.force_authenticate(user or self.admin)
        return self.client.post(self.MANAGE, self.payload(**overrides), format="multipart")

    def make_banner(self, sort_order, is_active=True, bold="Slide"):
        banner = HeroBanner.objects.create(
            desktop_image=image_upload(f"hero-{sort_order}.png"),
            bold_heading=bold,
            normal_heading="Normal",
            button_text="Shop Now",
            button_link="/shop",
            is_active=is_active,
            sort_order=sort_order,
        )
        return banner

    # -- public ---------------------------------------------------------------

    def test_public_returns_only_active_banners_in_order_with_settings(self):
        self.make_banner(1, is_active=False, bold="Hidden")
        self.make_banner(0, is_active=True, bold="First")
        self.make_banner(2, is_active=True, bold="Third")

        response = self.client.get(self.PUBLIC)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["autoplay_delay_ms"], 5000)
        self.assertEqual([b["bold_heading"] for b in response.data["banners"]], ["First", "Third"])
        first = response.data["banners"][0]
        self.assertTrue(first["desktop_image_url"].startswith("http://testserver/media/hero-banners/"))
        for admin_only in ("is_active", "created_at", "updated_by_name"):
            self.assertNotIn(admin_only, first)

    # -- create ---------------------------------------------------------------

    def test_admin_creates_banners_with_incremental_order(self):
        for index, style in enumerate(("solid", "outline", "solid")):
            response = self.create(button_style=style)
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["sort_order"], index)
            self.assertEqual(response.data["updated_by_name"], "Hero Admin")

        self.assertEqual(HeroBanner.objects.count(), 3)

    def test_fourth_banner_is_rejected(self):
        for _ in range(3):
            self.assertEqual(self.create().status_code, 201)
        response = self.create()
        self.assertEqual(response.status_code, 400)
        self.assertIn("at most 3", str(response.data))
        self.assertEqual(HeroBanner.objects.count(), 3)

    def test_desktop_image_is_required(self):
        response = self.client.post(self.MANAGE, {}, format="multipart")
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.MANAGE, {k: v for k, v in self.payload().items() if k != "desktop_image"}, format="multipart"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("desktop_image", response.data)

    def test_button_fields_required_only_when_shown(self):
        self.assertEqual(self.create(button_text="").status_code, 400)
        response = self.create(show_button="false", button_text="", button_link="")
        self.assertEqual(response.status_code, 201, response.data)

    def test_colour_validation(self):
        for field in ("text_color", "button_background_color", "button_text_color"):
            response = self.create(**{field: "#123"})
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field, response.data)
        self.assertEqual(self.create(button_radius=10000).status_code, 400)

    # -- permissions ----------------------------------------------------------

    def test_only_admins_can_manage_banners(self):
        self.assertEqual(self.client.get(self.MANAGE).status_code, 401)
        self.assertEqual(self.client.post(self.MANAGE, self.payload(), format="multipart").status_code, 401)
        for user in (self.cce, self.customer):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.MANAGE).status_code, 403)
            self.assertEqual(
                self.client.post(self.MANAGE, self.payload(), format="multipart").status_code, 403
            )
            self.assertEqual(self.client.get(self.SETTINGS).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.PUBLIC).status_code, 200)

    # -- update / delete ------------------------------------------------------

    def test_admin_updates_text_colours_and_button(self):
        created = self.create().data
        url = f"{self.MANAGE}{created['id']}/"
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            url,
            {
                "bold_heading": "NEW SEASON",
                "normal_heading": "Fresh arrivals",
                "text_color": "#ffcc00",
                "text_alignment": "center",
                "button_style": "outline",
                "button_radius": 24,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["bold_heading"], "NEW SEASON")
        self.assertEqual(response.data["text_color"], "#FFCC00")
        self.assertEqual(response.data["text_alignment"], "center")
        self.assertEqual(response.data["button_style"], "outline")
        self.assertEqual(response.data["button_radius"], 24)
        self.assertEqual(response.data["updated_by_name"], "Hero Admin")

    def test_remove_mobile_image_and_protect_desktop(self):
        created = self.create(mobile_image=image_upload("hero-mobile.png")).data
        self.assertIsNotNone(created["mobile_image_url"])
        url = f"{self.MANAGE}{created['id']}/"
        self.client.force_authenticate(self.admin)

        response = self.client.patch(url, {"remove_mobile_image": "true"}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["mobile_image_url"])

        response = self.client.patch(url, {"remove_desktop_image": "true"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("desktop_image", response.data)

    def test_delete_banner(self):
        created = self.create().data
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"{self.MANAGE}{created['id']}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(HeroBanner.objects.count(), 0)

    # -- reorder / settings ---------------------------------------------------

    def test_reorder_assigns_new_sort_order(self):
        ids = [self.create().data["id"] for _ in range(3)]
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.REORDER, {"order": list(reversed(ids))}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([b["id"] for b in response.data], list(reversed(ids)))
        for index, banner_id in enumerate(reversed(ids)):
            self.assertEqual(HeroBanner.objects.get(pk=banner_id).sort_order, index)

    def test_reorder_rejects_partial_and_duplicate_lists(self):
        ids = [self.create().data["id"] for _ in range(3)]
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.REORDER, {"order": ids[:2]}, format="json").status_code, 400)
        self.assertEqual(
            self.client.post(self.REORDER, {"order": [ids[0], ids[0], ids[1]]}, format="json").status_code,
            400,
        )
        self.assertEqual(self.client.post(self.REORDER, {"order": []}, format="json").status_code, 400)

    def test_carousel_settings(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.SETTINGS).data["autoplay_delay_ms"], 5000)

        response = self.client.patch(self.SETTINGS, {"autoplay_delay_ms": 7000}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(HeroBannerSettings.load().autoplay_delay_ms, 7000)

        for invalid in (1000, 20000):
            response = self.client.patch(self.SETTINGS, {"autoplay_delay_ms": invalid}, format="json")
            self.assertEqual(response.status_code, 400, invalid)

    # -- images ---------------------------------------------------------------

    def test_image_type_and_size_validation(self):
        self.assertEqual(self.create(desktop_image=image_upload("x.gif", "GIF")).status_code, 400)
        not_an_image = SimpleUploadedFile("x.png", b"not really a png", content_type="image/png")
        self.assertEqual(self.create(desktop_image=not_an_image).status_code, 400)

        from apps.core import serializers as core_serializers

        original = core_serializers.MAX_IMAGE_BYTES
        core_serializers.MAX_IMAGE_BYTES = 10
        try:
            self.assertEqual(self.create().status_code, 400)
        finally:
            core_serializers.MAX_IMAGE_BYTES = original
