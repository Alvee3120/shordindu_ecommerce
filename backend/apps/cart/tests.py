from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import RequestFactory
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.cart.old_carts import (
    OLD_CART_THRESHOLD,
    old_carts_queryset,
    old_carts_summary,
)
from apps.cart.services import merge_guest_cart
from apps.catalog.models import Product, ProductVariation
from apps.users.models import User


def make_product(sku, name, price="100.00", stock=5):
    product = Product.objects.create(name=name, slug=sku.lower())
    variation = ProductVariation.objects.create(
        product=product, sku=sku, price=Decimal(price), stock_quantity=stock
    )
    return product, variation


def make_user(email, role, phone, name):
    return User.objects.create_user(
        email=email, password="StrongPass12345", name=name, phone=phone, role=role
    )


class OldCartMonitorTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.now = timezone.now()
        cls.admin = make_user("old-admin@example.com", User.Role.ADMIN, "01700001001", "Admin One")
        cls.cce = make_user("old-cce@example.com", User.Role.CCE, "01700001002", "CCE One")
        cls.customer = make_user(
            "old-customer@example.com", User.Role.CUSTOMER, "01700001003", "Customer One"
        )
        cls.other_customer = make_user(
            "old-other@example.com", User.Role.CUSTOMER, "01700001004", "Other Customer"
        )
        cls.product_a, cls.variation_a = make_product("OLD-A", "Old Orna")
        cls.product_b, cls.variation_b = make_product("OLD-B", "Fresh Panjabi")

    def setUp(self):
        self.cart = Cart.objects.create(user=self.customer)
        self.item = CartItem.objects.create(
            cart=self.cart,
            product=self.product_a,
            variation=self.variation_a,
            quantity=2,
            unit_price_snapshot=self.variation_a.price,
        )

    def set_age(self, item, **kwargs):
        CartItem.objects.filter(pk=item.pk).update(created_at=self.now - timedelta(**kwargs))
        item.refresh_from_db()

    def add_item(self, cart, product, variation, quantity=1, created_at=None):
        item = CartItem.objects.create(
            cart=cart,
            product=product,
            variation=variation,
            quantity=quantity,
            unit_price_snapshot=variation.price,
        )
        if created_at is not None:
            CartItem.objects.filter(pk=item.pk).update(created_at=created_at)
            item.refresh_from_db()
        return item

    # -- threshold boundary ---------------------------------------------

    def test_threshold_is_six_hours(self):
        self.assertEqual(OLD_CART_THRESHOLD, timedelta(hours=6))

    def test_not_old_at_five_hours_fifty_nine_minutes(self):
        self.set_age(self.item, hours=5, minutes=59)
        self.assertFalse(old_carts_queryset({}, now=self.now).exists())

    def test_not_old_at_exactly_six_hours(self):
        self.set_age(self.item, hours=6)
        self.assertFalse(old_carts_queryset({}, now=self.now).exists())

    def test_old_one_second_past_six_hours(self):
        self.set_age(self.item, hours=6, seconds=1)
        self.assertTrue(old_carts_queryset({}, now=self.now).exists())

    # -- aggregation / uniqueness ---------------------------------------

    def test_customer_appears_once_with_multiple_old_items(self):
        self.set_age(self.item, hours=7)
        self.add_item(
            self.cart,
            self.product_b,
            self.variation_b,
            quantity=3,
            created_at=self.now - timedelta(days=2),
        )

        qs = old_carts_queryset({}, now=self.now)
        self.assertEqual(qs.count(), 1)
        row = qs.get()
        self.assertEqual(row.item_count, 5)
        self.assertEqual(row.old_item_count, 5)

        summary = old_carts_summary(now=self.now)
        self.assertEqual(summary["customers"], 1)
        self.assertEqual(summary["old_items"], 5)
        self.assertEqual(summary["threshold_hours"], 6)

    def test_mixed_age_items_are_all_in_details(self):
        self.set_age(self.item, days=4)
        fresh = self.add_item(
            self.cart,
            self.product_b,
            self.variation_b,
            created_at=self.now,
        )

        self.client.force_authenticate(self.admin)
        with patch("apps.cart.old_carts.timezone.now", return_value=self.now):
            response = self.client.get(f"/api/cart/old/{self.cart.id}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200, response.data)
        items = response.data["items"]
        self.assertEqual(len(items), 2)
        ages = {item["id"]: item["age_seconds"] for item in items}
        self.assertGreaterEqual(ages[self.item.id], 4 * 24 * 3600)
        self.assertLessEqual(ages[fresh.id], 60)

    def test_removing_old_item_removes_customer(self):
        self.set_age(self.item, hours=7)
        self.assertTrue(old_carts_queryset({}, now=self.now).exists())

        self.item.delete()
        self.assertFalse(old_carts_queryset({}, now=self.now).exists())

    def test_checkout_deleting_cart_removes_customer(self):
        self.set_age(self.item, hours=7)
        self.cart.delete()
        self.assertFalse(old_carts_queryset({}, now=self.now).exists())

    def test_out_of_stock_item_still_listed(self):
        self.set_age(self.item, hours=7)
        self.variation_a.stock_quantity = 0
        self.variation_a.save(update_fields=["stock_quantity"])

        self.client.force_authenticate(self.admin)
        with patch("apps.cart.old_carts.timezone.now", return_value=self.now):
            response = self.client.get(f"/api/cart/old/{self.cart.id}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["items"][0]["stock_quantity"], 0)

    # -- permissions -----------------------------------------------------

    def test_permissions(self):
        self.set_age(self.item, hours=7)
        endpoints = [
            "/api/cart/old/",
            "/api/cart/old/summary/",
            f"/api/cart/old/{self.cart.id}/",
        ]

        for user, expected in ((self.admin, 200), (self.cce, 200), (self.customer, 403)):
            self.client.force_authenticate(user)
            for path in endpoints:
                response = self.client.get(path, HTTP_HOST="localhost")
                self.assertEqual(response.status_code, expected, f"{path} as {user.role}")

        self.client.force_authenticate(user=None)
        for path in endpoints:
            response = self.client.get(path, HTTP_HOST="localhost")
            self.assertEqual(response.status_code, 401, path)

    # -- search / filters / pagination ----------------------------------

    def test_search_matches_customer_and_product(self):
        self.set_age(self.item, hours=7)

        for term in ("Customer One", "01700001003", "old-customer@example.com", "Old Orna"):
            qs = old_carts_queryset({"search": term}, now=self.now)
            self.assertEqual(qs.count(), 1, term)

        self.assertEqual(old_carts_queryset({"search": "no-such-thing"}, now=self.now).count(), 0)

    def test_age_filters(self):
        self.set_age(self.item, hours=8)
        self.assertEqual(old_carts_queryset({"age": "6-24h"}, now=self.now).count(), 1)
        self.assertEqual(old_carts_queryset({"age": "1-3d"}, now=self.now).count(), 0)
        self.assertEqual(old_carts_queryset({"age": "3d+"}, now=self.now).count(), 0)

        self.set_age(self.item, days=2)
        self.assertEqual(old_carts_queryset({"age": "1-3d"}, now=self.now).count(), 1)

        self.set_age(self.item, days=5)
        self.assertEqual(old_carts_queryset({"age": "3d+"}, now=self.now).count(), 1)

    def test_pagination_counts_customers_once(self):
        extra = Cart.objects.create(user=self.other_customer)
        self.set_age(self.item, hours=7)
        self.add_item(extra, self.product_b, self.variation_b, created_at=self.now - timedelta(hours=9))

        self.client.force_authenticate(self.admin)
        with patch("apps.cart.old_carts.timezone.now", return_value=self.now):
            response = self.client.get(
                "/api/cart/old/?page_size=1", HTTP_HOST="localhost"
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["threshold_hours"], 6)

    def test_admin_and_cce_can_read_summary(self):
        self.set_age(self.item, hours=7)
        self.client.force_authenticate(self.cce)
        response = self.client.get("/api/cart/old/summary/", HTTP_HOST="localhost")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["customers"], 1)
        self.assertEqual(response.data["old_items"], 2)

    # -- merge preserves age --------------------------------------------

    def test_merge_guest_cart_preserves_item_age(self):
        guest_cart = Cart.objects.create()
        guest_item = self.add_item(
            guest_cart,
            self.product_b,
            self.variation_b,
            created_at=self.now - timedelta(days=3),
        )

        request = RequestFactory().get("/")
        request.COOKIES["cart_token"] = str(guest_cart.token)
        merge_guest_cart(request, self.customer)

        merged = CartItem.objects.get(cart=self.cart, product=self.product_b)
        self.assertEqual(merged.created_at, guest_item.created_at)

    def test_quantity_merge_does_not_reset_existing_age(self):
        self.set_age(self.item, days=4)
        original_created_at = self.item.created_at

        guest_cart = Cart.objects.create()
        self.add_item(
            guest_cart,
            self.product_a,
            self.variation_a,
            quantity=3,
            created_at=self.now - timedelta(hours=1),
        )

        request = RequestFactory().get("/")
        request.COOKIES["cart_token"] = str(guest_cart.token)
        merge_guest_cart(request, self.customer)

        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 5)
        self.assertEqual(self.item.created_at, original_created_at)
