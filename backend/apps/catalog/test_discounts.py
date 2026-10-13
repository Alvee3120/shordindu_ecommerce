"""Automatic discounts: pricing rules, admin API, and cart/checkout/order integration."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.cart.models import CartItem
from apps.catalog.models import Category, Discount, Product, ProductAddon, ProductVariation
from apps.catalog.pricing import PricingEngine
from apps.orders.models import Coupon, Order, OrderItem
from apps.users.models import User


def now():
    return timezone.now()


class DiscountFixtures:
    def make_catalog(self):
        self.parent = Category.objects.create(name="Skincare")
        self.child = Category.objects.create(name="Serums", parent=self.parent)
        self.other = Category.objects.create(name="Bags")
        self.serum = self.make_product("Vitamin C Serum", self.child, "2000.00", sku="SERUM")
        self.cream = self.make_product("Hydrating Cream", self.parent, "1000.00", sku="CREAM")
        self.bag = self.make_product("Tote Bag", self.other, "500.00", sku="BAG")

    def make_product(self, name, category, price, sku, stock=20):
        product = Product.objects.create(name=name, status=Product.Status.ACTIVE)
        product.categories.set([category])
        ProductVariation.objects.create(product=product, sku=sku, price=Decimal(price), stock_quantity=stock)
        return product

    def variation(self, product):
        return ProductVariation.objects.select_related("product").get(product=product)

    def discount(self, *, products=None, category=None, type="percent", value="20", start=-1, end=1, active=True, name=None):
        discount = Discount.objects.create(
            name=name or f"{type} {value}",
            type=type,
            value=Decimal(value),
            target_type="products" if products is not None else "category",
            category=category,
            starts_at=now() + timedelta(days=start),
            ends_at=now() + timedelta(days=end),
            is_active=active,
        )
        if products:
            discount.products.set(products)
        return discount


class PricingEngineTests(DiscountFixtures, TestCase):
    def setUp(self):
        self.make_catalog()

    def price(self, product):
        return PricingEngine().quote(self.variation(product))

    def test_no_discount_keeps_base_price(self):
        quote = self.price(self.serum)
        self.assertEqual((quote.base_price, quote.final_price, quote.discount), (Decimal("2000"), Decimal("2000"), None))

    def test_percent_and_fixed(self):
        self.discount(products=[self.serum], value="20")
        self.discount(products=[self.cream], type="fixed", value="300")
        self.assertEqual(self.price(self.serum).final_price, Decimal("1600.00"))
        self.assertEqual(self.price(self.serum).discount_amount, Decimal("400.00"))
        self.assertEqual(self.price(self.cream).final_price, Decimal("700.00"))
        self.assertEqual(self.price(self.bag).final_price, Decimal("500.00"))  # untouched

    def test_percent_rounds_to_two_places(self):
        ProductVariation.objects.filter(product=self.bag).update(price=Decimal("999.99"))
        self.discount(products=[self.bag], value="15")
        self.assertEqual(self.price(self.bag).final_price, Decimal("849.99"))  # 150.00 saving (149.9985)

    def test_only_live_discounts_apply(self):
        self.discount(products=[self.serum], value="50", start=1, end=2)  # scheduled
        self.discount(products=[self.serum], value="50", start=-3, end=-1)  # expired
        self.discount(products=[self.serum], value="50", active=False)  # switched off
        self.assertIsNone(self.price(self.serum).discount)

    def test_category_discount_includes_sub_categories_only(self):
        self.discount(category=self.parent, value="10")
        self.assertEqual(self.price(self.serum).final_price, Decimal("1800.00"))  # child of Skincare
        self.assertEqual(self.price(self.cream).final_price, Decimal("900.00"))
        self.assertEqual(self.price(self.bag).final_price, Decimal("500.00"))

        Discount.objects.all().delete()
        self.discount(category=self.child, value="10")  # child-only discount doesn't reach parent products
        self.assertIsNone(self.price(self.cream).discount)
        self.assertIsNotNone(self.price(self.serum).discount)

    def test_product_discount_beats_category_even_if_smaller(self):
        self.discount(category=self.parent, value="50", name="Category 50%")
        product_discount = self.discount(products=[self.serum], value="5", name="Product 5%")
        quote = self.price(self.serum)
        self.assertEqual(quote.discount, product_discount)
        self.assertEqual(quote.final_price, Decimal("1900.00"))
        self.assertEqual(self.price(self.cream).final_price, Decimal("500.00"))  # category still applies

    def test_within_a_tier_the_bigger_saving_wins_without_stacking(self):
        self.discount(category=self.parent, value="10")
        best = self.discount(category=self.child, type="fixed", value="500")
        quote = self.price(self.serum)
        self.assertEqual(quote.discount, best)
        self.assertEqual(quote.final_price, Decimal("1500.00"))

    def test_fixed_discount_bigger_than_price_does_not_apply(self):
        self.discount(category=self.parent, type="fixed", value="1500")
        self.assertEqual(self.price(self.serum).final_price, Decimal("500.00"))
        self.assertIsNone(self.price(self.cream).discount)  # ৳1500 off a ৳1000 item would go negative

    def test_hundred_percent_is_free_not_negative(self):
        self.discount(products=[self.bag], value="100")
        self.assertEqual(self.price(self.bag).final_price, Decimal("0.00"))

    def test_base_price_is_never_modified(self):
        self.discount(products=[self.serum], value="20")
        self.price(self.serum)
        self.assertEqual(self.variation(self.serum).price, Decimal("2000.00"))


class DiscountApiTests(DiscountFixtures, APITestCase):
    URL = "/api/discounts/"

    def setUp(self):
        self.make_catalog()
        self.admin = User.objects.create_user(email="a@x.com", password="pw", name="Admin", role=User.Role.ADMIN)
        self.cce = User.objects.create_user(email="c@x.com", password="pw", name="CCE", role=User.Role.CCE)
        self.customer = User.objects.create_user(email="u@x.com", password="pw", name="Customer")

    def payload(self, **overrides):
        data = {
            "name": "Summer Sale",
            "type": "percent",
            "value": "20",
            "target_type": "category",
            "category": self.parent.id,
            "starts_at": "2026-10-01T00:00",
            "ends_at": "2026-10-10T23:59",
            "is_active": True,
        }
        data.update(overrides)
        return data

    def test_admin_crud(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.URL, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        discount_id = response.data["id"]
        self.assertEqual(response.data["category_name"], "Skincare")
        self.assertTrue(response.data["starts_at"].startswith("2026-10-01T00:00:00+06:00"))
        self.assertEqual(Discount.objects.get().created_by, self.admin)

        response = self.client.patch(
            f"{self.URL}{discount_id}/",
            {"target_type": "products", "products": [self.serum.id, self.cream.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["category"])
        self.assertEqual(response.data["product_count"], 2)

        detail = self.client.get(f"{self.URL}{discount_id}/").data
        self.assertEqual({p["name"] for p in detail["product_details"]}, {"Vitamin C Serum", "Hydrating Cream"})

        self.assertEqual(self.client.patch(f"{self.URL}{discount_id}/", {"is_active": False}, format="json").data["status"], "inactive")
        self.assertEqual(self.client.delete(f"{self.URL}{discount_id}/").status_code, 204)
        self.assertFalse(Discount.objects.exists())

    def test_only_admin_has_access(self):
        existing = self.discount(products=[self.serum])
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        for user in (self.cce, self.customer):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.URL).status_code, 403)
            self.assertEqual(self.client.post(self.URL, self.payload(), format="json").status_code, 403)
            self.assertEqual(self.client.patch(f"{self.URL}{existing.id}/", {"value": "99"}, format="json").status_code, 403)
            self.assertEqual(self.client.delete(f"{self.URL}{existing.id}/").status_code, 403)
        existing.refresh_from_db()
        self.assertEqual(existing.value, Decimal("20"))

    def test_validation(self):
        self.client.force_authenticate(self.admin)
        cases = [
            ({"value": "0"}, "value"),
            ({"value": "-5"}, "value"),
            ({"value": "100.01"}, "value"),
            ({"value": "abc"}, "value"),
            ({"type": "bogus"}, "type"),
            ({"name": "  "}, "name"),
            ({"ends_at": "2026-10-01T00:00"}, "ends_at"),
            ({"ends_at": "2026-09-01T00:00"}, "ends_at"),
            ({"starts_at": "not a date"}, "starts_at"),
            ({"category": None}, "category"),
            ({"category": 99999}, "category"),
            ({"target_type": "products", "products": []}, "products"),
            ({"target_type": "products", "products": [99999]}, "products"),
            # Cheapest item under Skincare is the ৳1000 cream.
            ({"type": "fixed", "value": "1000.01"}, "value"),
        ]
        for overrides, field in cases:
            response = self.client.post(self.URL, self.payload(**overrides), format="json")
            self.assertEqual(response.status_code, 400, overrides)
            self.assertIn(field, response.data, overrides)
        self.assertFalse(Discount.objects.exists())

        self.assertEqual(self.client.post(self.URL, self.payload(value="100"), format="json").status_code, 201)
        self.assertEqual(
            self.client.post(self.URL, self.payload(type="fixed", value="1000"), format="json").status_code, 201
        )

    def test_target_switch_clears_the_other_target(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.URL, self.payload(target_type="products", products=[self.serum.id]), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["category"])
        response = self.client.post(self.URL, self.payload(products=[self.serum.id]), format="json")
        self.assertEqual(response.data["product_count"], 0)

    def test_status_and_filters(self):
        self.discount(products=[self.serum], name="Live", value="10")
        self.discount(products=[self.serum], name="Soon", start=2, end=3)
        self.discount(products=[self.serum], name="Gone", start=-5, end=-2)
        self.discount(category=self.parent, name="Off", active=False, type="fixed", value="50")
        self.client.force_authenticate(self.admin)

        rows = {d["name"]: d["status"] for d in self.client.get(self.URL).data["results"]}
        self.assertEqual(rows, {"Live": "active", "Soon": "scheduled", "Gone": "expired", "Off": "inactive"})
        for status_value, name in (("active", "Live"), ("scheduled", "Soon"), ("expired", "Gone"), ("inactive", "Off")):
            names = [d["name"] for d in self.client.get(f"{self.URL}?status={status_value}").data["results"]]
            self.assertEqual(names, [name], status_value)
        self.assertEqual([d["name"] for d in self.client.get(f"{self.URL}?type=fixed").data["results"]], ["Off"])
        self.assertEqual([d["name"] for d in self.client.get(f"{self.URL}?target_type=category").data["results"]], ["Off"])
        self.assertEqual([d["name"] for d in self.client.get(f"{self.URL}?search=soo").data["results"]], ["Soon"])


class DiscountStorefrontTests(DiscountFixtures, APITestCase):
    def setUp(self):
        self.make_catalog()
        self.customer = User.objects.create_user(email="u@x.com", password="pw", name="Customer")
        self.cce = User.objects.create_user(email="c@x.com", password="pw", name="CCE", role=User.Role.CCE)

    def add_to_cart(self, product, quantity=1):
        variation = self.variation(product)
        response = self.client.post(
            "/api/cart/items/", {"product": product.id, "variation": variation.id, "quantity": quantity}, format="json"
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        return response

    def checkout(self, **extra):
        return self.client.post(
            "/api/checkout/",
            {"shipping_address": "House 1", "shipping_district": "Khulna", "shipping_phone": "01712345678", **extra},
            format="json",
        )

    def test_product_api_exposes_base_and_effective_price(self):
        self.discount(products=[self.serum], value="20", name="Summer Sale")
        listing = {p["name"]: p["variations"][0] for p in self.client.get("/api/products/").data["results"]}
        serum = listing["Vitamin C Serum"]
        self.assertEqual((serum["price"], serum["effective_price"]), ("2000.00", "1600.00"))
        self.assertEqual(serum["discount"]["name"], "Summer Sale")
        self.assertEqual(serum["discount"]["amount"], "400.00")
        self.assertIsNone(listing["Tote Bag"]["discount"])
        detail = self.client.get(f"/api/products/{self.serum.id}/").data["variations"][0]
        self.assertEqual(detail["effective_price"], "1600.00")

    def test_cart_follows_the_discount_window(self):
        discount = self.discount(products=[self.serum], value="20")
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 2)
        cart = self.client.get("/api/cart/").data
        self.assertEqual(Decimal(cart["items"][0]["unit_price_snapshot"]), Decimal("1600"))
        self.assertEqual(cart["items"][0]["original_unit_price"], "2000.00")
        self.assertEqual(Decimal(cart["subtotal"]), Decimal("3200"))

        discount.ends_at = now() - timedelta(minutes=1)  # expires while in the cart
        discount.save()
        cart = self.client.get("/api/cart/").data
        self.assertEqual(Decimal(cart["items"][0]["unit_price_snapshot"]), Decimal("2000"))
        self.assertIsNone(cart["items"][0]["original_unit_price"])
        self.assertEqual(Decimal(cart["subtotal"]), Decimal("4000"))

    def test_checkout_reprices_and_ignores_stale_or_tampered_snapshots(self):
        self.discount(products=[self.serum], value="20")
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum)
        CartItem.objects.update(unit_price_snapshot=Decimal("1.00"))  # stale/tampered value
        response = self.checkout(subtotal="1", unit_price="1")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("1600"))
        item = response.data["items"][0]
        self.assertEqual((item["unit_price"], item["original_unit_price"]), ("1600.00", "2000.00"))
        self.assertEqual(item["discount_name_snapshot"], "percent 20")

    def test_historical_orders_keep_their_prices(self):
        discount = self.discount(category=self.parent, value="20")
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.cream)
        order_id = self.checkout().data["id"]

        discount.value = Decimal("50")
        discount.save()
        ProductVariation.objects.filter(product=self.cream).update(price=Decimal("5000"))
        discount.delete()

        item = OrderItem.objects.get(order_id=order_id)
        self.assertEqual((item.unit_price, item.original_unit_price), (Decimal("800.00"), Decimal("1000.00")))
        self.assertEqual(item.discount_name_snapshot, "percent 20")
        self.assertEqual(Order.objects.get(pk=order_id).subtotal, Decimal("800.00"))

    def test_coupon_applies_after_the_automatic_discount(self):
        self.discount(products=[self.serum], value="20")
        Coupon.objects.create(code="EXTRA10", type="percent", value=Decimal("10"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum)
        response = self.checkout(coupon_code="EXTRA10")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("1600"))
        self.assertEqual(Decimal(response.data["discount_total"]), Decimal("160"))

    def test_addon_with_price_override_keeps_addon_pricing(self):
        ProductAddon.objects.create(parent_product=self.serum, addon_product=self.bag, price_override=Decimal("99"))
        self.discount(products=[self.bag], value="50")
        self.client.force_authenticate(self.customer)
        parent = self.add_to_cart(self.serum).data
        bag_variation = self.variation(self.bag)
        response = self.client.post(
            f"/api/cart/items/{parent['id']}/addons/",
            {"product": self.bag.id, "variation": bag_variation.id, "quantity": 1},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        child = self.client.get("/api/cart/").data["items"][0]["children"][0]
        self.assertEqual(Decimal(child["unit_price_snapshot"]), Decimal("99"))

    def test_dashboard_orders_use_discounted_prices(self):
        self.discount(products=[self.serum], type="fixed", value="300")
        self.client.force_authenticate(self.cce)
        payload = {
            "name": "Walk-in",
            "phone": "01812345678",
            "address": "House 9",
            "district": "Khulna",
            "items": [{"variation": self.variation(self.serum).id, "quantity": 2}],
        }
        quote = self.client.post("/api/orders/quote/", payload, format="json").data
        self.assertEqual(quote["subtotal"], Decimal("3400.00"))
        self.assertEqual(quote["items"][0]["original_unit_price"], Decimal("2000.00"))
        order = self.client.post("/api/orders/manual/", payload, format="json").data
        self.assertEqual(Decimal(order["subtotal"]), Decimal("3400.00"))
        self.assertEqual(order["items"][0]["original_unit_price"], "2000.00")


class DiscountShowcaseTests(DiscountFixtures, APITestCase):
    URL = "/api/discount-showcases/"

    def setUp(self):
        self.make_catalog()

    def sections(self):
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        return {s["name"]: s for s in response.data}

    def product_names(self, section):
        return {p["name"] for p in section["products"]}

    def test_only_live_discounts_with_their_own_names(self):
        self.discount(category=self.parent, name="Skincare Week")
        self.discount(products=[self.bag], name="Future Sale", start=1, end=2)
        self.discount(products=[self.bag], name="Old Sale", start=-5, end=-2)
        self.discount(products=[self.bag], name="Paused Sale", active=False)
        self.assertEqual(set(self.sections()), {"Skincare Week"})

    def test_category_section_includes_sub_categories_and_nothing_else(self):
        self.discount(category=self.parent, name="Skincare Week", value="20")
        section = self.sections()["Skincare Week"]
        self.assertEqual(self.product_names(section), {"Vitamin C Serum", "Hydrating Cream"})
        self.assertEqual(section["product_count"], 2)
        self.assertEqual(section["category"]["name"], "Skincare")
        serum = next(p for p in section["products"] if p["name"] == "Vitamin C Serum")
        self.assertEqual(serum["variations"][0]["effective_price"], "1600.00")

    def test_product_section_shows_only_selected_products(self):
        self.discount(products=[self.serum, self.bag], name="Lipstick Special", type="fixed", value="100")
        section = self.sections()["Lipstick Special"]
        self.assertEqual(self.product_names(section), {"Vitamin C Serum", "Tote Bag"})
        self.assertEqual(section["value"], "100.00")

    def test_multiple_discounts_get_separate_sections(self):
        self.discount(category=self.parent, name="Skincare Week")
        self.discount(products=[self.bag], name="Bag Deal")
        sections = self.sections()
        self.assertEqual(set(sections), {"Skincare Week", "Bag Deal"})
        self.assertEqual(self.product_names(sections["Bag Deal"]), {"Tote Bag"})

    def test_product_overridden_by_its_own_discount_moves_to_that_section(self):
        self.discount(category=self.parent, name="Skincare Week", value="10")
        self.discount(products=[self.serum], name="Serum Special", value="30")
        sections = self.sections()
        self.assertEqual(self.product_names(sections["Skincare Week"]), {"Hydrating Cream"})
        self.assertEqual(self.product_names(sections["Serum Special"]), {"Vitamin C Serum"})

    def test_no_empty_sections(self):
        hidden = Product.objects.create(name="Draft", status=Product.Status.DRAFT)
        ProductVariation.objects.create(product=hidden, sku="DRAFT", price=Decimal("100"))
        addon_only = self.make_product("Gift Wrap", self.other, "50.00", sku="WRAP")
        addon_only.visibility_type = Product.VisibilityType.ADDON_ONLY
        addon_only.save()
        self.discount(products=[hidden, addon_only], name="Nothing To Show")
        self.discount(category=self.other, name="Too Big", type="fixed", value="600")  # > ৳500 bag
        self.assertEqual(self.sections(), {})

    def test_admin_edits_are_reflected(self):
        discount = self.discount(products=[self.serum], name="Summer Sale")
        self.assertIn("Summer Sale", self.sections())
        discount.name = "Summer Beauty Festival"
        discount.save()
        discount.products.set([self.bag])
        sections = self.sections()
        self.assertEqual(set(sections), {"Summer Beauty Festival"})
        self.assertEqual(self.product_names(sections["Summer Beauty Festival"]), {"Tote Bag"})
        discount.is_active = False
        discount.save()
        self.assertEqual(self.sections(), {})

    def test_shop_filter_by_discount(self):
        live = self.discount(category=self.parent, name="Skincare Week")
        expired = self.discount(products=[self.bag], name="Old", start=-5, end=-2)
        names = {p["name"] for p in self.client.get(f"/api/products/?discount={live.id}").data["results"]}
        self.assertEqual(names, {"Vitamin C Serum", "Hydrating Cream"})
        self.assertEqual(self.client.get(f"/api/products/?discount={expired.id}").data["count"], 0)
        self.assertEqual(self.client.get("/api/products/?discount=99999").data["count"], 0)
