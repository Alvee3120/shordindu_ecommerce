from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, ProductVariation
from apps.orders.models import Order, OrderItem
from apps.users.models import User

from .date_ranges import resolve_range

ZERO = Decimal("0.00")


class AnalyticsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email="admin@example.com", password="pw12345", name="Admin")
        self.admin.role = User.Role.ADMIN
        self.admin.is_staff = True
        self.admin.save()

        self.customer = User.objects.create_user(email="cust@example.com", password="pw12345", name="Cust")
        self.cce = User.objects.create_user(email="cce@example.com", password="pw12345", name="Cce")
        self.cce.role = User.Role.CCE
        self.cce.save()

        self.category = Category.objects.create(name="Sharee")
        self.child = Category.objects.create(name="Silk Sharee", parent=self.category)
        self.product = Product.objects.create(name="ABC Sharee", status=Product.Status.ACTIVE, sku_prefix="ABC")
        self.product.categories.add(self.category)
        self.variation = ProductVariation.objects.create(
            product=self.product, sku="ABC-1", price=Decimal("1000"), stock_quantity=10
        )
        self.other_product = Product.objects.create(name="XYZ Pant", status=Product.Status.DRAFT)
        self.other_product.categories.add(self.child)
        self.other_variation = ProductVariation.objects.create(
            product=self.other_product, sku="XYZ-1", price=Decimal("500"), stock_quantity=0
        )

    # -- helpers -----------------------------------------------------------
    def make_order(self, *, status, when, unit_price, quantity=1, discount=ZERO, shipping=ZERO,
                   product=None, variation=None, user=None):
        product = product or self.product
        variation = variation or self.variation
        subtotal = unit_price * quantity
        order = Order.objects.create(
            order_number=f"ORD{Order.objects.count() + 1:06d}",
            user=user,
            status=status,
            subtotal=subtotal,
            discount_total=discount,
            shipping_total=shipping,
            grand_total=subtotal - discount + shipping,
        )
        Order.objects.filter(pk=order.pk).update(placed_at=when)
        order.refresh_from_db()
        OrderItem.objects.create(
            order=order,
            product=product,
            variation=variation,
            product_name_snapshot=product.name,
            variation_label_snapshot=variation.sku,
            quantity=quantity,
            unit_price=unit_price,
            line_total=unit_price * quantity,
        )
        return order

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def get(self, path, **params):
        return self.client.get(path, params)

    # -- permissions -------------------------------------------------------
    def test_requires_admin(self):
        a = self.client.get("/api/analytics/summary/?range=today")
        self.assertEqual(a.status_code, 401)

        self.auth(self.customer)
        c = self.client.get("/api/analytics/summary/?range=today")
        self.assertEqual(c.status_code, 403)

        self.auth(self.cce)
        cce = self.client.get("/api/analytics/summary/?range=today")
        self.assertEqual(cce.status_code, 403)

        self.auth(self.admin)
        ok = self.client.get("/api/analytics/summary/?range=today")
        self.assertEqual(ok.status_code, 200)

    # -- summary -----------------------------------------------------------
    def test_summary_excludes_pending_and_cancelled(self):
        now = timezone.now()
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("1000"),
                        discount=Decimal("100"), shipping=Decimal("70"))
        self.make_order(status=Order.Status.CONFIRMED, when=now, unit_price=Decimal("500"),
                        shipping=Decimal("120"))
        self.make_order(status=Order.Status.PENDING, when=now, unit_price=Decimal("300"))
        self.make_order(status=Order.Status.CANCELLED, when=now, unit_price=Decimal("200"))

        self.auth(self.admin)
        data = self.client.get("/api/analytics/summary/?range=today").json()["sales"]

        self.assertEqual(Decimal(data["gross_sales"]["value"]), Decimal("1500.00"))
        self.assertEqual(Decimal(data["net_sales"]["value"]), Decimal("1400.00"))
        self.assertEqual(Decimal(data["discounts"]["value"]), Decimal("100.00"))
        self.assertEqual(Decimal(data["delivery_charges"]["value"]), Decimal("190.00"))
        self.assertEqual(data["qualifying_orders"]["value"], 2)
        self.assertEqual(data["total_orders"]["value"], 4)
        self.assertEqual(data["units_sold"]["value"], 2)
        self.assertEqual(data["cancelled_orders"]["value"], 1)
        self.assertEqual(Decimal(data["average_order_value"]["value"]), Decimal("700.00"))

    def test_summary_change_pct_null_when_previous_zero(self):
        self.make_order(status=Order.Status.DELIVERED, when=timezone.now(), unit_price=Decimal("1000"))
        self.auth(self.admin)
        net = self.client.get("/api/analytics/summary/?range=today").json()["sales"]["net_sales"]
        self.assertIsNone(net["change_pct"])

    def test_summary_business_metrics_are_current_state(self):
        self.auth(self.admin)
        business = self.client.get("/api/analytics/summary/?range=today").json()["business"]
        self.assertEqual(business["total_products"]["value"], 2)
        self.assertEqual(business["active_products"]["value"], 1)
        self.assertEqual(business["out_of_stock_products"]["value"], 1)  # XYZ has 0 stock
        self.assertEqual(business["low_stock_products"]["value"], 0)
        self.assertEqual(business["total_categories"]["value"], 2)
        # current-state metrics carry no change_pct
        self.assertNotIn("change_pct", business["total_products"])

    # -- date ranges -------------------------------------------------------
    def test_invalid_custom_range(self):
        self.auth(self.admin)
        bad_order = self.client.get("/api/analytics/summary/?range=custom&start=2026-05-10&end=2026-05-01")
        self.assertEqual(bad_order.status_code, 400)
        future = self.client.get(
            f"/api/analytics/summary/?range=custom&start=2020-01-01&end=2999-01-01"
        )
        self.assertEqual(future.status_code, 400)

    def test_unknown_range_key(self):
        self.auth(self.admin)
        self.assertEqual(self.client.get("/api/analytics/summary/?range=nope").status_code, 400)

    def test_resolve_range_presets(self):
        today = date(2026, 3, 15)  # a Sunday
        this_week = resolve_range("this_week", today=today)
        self.assertEqual(this_week.start_date, date(2026, 3, 9))  # Monday
        self.assertEqual(this_week.end_date, today)

        last_month = resolve_range("last_month", today=today)
        self.assertEqual(last_month.start_date, date(2026, 2, 1))
        self.assertEqual(last_month.end_date, date(2026, 2, 28))

        # previous period is the same length as the current one
        self.assertEqual(
            last_month.prev_end - last_month.prev_start, last_month.end - last_month.start
        )

    # -- category attribution ---------------------------------------------
    def test_category_direct_attribution_and_rollup(self):
        now = timezone.now()
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("1000"))
        self.make_order(
            status=Order.Status.DELIVERED, when=now, unit_price=Decimal("500"),
            product=self.other_product, variation=self.other_variation,
        )
        self.auth(self.admin)
        data = self.client.get("/api/analytics/categories/?range=today").json()
        by_id = {row["id"]: row for row in data["results"]}

        self.assertEqual(Decimal(by_id[self.category.id]["net_sales"]), Decimal("1000.00"))
        self.assertEqual(Decimal(by_id[self.child.id]["net_sales"]), Decimal("500.00"))
        self.assertIsNone(by_id[self.category.id]["parent_name"])
        self.assertEqual(by_id[self.child.id]["parent_name"], "Sharee")
        # parent rolls up its own + child sales
        self.assertEqual(Decimal(by_id[self.category.id]["rollup_net_sales"]), Decimal("1500.00"))
        # contribution is computed against the category-attributed total
        self.assertEqual(Decimal(data["attributed_net_sales"]), Decimal("1500.00"))

    # -- top products ------------------------------------------------------
    def test_top_products_sorted_by_units(self):
        now = timezone.now()
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("1000"), quantity=1)
        self.make_order(
            status=Order.Status.DELIVERED, when=now, unit_price=Decimal("500"), quantity=3,
            product=self.other_product, variation=self.other_variation,
        )
        self.auth(self.admin)
        results = self.client.get("/api/analytics/top-products/?range=today&sort=units").json()["results"]
        self.assertEqual(results[0]["id"], self.other_product.id)
        self.assertEqual(results[0]["units_sold"], 3)

    # -- trend -------------------------------------------------------------
    def test_sales_trend_daily_point(self):
        self.make_order(status=Order.Status.DELIVERED, when=timezone.now(), unit_price=Decimal("1000"))
        self.auth(self.admin)
        data = self.client.get("/api/analytics/sales-trend/?range=today").json()
        self.assertEqual(data["granularity"], "daily")
        self.assertEqual(len(data["points"]), 1)
        self.assertEqual(Decimal(data["points"][0]["revenue"]), Decimal("1000.00"))
        self.assertEqual(data["points"][0]["orders"], 1)

    # -- granularity -------------------------------------------------------
    def test_yearly_granularity(self):
        long_range = resolve_range("custom", start="2020-01-01", end="2026-10-01")
        self.assertEqual(long_range.granularity("auto"), "yearly")

        self.auth(self.admin)
        data = self.client.get(
            "/api/analytics/sales-trend/?range=custom&start=2020-01-01&end=2026-10-01&granularity=yearly"
        ).json()
        self.assertEqual(data["granularity"], "yearly")
        self.assertTrue(all(len(point["label"]) == 4 for point in data["points"]))

    # -- product comparison / movers --------------------------------------
    def test_product_compare_and_movers(self):
        now = timezone.now()
        # Product A sells 5 units this period, none before -> growing.
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("100"), quantity=5)
        # Product B sold 3 units yesterday (the previous period), none today -> declining.
        self.make_order(
            status=Order.Status.DELIVERED, when=now - timedelta(days=1), unit_price=Decimal("100"),
            quantity=3, product=self.other_product, variation=self.other_variation,
        )
        self.auth(self.admin)

        declining = self.client.get("/api/analytics/products/?range=today&compare=1&movers=declining").json()
        self.assertEqual(declining["results"][0]["id"], self.other_product.id)
        self.assertEqual(declining["results"][0]["delta_units"], -3)
        self.assertEqual(declining["results"][0]["prev_units_sold"], 3)

        growing = self.client.get("/api/analytics/products/?range=today&compare=1&movers=growing").json()
        self.assertEqual(growing["results"][0]["id"], self.product.id)
        self.assertEqual(growing["results"][0]["delta_units"], 5)

        # Without compare, the previous-period fields serialize as null.
        plain = self.client.get("/api/analytics/products/?range=today").json()
        self.assertIsNone(plain["results"][0]["prev_units_sold"])

    # -- order status ------------------------------------------------------
    def test_order_status_distribution(self):
        now = timezone.now()
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("100"))
        self.make_order(status=Order.Status.CANCELLED, when=now, unit_price=Decimal("100"))
        self.auth(self.admin)
        data = self.client.get("/api/analytics/order-status/?range=today").json()
        counts = {row["status"]: row["count"] for row in data["results"]}
        self.assertEqual(counts["delivered"], 1)
        self.assertEqual(counts["cancelled"], 1)
        self.assertEqual(data["total"], 2)

    # -- customers ---------------------------------------------------------
    def test_customer_summary_and_table(self):
        now = timezone.now()
        self.make_order(status=Order.Status.DELIVERED, when=now, unit_price=Decimal("1000"),
                        user=self.customer)
        self.auth(self.admin)
        summary = self.client.get("/api/analytics/customers/summary/?range=today").json()
        self.assertEqual(summary["active_customers"], 1)
        self.assertEqual(summary["new_ordering_customers"], 1)

        table = self.client.get("/api/analytics/customers/?range=today").json()
        self.assertEqual(table["count"], 1)  # only role=customer users are listed
        self.assertEqual(table["results"][0]["total_orders"], 1)

    # -- export ------------------------------------------------------------
    def test_csv_export(self):
        self.make_order(status=Order.Status.DELIVERED, when=timezone.now(), unit_price=Decimal("1000"))
        self.auth(self.admin)
        response = self.client.get("/api/analytics/export/?range=today&dataset=products")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        body = b"".join(response.streaming_content).decode()
        self.assertIn("units_sold", body)
