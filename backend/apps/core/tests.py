import io
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.core.models import CampaignBanner
from apps.users.models import User

TEMP_MEDIA = tempfile.mkdtemp(prefix="banner-test-media-")


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
