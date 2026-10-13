"""Coupon access, delivery-charge settings, stock integrity and CCE dashboard orders."""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalog.models import Category, InventoryLog, Product, ProductVariation
from apps.orders.models import Coupon, DeliveryChargeSettings, Order, OrderCoupon
from apps.users.models import Address, User


class OrderFixturesMixin:
    def make_users(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="pw", name="Admin", role=User.Role.ADMIN
        )
        self.cce = User.objects.create_user(email="cce@example.com", password="pw", name="CCE", role=User.Role.CCE)
        self.customer = User.objects.create_user(
            email="cust@example.com", password="pw", name="Rahim Customer", phone="01711111111"
        )

    def make_variation(self, price="500.00", stock=10, sku="SKU-1", status=Product.Status.ACTIVE, active=True):
        category, _ = Category.objects.get_or_create(name="Saree")
        product = Product.objects.create(name=f"Product {sku}", status=status)
        product.categories.set([category])
        return ProductVariation.objects.create(
            product=product, sku=sku, price=Decimal(price), stock_quantity=stock, is_active=active
        )

    def set_charges(self, inside, outer, outside):
        charges = DeliveryChargeSettings.load()
        charges.inside_dhaka = Decimal(inside)
        charges.dhaka_outer_zones = Decimal(outer)
        charges.outside_dhaka = Decimal(outside)
        charges.save()

    def checkout_as(self, user, variation, quantity=1, **shipping):
        self.client.force_authenticate(user)
        response = self.client.post(
            "/api/cart/items/",
            {"product": variation.product_id, "variation": variation.id, "quantity": quantity},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        payload = {
            "shipping_name": "Buyer",
            "shipping_phone": "01712345678",
            "shipping_address": "House 1, Road 2",
            **shipping,
        }
        return self.client.post("/api/checkout/", payload, format="json")

    def manual_payload(self, variation, quantity=1, **overrides):
        payload = {
            "name": "Walk-in Customer",
            "phone": "01812345678",
            "address": "House 9, Road 4",
            "district": "Dhaka",
            "zone": "Dhaka Sadar",
            "items": [{"variation": variation.id, "quantity": quantity}],
        }
        payload.update(overrides)
        return payload


class CouponPermissionTests(OrderFixturesMixin, APITestCase):
    def setUp(self):
        self.make_users()
        self.active = Coupon.objects.create(code="SAVE10", type="percent", value=Decimal("10"))
        self.expired = Coupon.objects.create(
            code="OLD50", type="flat", value=Decimal("50"), ends_at=timezone.now() - timedelta(days=1)
        )

    def test_cce_can_list_search_filter_and_view_admin_coupons(self):
        self.client.force_authenticate(self.cce)

        response = self.client.get("/api/coupons/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)

        response = self.client.get("/api/coupons/?search=save")
        self.assertEqual([c["code"] for c in response.data["results"]], ["SAVE10"])
        response = self.client.get("/api/coupons/?status=expired")
        self.assertEqual([c["code"] for c in response.data["results"]], ["OLD50"])
        response = self.client.get("/api/coupons/?status=active")
        self.assertEqual([c["code"] for c in response.data["results"]], ["SAVE10"])
        response = self.client.get("/api/coupons/?type=percent")
        self.assertEqual([c["code"] for c in response.data["results"]], ["SAVE10"])

        response = self.client.get(f"/api/coupons/{self.active.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "active")
        self.assertEqual(response.data["usage_count"], 0)

    def test_cce_cannot_create_edit_or_delete_coupons(self):
        self.client.force_authenticate(self.cce)
        url = f"/api/coupons/{self.active.id}/"
        create = {"code": "X", "type": "flat", "value": "5"}
        self.assertEqual(self.client.post("/api/coupons/", create, format="json").status_code, 403)
        self.assertEqual(self.client.patch(url, {"value": "99"}, format="json").status_code, 403)
        self.assertEqual(self.client.put(url, create, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.active.refresh_from_db()
        self.assertEqual(self.active.value, Decimal("10"))

    def test_customers_and_guests_have_no_coupon_access(self):
        self.assertEqual(self.client.get("/api/coupons/").status_code, 401)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/coupons/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/coupons/{self.active.id}/").status_code, 403)

    def test_admin_changes_are_visible_to_cce(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/coupons/", {"code": "NEW100", "type": "flat", "value": "100"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.delete(f"/api/coupons/{self.expired.id}/").status_code, 204)

        self.client.force_authenticate(self.cce)
        codes = {c["code"] for c in self.client.get("/api/coupons/").data["results"]}
        self.assertEqual(codes, {"SAVE10", "NEW100"})


class DeliveryChargeSettingsTests(OrderFixturesMixin, APITestCase):
    URL = "/api/delivery-charges/"

    def setUp(self):
        self.make_users()

    def test_defaults_are_public(self):
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            (response.data["inside_dhaka"], response.data["dhaka_outer_zones"], response.data["outside_dhaka"]),
            ("70.00", "100.00", "120.00"),
        )
        self.assertEqual(len(response.data["dhaka_zones"]), 6)

    def test_admin_updates_persist(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            self.URL, {"inside_dhaka": "80", "dhaka_outer_zones": "120", "outside_dhaka": "150"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        charges = DeliveryChargeSettings.load()
        self.assertEqual(
            (charges.inside_dhaka, charges.dhaka_outer_zones, charges.outside_dhaka),
            (Decimal("80"), Decimal("120"), Decimal("150")),
        )
        self.assertEqual(charges.updated_by, self.admin)
        self.assertEqual(DeliveryChargeSettings.objects.count(), 1)
        self.assertEqual(self.client.get(self.URL).data["inside_dhaka"], "80.00")

    def test_only_admin_can_modify(self):
        body = {"inside_dhaka": "1", "dhaka_outer_zones": "1", "outside_dhaka": "1"}
        self.assertEqual(self.client.put(self.URL, body, format="json").status_code, 401)
        for user in (self.cce, self.customer):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.put(self.URL, body, format="json").status_code, 403)
            self.assertEqual(self.client.patch(self.URL, body, format="json").status_code, 403)
        self.assertEqual(DeliveryChargeSettings.load().inside_dhaka, Decimal("70.00"))

    def test_validation(self):
        self.client.force_authenticate(self.admin)
        valid = {"inside_dhaka": "70", "dhaka_outer_zones": "100", "outside_dhaka": "120"}
        bad_values = (("inside_dhaka", "-1"), ("dhaka_outer_zones", ""), ("outside_dhaka", "abc"), ("inside_dhaka", None))
        for field, bad in bad_values:
            response = self.client.put(self.URL, {**valid, field: bad}, format="json")
            self.assertEqual(response.status_code, 400, (field, bad))
            self.assertIn(field, response.data)
        missing = {"inside_dhaka": "70", "outside_dhaka": "120"}
        self.assertEqual(self.client.put(self.URL, missing, format="json").status_code, 400)
        self.assertEqual(DeliveryChargeSettings.load().inside_dhaka, Decimal("70.00"))

        response = self.client.put(self.URL, {**valid, "inside_dhaka": "0"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DeliveryChargeSettings.load().inside_dhaka, Decimal("0"))


class CheckoutDeliveryChargeTests(OrderFixturesMixin, APITestCase):
    def setUp(self):
        self.make_users()
        self.set_charges("80", "120", "150")

    def _fee_for(self, district, zone=""):
        variation = self.make_variation(sku=f"SKU-{district}-{zone}")
        response = self.checkout_as(self.customer, variation, shipping_district=district, shipping_zone=zone)
        self.assertEqual(response.status_code, 201, response.data)
        return Decimal(response.data["shipping_total"])

    def test_zone_tiers_use_configured_charges(self):
        self.assertEqual(self._fee_for("Dhaka", "Dhaka Sadar"), Decimal("80"))
        for zone in ("Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"):
            self.assertEqual(self._fee_for("Dhaka", zone), Decimal("120"), zone)
        for district in ("Chattogram", "Rajshahi"):
            self.assertEqual(self._fee_for(district), Decimal("150"), district)

    def test_dhaka_without_valid_zone_is_rejected(self):
        variation = self.make_variation()
        response = self.checkout_as(self.customer, variation, shipping_district="Dhaka")
        self.assertEqual(response.status_code, 400)
        self.assertIn("shipping_zone", response.data)
        response = self.client.post(
            "/api/checkout/",
            {"shipping_address": "x", "shipping_district": "Dhaka", "shipping_zone": "Gulshan"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        variation.refresh_from_db()
        self.assertEqual(variation.stock_quantity, 10)

    def test_client_cannot_override_delivery_charge(self):
        variation = self.make_variation(price="1000.00")
        response = self.checkout_as(
            self.customer,
            variation,
            shipping_district="Sylhet",
            shipping_total="0",
            deliveryCharge=0,
            grand_total="1",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data["shipping_total"]), Decimal("150"))
        self.assertEqual(Decimal(response.data["grand_total"]), Decimal("1150"))

    def test_settings_changes_do_not_touch_existing_orders(self):
        variation = self.make_variation(price="1000.00")
        order_id = self.checkout_as(
            self.customer, variation, shipping_district="Dhaka", shipping_zone="Dhaka Sadar"
        ).data["id"]
        self.set_charges("100", "130", "160")

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.shipping_total, Decimal("80"))
        self.assertEqual(order.grand_total, Decimal("1080"))

        new = self.checkout_as(self.customer, variation, shipping_district="Dhaka", shipping_zone="Dhaka Sadar")
        self.assertEqual(Decimal(new.data["shipping_total"]), Decimal("100"))

    def test_saved_address_zone_rules(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post("/api/addresses/", {"name": "Home", "address": "x", "district": "Dhaka"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("zone", response.data)

        response = self.client.post(
            "/api/addresses/", {"name": "Home", "address": "x", "district": "Khulna", "zone": "Savar"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["zone"], "")

        response = self.client.post(
            "/api/addresses/", {"name": "Home", "address": "x", "district": "Dhaka", "zone": "Savar"}, format="json"
        )
        address_id = response.data["id"]
        variation = self.make_variation()
        self.client.post("/api/cart/items/", {"product": variation.product_id, "variation": variation.id}, format="json")
        response = self.client.post("/api/checkout/", {"shipping_address_id": address_id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["shipping_total"]), Decimal("120"))


class OrderStockIntegrityTests(OrderFixturesMixin, APITestCase):
    def setUp(self):
        self.make_users()
        self.variation = self.make_variation(stock=5)

    def _place(self, quantity=2):
        response = self.checkout_as(self.customer, self.variation, quantity, shipping_district="Khulna")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def _stock(self):
        self.variation.refresh_from_db()
        return self.variation.stock_quantity

    def test_checkout_cannot_oversell(self):
        response = self.checkout_as(self.customer, self.variation, 6, shipping_district="Khulna")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self._stock(), 5)

    def test_cancel_restores_stock_exactly_once_and_reinstating_reserves_again(self):
        order_id = self._place(2)
        self.assertEqual(self._stock(), 3)

        self.client.force_authenticate(self.cce)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/cancel/").status_code, 200)
        self.assertEqual(self._stock(), 5)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/cancel/").status_code, 200)
        self.assertEqual(self._stock(), 5)

        self.assertEqual(self.client.post(f"/api/orders/{order_id}/confirm/").status_code, 200)
        self.assertEqual(self._stock(), 3)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/ship/").status_code, 200)
        self.assertEqual(self._stock(), 3)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/cancel/").status_code, 200)
        self.assertEqual(self._stock(), 5)

    def test_reinstating_fails_cleanly_when_stock_is_gone(self):
        order_id = self._place(2)
        self.client.force_authenticate(self.cce)
        self.client.post(f"/api/orders/{order_id}/cancel/")
        ProductVariation.objects.filter(pk=self.variation.pk).update(stock_quantity=1)

        response = self.client.post(f"/api/orders/{order_id}/confirm/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.get(pk=order_id).status, Order.Status.CANCELLED)
        self.assertEqual(self._stock(), 1)

    def test_legacy_cancelled_order_without_restore_log_is_not_double_deducted(self):
        order_id = self._place(2)
        # An order cancelled before stock restoration existed never gave its
        # stock back, so it is still held and reinstating must not deduct again.
        Order.objects.filter(pk=order_id).update(status=Order.Status.CANCELLED)
        self.client.force_authenticate(self.cce)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/confirm/").status_code, 200)
        self.assertEqual(self._stock(), 3)


class ManualOrderTests(OrderFixturesMixin, APITestCase):
    URL = "/api/orders/manual/"

    def setUp(self):
        self.make_users()
        self.set_charges("70", "100", "120")
        self.variation = self.make_variation(price="1000.00", stock=5, sku="A")
        self.other = self.make_variation(price="500.00", stock=5, sku="B")

    def test_cce_creates_order_with_server_side_totals_and_stock(self):
        self.client.force_authenticate(self.cce)
        payload = self.manual_payload(self.variation, 2, note="Call before delivery", shipping_total="0")
        payload["items"].append({"variation": self.other.id, "quantity": 1, "unit_price": "1"})

        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual(Decimal(data["subtotal"]), Decimal("2500"))
        self.assertEqual(Decimal(data["shipping_total"]), Decimal("70"))
        self.assertEqual(Decimal(data["grand_total"]), Decimal("2570"))
        self.assertEqual(data["status"], Order.Status.PENDING)
        self.assertEqual(data["note"], "Call before delivery")
        self.assertEqual(data["created_by"], self.cce.id)
        self.assertIsNone(data["user"])
        self.assertEqual(data["shipping_address_detail"]["zone"], "Dhaka Sadar")

        self.variation.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual((self.variation.stock_quantity, self.other.stock_quantity), (3, 4))
        self.assertEqual(InventoryLog.objects.filter(reference_id=data["order_number"], reason="order_placed").count(), 2)

    def test_outer_and_outside_zones(self):
        self.client.force_authenticate(self.cce)
        response = self.client.post(self.URL, self.manual_payload(self.variation, zone="Savar"), format="json")
        self.assertEqual(Decimal(response.data["shipping_total"]), Decimal("100"))
        response = self.client.post(
            self.URL, self.manual_payload(self.variation, district="Rajshahi", zone="Savar"), format="json"
        )
        self.assertEqual(Decimal(response.data["shipping_total"]), Decimal("120"))
        self.assertEqual(response.data["shipping_address_detail"]["zone"], "")

    def test_duplicate_submission_creates_one_order(self):
        self.client.force_authenticate(self.cce)
        payload = self.manual_payload(self.variation, 2, client_request_id=str(uuid.uuid4()))
        first = self.client.post(self.URL, payload, format="json")
        second = self.client.post(self.URL, payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Order.objects.count(), 1)
        self.variation.refresh_from_db()
        self.assertEqual(self.variation.stock_quantity, 3)

    def test_duplicate_lines_are_merged(self):
        self.client.force_authenticate(self.cce)
        payload = self.manual_payload(self.variation, 1)
        payload["items"].append({"variation": self.variation.id, "quantity": 2})
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["quantity"], 3)

    def test_rejects_invalid_input_without_side_effects(self):
        self.client.force_authenticate(self.cce)
        inactive = self.make_variation(sku="C", status=Product.Status.DRAFT)
        cases = [
            self.manual_payload(self.variation, 6),  # more than stock
            self.manual_payload(self.variation, 0),
            self.manual_payload(self.variation, -1),
            self.manual_payload(inactive, 1),
            self.manual_payload(self.variation, items=[]),
            self.manual_payload(self.variation, phone="12345"),
            self.manual_payload(self.variation, name="  "),
            self.manual_payload(self.variation, address=""),
            self.manual_payload(self.variation, zone=""),
            self.manual_payload(self.variation, coupon_code="NOPE"),
        ]
        for payload in cases:
            self.assertEqual(self.client.post(self.URL, payload, format="json").status_code, 400, payload)
        self.assertEqual(Order.objects.count(), 0)
        self.variation.refresh_from_db()
        self.assertEqual(self.variation.stock_quantity, 5)

    def test_existing_customer_profile_is_not_modified(self):
        Address.objects.create(user=self.customer, name="Home", address="Old", district="Khulna")
        self.client.force_authenticate(self.cce)
        payload = self.manual_payload(self.variation, customer=self.customer.id, name="Rahim (office)")
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user"], self.customer.id)
        self.assertEqual(self.customer.addresses.count(), 1)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, "Rahim Customer")

        # Only customer accounts can be attached to an order.
        payload = self.manual_payload(self.variation, customer=self.cce.id)
        self.assertEqual(self.client.post(self.URL, payload, format="json").status_code, 400)

    def test_coupon_discount_and_quote_match_created_order(self):
        Coupon.objects.create(code="FLAT100", type="flat", value=Decimal("100"))
        self.client.force_authenticate(self.cce)
        payload = self.manual_payload(self.variation, 2, coupon_code="flat100")
        payload["items"].append({"variation": self.other.id, "quantity": 1})

        quote = self.client.post("/api/orders/quote/", payload, format="json")
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertEqual(
            (quote.data["subtotal"], quote.data["discount_total"], quote.data["shipping_total"], quote.data["grand_total"]),
            (Decimal("2500"), Decimal("100"), Decimal("70"), Decimal("2470")),
        )

        order = self.client.post(self.URL, payload, format="json").data
        self.assertEqual(Decimal(order["grand_total"]), quote.data["grand_total"])
        self.assertEqual(Decimal(order["discount_total"]), Decimal("100"))
        self.assertEqual(OrderCoupon.objects.get(order_id=order["id"]).coupon.code, "FLAT100")

    def test_quote_without_zone_leaves_delivery_unpriced(self):
        self.client.force_authenticate(self.cce)
        response = self.client.post(
            "/api/orders/quote/",
            {"items": [{"variation": self.variation.id, "quantity": 1}], "district": "Dhaka"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["shipping_total"])
        self.assertEqual(response.data["grand_total"], Decimal("1000"))

    def test_only_order_managers_can_create_or_quote(self):
        payload = self.manual_payload(self.variation)
        self.assertEqual(self.client.post(self.URL, payload, format="json").status_code, 401)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.post(self.URL, payload, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/orders/quote/", payload, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.URL, payload, format="json").status_code, 201)


class CceDashboardAccessTests(OrderFixturesMixin, APITestCase):
    def setUp(self):
        self.make_users()

    def test_cce_gets_sales_overview_without_admin_business_data(self):
        self.client.force_authenticate(self.cce)
        for path in ("summary", "sales-trend", "order-status", "recent-orders"):
            self.assertEqual(self.client.get(f"/api/analytics/{path}/?range=this_month").status_code, 200, path)
        self.assertNotIn("business", self.client.get("/api/analytics/summary/").data)
        for path in ("top-products", "categories", "products", "customers", "export"):
            self.assertEqual(self.client.get(f"/api/analytics/{path}/").status_code, 403, path)

        self.client.force_authenticate(self.admin)
        self.assertIn("business", self.client.get("/api/analytics/summary/").data)

        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/analytics/summary/").status_code, 403)

    def test_customer_lookup(self):
        self.client.force_authenticate(self.cce)
        response = self.client.get("/api/customer-lookup/?search=rahim")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c["id"] for c in response.data], [self.customer.id])
        self.assertNotIn("role", response.data[0])
        self.assertEqual(self.client.get("/api/customer-lookup/?search=cce").data, [])
        self.assertEqual(self.client.get("/api/customer-lookup/?search=017111").data[0]["id"], self.customer.id)

        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/customer-lookup/?search=rahim").status_code, 403)

    def test_order_search_by_phone(self):
        address = Address.objects.create(name="Karim", phone="01999888777", address="x", district="Khulna")
        Order.objects.create(
            order_number="ORD-PHONE", subtotal=Decimal("1"), grand_total=Decimal("1"), shipping_address=address
        )
        self.client.force_authenticate(self.cce)
        response = self.client.get("/api/orders/?search=01999888")
        self.assertEqual([o["order_number"] for o in response.data["results"]], ["ORD-PHONE"])
