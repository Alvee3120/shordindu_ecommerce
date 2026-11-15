import io
import shutil
import tempfile
import uuid
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.catalog.models import Product, ProductVariation
from apps.catalog.serializers import ProductSerializer
from apps.orders.models import Order, OrderItem
from apps.reviews.models import Review, ReviewImage
from apps.users.models import User

TEMP_REVIEW_MEDIA = tempfile.mkdtemp(prefix="review-test-media-")


def image_upload(name="review.png", fmt="PNG", size=(30, 30)):
    buffer = io.BytesIO()
    Image.new("RGB", size, "teal").save(buffer, format=fmt)
    content_type = {"PNG": "image/png", "JPEG": "image/jpeg", "GIF": "image/gif"}[fmt]
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


@override_settings(MEDIA_ROOT=TEMP_REVIEW_MEDIA)
class ReviewManagementTests(APITestCase):
    MANAGE = "/api/reviews/manage/"
    PUBLIC = "/api/reviews/"

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_REVIEW_MEDIA, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            email="review-admin@x.com", password="pw", name="Review Admin", role=User.Role.ADMIN
        )
        cls.cce = User.objects.create_user(
            email="review-cce@x.com", password="pw", name="Review CCE", role=User.Role.CCE
        )
        cls.customer = User.objects.create_user(
            email="review-customer@x.com", password="pw", name="Review Customer"
        )
        cls.product = Product.objects.create(name="Probe Product", slug="probe-product")
        cls.variation = ProductVariation.objects.create(
            product=cls.product, sku="PROBE-SKU", price=Decimal("100.00"), stock_quantity=10
        )

    def setUp(self):
        Review.objects.all().delete()

    def payload(self, **overrides):
        data = {
            "customer_name": "Manual Customer",
            "customer_email": "manual@example.com",
            "product": self.product.id,
            "rating": "5",
            "title": "Great product",
            "comment": "Loved it.",
            "review_date": timezone.localdate().isoformat(),
            "status": "approved",
            "verified_purchase": "false",
        }
        data.update(overrides)
        return data

    def create_review(self, user=None, **overrides):
        self.client.force_authenticate(user or self.admin)
        return self.client.post(self.MANAGE, self.payload(**overrides), format="multipart")

    def delivered_order(self, user=None, guest_email=None):
        order = Order.objects.create(
            order_number=f"T{uuid.uuid4().hex[:12]}",
            user=user,
            guest_email=guest_email,
            status=Order.Status.DELIVERED,
            subtotal=Decimal("100.00"),
            grand_total=Decimal("100.00"),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            variation=self.variation,
            product_name_snapshot=self.product.name,
            variation_label_snapshot="Default",
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("100.00"),
        )
        return order

    # -- create / public visibility ---------------------------------------

    def test_admin_creates_manual_review_with_images(self):
        response = self.create_review(
            customer_name="  Manual Customer  ",
            rating="4",
            images=[image_upload("one.png"), image_upload("two.png")],
        )
        self.assertEqual(response.status_code, 201, response.data)
        review = Review.objects.get(pk=response.data["id"])
        self.assertIsNone(review.user)
        self.assertEqual(review.created_by, self.admin)
        self.assertEqual(review.customer_name, "Manual Customer")
        self.assertEqual(review.images.count(), 2)
        self.assertEqual(response.data["created_by_name"], "Review Admin")
        self.assertEqual(response.data["display_name"], "Manual Customer")

        public = self.client.get(f"{self.PUBLIC}?product={self.product.id}&status=approved")
        self.assertEqual(public.status_code, 200)
        row = next(item for item in public.data["results"] if item["id"] == review.id)
        self.assertEqual(row["display_name"], "Manual Customer")
        self.assertEqual(row["title"], "Great product")
        self.assertEqual(len(row["images"]), 2)

    def test_pending_and_hidden_reviews_are_not_public(self):
        pending = self.create_review(status="pending").data
        hidden = self.create_review(customer_email="hidden@example.com", status="rejected").data
        public = self.client.get(f"{self.PUBLIC}?product={self.product.id}&status=approved")
        ids = [row["id"] for row in public.data["results"]]
        self.assertNotIn(pending["id"], ids)
        self.assertNotIn(hidden["id"], ids)

    def test_product_rating_counts_only_approved_reviews(self):
        self.create_review(rating="5", status="approved")
        self.create_review(customer_email="two@example.com", rating="3", status="approved")
        self.create_review(customer_email="pending@example.com", rating="1", status="pending")

        serialized = ProductSerializer(self.product).data
        self.assertEqual(serialized["review_count"], 2)
        self.assertEqual(serialized["average_rating"], 4.0)

    def test_review_date_defaults_to_today_and_can_be_backdated(self):
        default = self.create_review().data
        self.assertEqual(default["review_date"], timezone.localdate().isoformat())

        backdated = self.create_review(
            customer_email="backdated@example.com", review_date="2025-01-02"
        ).data
        self.assertEqual(backdated["review_date"], "2025-01-02")

    # -- verified purchase -------------------------------------------------

    def test_manual_verified_requires_flag_and_delivered_purchase(self):
        self.delivered_order(guest_email="manual@example.com")
        verified = self.create_review(verified_purchase="true").data
        self.assertTrue(verified["verified_purchase"])
        self.assertTrue(verified["is_verified_purchase"])

        unverified = self.create_review(
            customer_email="no-order@example.com", verified_purchase="true"
        ).data
        self.assertFalse(unverified["is_verified_purchase"])

        self.delivered_order(guest_email="not-flagged@example.com")
        not_flagged = self.create_review(
            customer_email="not-flagged@example.com", verified_purchase="false"
        ).data
        self.assertFalse(not_flagged["is_verified_purchase"])

    def test_customer_review_is_auto_verified_after_delivered_purchase(self):
        self.delivered_order(user=self.customer)
        self.client.force_authenticate(self.customer)
        created = self.client.post(
            self.PUBLIC,
            {"product": self.product.id, "rating": 5, "comment": "Customer review."},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], "pending")
        review = Review.objects.get(pk=created.data["id"])
        self.assertTrue(review.verified_purchase)

        self.client.force_authenticate(self.admin)
        self.client.post(f"{self.PUBLIC}{review.id}/approve/")
        public = self.client.get(f"{self.PUBLIC}?product={self.product.id}&status=approved")
        row = next(item for item in public.data["results"] if item["id"] == review.id)
        self.assertTrue(row["is_verified_purchase"])

    # -- permissions -------------------------------------------------------

    def test_manage_permissions(self):
        review = self.create_review().data
        endpoints = [self.MANAGE, f"{self.MANAGE}{review['id']}/"]

        self.client.force_authenticate(self.cce)
        self.assertEqual(self.client.get(self.MANAGE).status_code, 200)
        self.assertEqual(
            self.client.patch(
                f"{self.MANAGE}{review['id']}/", {"status": "pending"}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.delete(f"{self.MANAGE}{review['id']}/").status_code, 204
        )

        self.client.force_authenticate(self.customer)
        for path in endpoints:
            self.assertEqual(self.client.get(path).status_code, 403, path)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.MANAGE).status_code, 401)

    # -- validation / duplicates ------------------------------------------

    def test_rating_and_required_fields(self):
        self.assertEqual(self.create_review(rating="0").status_code, 400)
        self.assertEqual(self.create_review(rating="6", customer_email="r6@example.com").status_code, 400)
        self.assertEqual(self.create_review(customer_name="").status_code, 400)
        self.assertEqual(self.create_review(comment="").status_code, 400)
        without_product = self.payload()
        without_product.pop("product")
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post(self.MANAGE, without_product, format="multipart").status_code, 400
        )

    def test_duplicate_customer_email_per_product_is_rejected(self):
        self.assertEqual(self.create_review().status_code, 201)
        response = self.create_review(comment="Another one.")
        self.assertEqual(response.status_code, 400)
        self.assertIn("customer_email", response.data)

        self.assertEqual(
            self.create_review(customer_email="different@example.com").status_code, 201
        )

    def test_image_validation_and_limit(self):
        gif = self.create_review(images=[image_upload("x.gif", "GIF")])
        self.assertEqual(gif.status_code, 400)

        not_image = SimpleUploadedFile("x.png", b"nope", content_type="image/png")
        self.assertEqual(self.create_review(images=[not_image]).status_code, 400)

        too_many = self.create_review(
            images=[image_upload(f"{index}.png") for index in range(6)]
        )
        self.assertEqual(too_many.status_code, 400)

    # -- update / delete ---------------------------------------------------

    def test_edit_review_and_manage_images(self):
        created = self.create_review(
            images=[image_upload("keep.png"), image_upload("remove.png")],
            avatar=image_upload("avatar.png"),
        ).data
        review = Review.objects.get(pk=created["id"])
        keep = review.images.order_by("id").first()
        remove = review.images.order_by("id").last()

        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{self.MANAGE}{review.id}/",
            {
                "title": "Updated title",
                "status": "pending",
                "remove_image_ids": str(remove.id),
                "remove_avatar": "true",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["title"], "Updated title")
        self.assertEqual(response.data["status"], "pending")
        self.assertIsNone(response.data["avatar_url"])
        self.assertEqual(response.data["images"][0]["id"], keep.id)
        self.assertEqual(review.images.count(), 1)

    def test_legacy_customer_image_can_be_removed(self):
        review = Review.objects.create(
            product=self.product,
            user=self.customer,
            rating=4,
            comment="Legacy image review",
            image=image_upload("legacy.png"),
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{self.MANAGE}{review.id}/", {"remove_legacy_image": "true"}, format="multipart"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["image"])

    def test_delete_review_cascades_images(self):
        created = self.create_review(images=[image_upload("a.png"), image_upload("b.png")]).data
        review_id = created["id"]
        self.assertEqual(ReviewImage.objects.filter(review_id=review_id).count(), 2)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f"{self.MANAGE}{review_id}/").status_code, 204)
        self.assertFalse(Review.objects.filter(pk=review_id).exists())
        self.assertEqual(ReviewImage.objects.filter(review_id=review_id).count(), 0)

    # -- list filters / search / pagination --------------------------------

    def test_search_filters_and_pagination(self):
        self.create_review(customer_name="Alice Example", rating="5", status="approved")
        self.create_review(
            customer_name="Bob Pending", customer_email="bob@example.com", rating="3", status="pending"
        )
        self.create_review(
            customer_name="Carol Hidden",
            customer_email="carol@example.com",
            rating="4",
            status="rejected",
        )

        self.client.force_authenticate(self.admin)
        search = self.client.get(f"{self.MANAGE}?search=Alice")
        self.assertEqual(search.data["count"], 1)
        pending = self.client.get(f"{self.MANAGE}?status=pending")
        self.assertEqual(pending.data["count"], 1)
        by_rating = self.client.get(f"{self.MANAGE}?rating=5")
        self.assertEqual(by_rating.data["count"], 1)
        page = self.client.get(f"{self.MANAGE}?page_size=1")
        self.assertEqual(page.data["count"], 3)
        self.assertEqual(len(page.data["results"]), 1)

    # -- customer compatibility -------------------------------------------

    def test_customer_submission_still_pending_and_unique(self):
        self.client.force_authenticate(self.customer)
        payload = {"product": self.product.id, "rating": 5, "comment": "Customer review."}
        created = self.client.post(self.PUBLIC, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], "pending")
        self.assertEqual(
            self.client.post(self.PUBLIC, payload, format="json").status_code, 400
        )

        self.client.force_authenticate(self.admin)
        self.client.post(f"{self.PUBLIC}{created.data['id']}/approve/")
        public = self.client.get(f"{self.PUBLIC}?product={self.product.id}&status=approved")
        self.assertEqual(public.data["count"], 1)
