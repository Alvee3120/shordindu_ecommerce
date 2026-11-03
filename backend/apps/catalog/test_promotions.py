"""Basket-level promotional offers: engine rules and cart/checkout/order integration."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.orders.models import Coupon, Order, OrderItem
from apps.users.models import User

from .models import Category, Discount, Product, ProductVariation
from .promotions import PromotionEngine, Unit, group_plan

D = Decimal
ZERO = D("0.00")


def now():
    return timezone.now()


class PromotionFixtures:
    def make_catalog(self):
        self.parent = Category.objects.create(name="Skincare")
        self.child = Category.objects.create(name="Serums", parent=self.parent)
        self.other = Category.objects.create(name="Bags")
        self.serum = self.make_product("Vitamin C Serum", self.child, "2000.00", sku="SERUM")
        self.cream = self.make_product("Hydrating Cream", self.parent, "1000.00", sku="CREAM")
        self.bag = self.make_product("Tote Bag", self.other, "500.00", sku="BAG")

    def make_product(self, name, category, price, sku, stock=50):
        product = Product.objects.create(name=name, status=Product.Status.ACTIVE)
        product.categories.set([category])
        ProductVariation.objects.create(product=product, sku=sku, price=D(price), stock_quantity=stock)
        return product

    def variation(self, product):
        return ProductVariation.objects.select_related("product").get(product=product)

    def promo(self, *, type, products=None, categories=None, start=-1, end=1, active=True, name=None, **fields):
        discount = Discount.objects.create(
            name=name or f"{type}",
            type=type,
            target_type="products" if products is not None else "category",
            starts_at=now() + timedelta(days=start),
            ends_at=now() + timedelta(days=end),
            is_active=active,
            **fields,
        )
        if products:
            discount.products.set(products)
        if categories:
            discount.categories.set(categories)
        return discount


class PromotionEngineTests(PromotionFixtures, TestCase):
    def setUp(self):
        self.make_catalog()

    def units(self, *specs):
        """specs: (line_key, product, quantity, price=None)"""
        out = []
        for spec in specs:
            line_key, product, quantity = spec[:3]
            price = spec[3] if len(spec) > 3 else None
            variation = self.variation(product)
            unit_price = D(price) if price is not None else variation.price
            for _ in range(quantity):
                out.append(
                    Unit(
                        line_key=line_key,
                        product_id=product.pk,
                        variation_id=variation.pk,
                        price=unit_price,
                        category_ids=frozenset(product.categories.values_list("id", flat=True)),
                    )
                )
        return out

    def test_group_plan_shapes(self):
        self.assertEqual(
            group_plan(self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))),
            (3, 0, D("20"), None),
        )
        self.assertEqual(
            group_plan(self.promo(type="bxgy_free", products=[self.serum], min_quantity=2, free_quantity=1)),
            (3, 1, None, None),
        )
        self.assertEqual(
            group_plan(self.promo(type="lowest_free", products=[self.serum], min_quantity=3)),
            (3, 1, None, None),
        )
        self.assertEqual(
            group_plan(self.promo(type="three_for_two", products=[self.serum])),
            (3, 1, None, None),
        )

    def test_buy_x_get_percent_off(self):
        # 3 × ৳400 = ৳1,200; 20% = ৳240 → ৳960.
        cheap = self.make_product("Cheap", self.parent, "400.00", sku="CHEAP")
        self.promo(type="bxgy_percent", products=[cheap], min_quantity=3, percent_off=D("20"))
        applied = PromotionEngine().apply(self.units((0, cheap, 3, "400")))
        self.assertEqual(len(applied), 1)
        self.assertEqual(applied[0].discount_amount, D("240.00"))
        self.assertEqual(applied[0].qualifying_quantity, 3)
        self.assertEqual(applied[0].line_discounts[0], D("240.00"))

    def test_buy_x_get_y_free(self):
        self.promo(type="bxgy_free", products=[self.serum], min_quantity=2, free_quantity=1)
        applied = PromotionEngine().apply(self.units((0, self.serum, 3)))
        self.assertEqual(applied[0].discount_amount, D("2000.00"))
        self.assertEqual(applied[0].free_quantity, 1)
        self.assertEqual(applied[0].line_free_qty[0], 1)

    def test_lowest_priced_item_free(self):
        a = self.make_product("A", self.parent, "500.00", sku="A")
        b = self.make_product("B", self.parent, "400.00", sku="B")
        c = self.make_product("C", self.parent, "300.00", sku="C")
        self.promo(type="lowest_free", products=[a, b, c], min_quantity=3)
        applied = PromotionEngine().apply(self.units((0, a, 1), (1, b, 1), (2, c, 1)))
        self.assertEqual(applied[0].discount_amount, D("300.00"))
        self.assertEqual(applied[0].line_discounts[2], D("300.00"))

    def test_three_for_two_repeats(self):
        self.promo(type="three_for_two", products=[self.serum])
        three = PromotionEngine().apply(self.units((0, self.serum, 3)))
        self.assertEqual(three[0].discount_amount, D("2000.00"))
        six = PromotionEngine().apply(self.units((0, self.serum, 6)))
        self.assertEqual(six[0].discount_amount, D("4000.00"))
        self.assertEqual(six[0].free_quantity, 2)

    def test_fixed_bundle_price(self):
        a = self.make_product("A", self.parent, "500.00", sku="A")
        b = self.make_product("B", self.parent, "400.00", sku="B")
        c = self.make_product("C", self.parent, "300.00", sku="C")
        self.promo(type="bundle_price", products=[a, b, c], min_quantity=3, bundle_price=D("1000"))
        applied = PromotionEngine().apply(self.units((0, a, 1), (1, b, 1), (2, c, 1)))
        self.assertEqual(applied[0].discount_amount, D("200.00"))
        total = sum(applied[0].line_discounts.values(), ZERO)
        self.assertEqual(total, D("200.00"))

    def test_bundle_never_raises_price(self):
        self.promo(type="bundle_price", products=[self.serum], min_quantity=3, bundle_price=D("9000"))
        applied = PromotionEngine().apply(self.units((0, self.serum, 3)))
        self.assertEqual(applied, [])  # ৳6,000 subtotal is already below ৳9,000

    def test_below_minimum_quantity(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        self.assertEqual(PromotionEngine().apply(self.units((0, self.serum, 2))), [])

    def test_repeated_groups_leave_incomplete_group_alone(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        applied = PromotionEngine().apply(self.units((0, self.serum, 7)))
        # 2 complete groups of 3 (6 units) → 20% of 12,000 = 2,400; 1 leftover.
        self.assertEqual(applied[0].discount_amount, D("2400.00"))
        self.assertEqual(applied[0].qualifying_quantity, 6)

    def test_mixed_eligible_and_ineligible(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        applied = PromotionEngine().apply(self.units((0, self.serum, 3), (1, self.bag, 2)))
        self.assertEqual(applied[0].qualifying_quantity, 3)
        self.assertNotIn(1, applied[0].line_discounts)

    def test_category_target_includes_subcategories(self):
        self.promo(type="bxgy_percent", categories=[self.parent], min_quantity=2, percent_off=D("10"))
        applied = PromotionEngine().apply(self.units((0, self.serum, 2)))
        self.assertEqual(applied[0].discount_amount, D("400.00"))  # 10% of 4,000

    def test_multiple_categories_union_eligible_units(self):
        self.promo(type="bxgy_percent", categories=[self.parent, self.other], min_quantity=2, percent_off=D("10"))
        # Serum (Skincare › Serums) + Bag (Bags) both qualify → 10% of 2,500.
        applied = PromotionEngine().apply(self.units((0, self.serum, 1), (1, self.bag, 1)))
        self.assertEqual(applied[0].discount_amount, D("250.00"))
        self.assertEqual(applied[0].qualifying_quantity, 2)

    def test_variant_prices_drive_the_calculation(self):
        variable = Product.objects.create(name="Palette", status=Product.Status.ACTIVE)
        variable.categories.set([self.parent])
        cheap = ProductVariation.objects.create(product=variable, sku="PAL-C", price=D("300"), stock_quantity=10)
        pricey = ProductVariation.objects.create(product=variable, sku="PAL-P", price=D("700"), stock_quantity=10)
        self.promo(type="lowest_free", products=[variable], min_quantity=2)
        units = [
            Unit(line_key=0, product_id=variable.pk, variation_id=pricey.pk, price=D("700"),
                 category_ids=frozenset([self.parent.pk])),
            Unit(line_key=1, product_id=variable.pk, variation_id=cheap.pk, price=D("300"),
                 category_ids=frozenset([self.parent.pk])),
        ]
        applied = PromotionEngine().apply(units)
        self.assertEqual(applied[0].discount_amount, D("300.00"))
        self.assertEqual(applied[0].line_discounts[1], D("300.00"))

    def test_only_live_promotions_apply(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), start=1, end=2)
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), start=-5, end=-2)
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), active=False)
        self.assertEqual(PromotionEngine().apply(self.units((0, self.serum, 3))), [])

    def test_units_never_get_two_free_offers(self):
        # A product-specific offer wins over the category one; the 3 units are
        # consumed, so the category offer has nothing left to discount.
        self.promo(type="bxgy_free", categories=[self.parent], min_quantity=2, free_quantity=1, name="Category")
        self.promo(type="bxgy_free", products=[self.serum], min_quantity=2, free_quantity=1, name="Product")
        applied = PromotionEngine().apply(self.units((0, self.serum, 3)))
        self.assertEqual(len(applied), 1)
        self.assertEqual(applied[0].name, "Product")
        self.assertEqual(applied[0].discount_amount, D("2000.00"))

    def test_allocations_never_exceed_line_price(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=2, percent_off=D("100"))
        applied = PromotionEngine().apply(self.units((0, self.serum, 2)))
        self.assertEqual(applied[0].discount_amount, D("4000.00"))
        self.assertLessEqual(applied[0].line_discounts[0], D("4000.00"))


class PromotionCheckoutTests(PromotionFixtures, APITestCase):
    def setUp(self):
        self.make_catalog()
        self.customer = User.objects.create_user(email="u@x.com", password="pw", name="Customer")
        self.admin = User.objects.create_user(email="a@x.com", password="pw", name="Admin", role=User.Role.ADMIN)
        self.cce = User.objects.create_user(email="c@x.com", password="pw", name="CCE", role=User.Role.CCE)

    def add_to_cart(self, product, quantity=1):
        variation = self.variation(product)
        response = self.client.post(
            "/api/cart/items/",
            {"product": product.id, "variation": variation.id, "quantity": quantity},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        return response

    def checkout(self, **extra):
        return self.client.post(
            "/api/checkout/",
            {"shipping_address": "House 1", "shipping_district": "Khulna", "shipping_phone": "01712345678", **extra},
            format="json",
        )

    def cart(self):
        response = self.client.get("/api/cart/")
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_cart_shows_promotion_discount_and_net_totals(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        cart = self.cart()
        self.assertEqual(D(cart["promotion_discount_total"]), D("1200.00"))
        self.assertEqual(D(cart["subtotal"]), D("4800.00"))
        self.assertEqual(cart["promotions"][0]["label"], "Buy 3, get 20% off")
        line = cart["items"][0]
        self.assertEqual(D(line["promotion_discount"]), D("1200.00"))
        self.assertEqual(D(line["line_total"]), D("4800.00"))

    def test_checkout_applies_promotion_then_coupon(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        Coupon.objects.create(code="EXTRA10", type="percent", value=D("10"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        response = self.checkout(coupon_code="EXTRA10")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(D(response.data["subtotal"]), D("6000.00"))
        self.assertEqual(D(response.data["promotion_discount_total"]), D("1200.00"))
        self.assertEqual(D(response.data["discount_total"]), D("480.00"))  # 10% of the 4,800 net
        # 6000 − 1200 − 480 + 120 delivery = 4,440
        self.assertEqual(D(response.data["grand_total"]), D("4440.00"))

    def test_checkout_totals_match_line_items(self):
        self.promo(type="bxgy_free", products=[self.serum], min_quantity=2, free_quantity=1)
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        order_id = self.checkout().data["id"]
        order = Order.objects.get(pk=order_id)
        items = list(OrderItem.objects.filter(order=order))
        self.assertEqual(sum((i.line_total for i in items), ZERO), order.subtotal)
        self.assertEqual(sum((i.promotion_discount for i in items), ZERO), order.promotion_discount_total)
        expected = order.subtotal - order.promotion_discount_total - order.discount_total + order.shipping_total
        self.assertEqual(order.grand_total, expected)
        self.assertEqual(order.items.get().free_quantity, 1)

    def test_cart_change_before_checkout_is_repriced(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 2)  # below minimum → no discount
        self.assertEqual(D(self.cart()["promotion_discount_total"]), ZERO)
        item_id = self.cart()["items"][0]["id"]
        self.client.patch(f"/api/cart/items/{item_id}/", {"quantity": 3}, format="json")
        self.assertEqual(D(self.cart()["promotion_discount_total"]), D("1200.00"))

    def test_tampered_cart_prices_are_ignored_at_checkout(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        response = self.checkout(subtotal="1", promotion_discount_total="99999", grand_total="1")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(D(response.data["subtotal"]), D("6000.00"))
        self.assertEqual(D(response.data["promotion_discount_total"]), D("1200.00"))
        self.assertEqual(D(response.data["grand_total"]), D("4920.00"))  # 4800 + 120

    def test_historical_orders_are_frozen(self):
        promotion = self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        order_id = self.checkout().data["id"]

        promotion.percent_off = D("50")
        promotion.save()
        ProductVariation.objects.filter(product=self.serum).update(price=D("9999"))
        promotion.delete()

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.subtotal, D("6000.00"))
        self.assertEqual(order.promotion_discount_total, D("1200.00"))
        self.assertEqual(order.grand_total, D("4920.00"))
        item = order.items.get()
        self.assertEqual(item.promotion_discount, D("1200.00"))
        self.assertEqual(item.promotion_name_snapshot, "bxgy_percent")

    def test_scheduled_expired_inactive_do_not_apply(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), start=1, end=2)
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), start=-5, end=-2)
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), active=False)
        self.client.force_authenticate(self.customer)
        self.add_to_cart(self.serum, 3)
        self.assertEqual(D(self.cart()["promotion_discount_total"]), ZERO)

    def test_dashboard_quote_and_order_share_the_same_math(self):
        self.promo(type="bundle_price", products=[self.serum], min_quantity=3, bundle_price=D("5000"))
        self.client.force_authenticate(self.cce)
        payload = {
            "name": "Walk-in",
            "phone": "01812345678",
            "address": "House 9",
            "district": "Khulna",
            "items": [{"variation": self.variation(self.serum).id, "quantity": 3}],
        }
        quote = self.client.post("/api/orders/quote/", payload, format="json").data
        self.assertEqual(D(quote["subtotal"]), D("6000.00"))
        self.assertEqual(D(quote["promotion_discount_total"]), D("1000.00"))
        self.assertEqual(D(quote["grand_total"]), D("5120.00"))  # 6000 − 1000 + 120
        order = self.client.post("/api/orders/manual/", payload, format="json").data
        self.assertEqual(D(order["promotion_discount_total"]), D("1000.00"))
        self.assertEqual(D(order["grand_total"]), D("5120.00"))

    def test_showcase_lists_basket_promotion_products(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"), name="Serum Deal")
        sections = {s["name"]: s for s in self.client.get("/api/discount-showcases/").data}
        self.assertIn("Serum Deal", sections)
        section = sections["Serum Deal"]
        self.assertTrue(section["is_basket"])
        self.assertEqual(section["label"], "Buy 3, get 20% off")
        self.assertEqual({p["name"] for p in section["products"]}, {"Vitamin C Serum"})

    def test_shop_filter_lists_basket_promotion_products(self):
        # "View All" from a basket-promotion homepage section must list the
        # products the offer targets even though it never changes their price.
        promotion = self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        names = {p["name"] for p in self.client.get(f"/api/products/?discount={promotion.id}").data["results"]}
        self.assertEqual(names, {"Vitamin C Serum"})


class PromotionAdminApiTests(PromotionFixtures, APITestCase):
    URL = "/api/discounts/"

    def setUp(self):
        self.make_catalog()
        self.admin = User.objects.create_user(email="a@x.com", password="pw", name="Admin", role=User.Role.ADMIN)

    def test_admin_can_create_each_promotion_type(self):
        self.client.force_authenticate(self.admin)
        base = {
            "name": "Offer",
            "target_type": "products",
            "products": [self.serum.id],
            "starts_at": "2026-10-01T00:00",
            "ends_at": "2026-10-10T23:59",
            "is_active": True,
        }
        cases = [
            ({"type": "bxgy_percent", "min_quantity": 3, "percent_off": "20"}, "Buy 3, get 20% off"),
            ({"type": "bxgy_free", "min_quantity": 2, "free_quantity": 1}, "Buy 2, get 1 free"),
            ({"type": "lowest_free", "min_quantity": 3}, "Buy 3, get cheapest free"),
            ({"type": "three_for_two"}, "3 for 2"),
            ({"type": "bundle_price", "min_quantity": 3, "bundle_price": "1000"}, "3 for ৳1000"),
        ]
        for payload, label in cases:
            response = self.client.post(self.URL, {**base, **payload}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["label"], label)
            self.assertIsNone(response.data["value"])

    def test_promotion_validation(self):
        self.client.force_authenticate(self.admin)
        base = {
            "name": "Offer",
            "target_type": "products",
            "products": [self.serum.id],
            "starts_at": "2026-10-01T00:00",
            "ends_at": "2026-10-10T23:59",
        }
        cases = [
            ({"type": "bxgy_percent", "percent_off": "20"}, "min_quantity"),
            ({"type": "bxgy_percent", "min_quantity": 3}, "percent_off"),
            ({"type": "bxgy_percent", "min_quantity": 3, "percent_off": "150"}, "percent_off"),
            ({"type": "bxgy_free", "min_quantity": 2}, "free_quantity"),
            ({"type": "bundle_price", "min_quantity": 3}, "bundle_price"),
        ]
        for payload, field in cases:
            response = self.client.post(self.URL, {**base, **payload}, format="json")
            self.assertEqual(response.status_code, 400, payload)
            self.assertIn(field, response.data, payload)

    def test_only_admin_manages_promotions(self):
        self.promo(type="bxgy_percent", products=[self.serum], min_quantity=3, percent_off=D("20"))
        cce = User.objects.create_user(email="c@x.com", password="pw", name="CCE", role=User.Role.CCE)
        self.client.force_authenticate(cce)
        self.assertEqual(self.client.get(self.URL).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.URL).status_code, 200)
