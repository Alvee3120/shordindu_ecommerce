from decimal import Decimal

from rest_framework.test import APITestCase

from apps.orders.models import Order
from apps.users.models import User


class CceOrderPermissionsTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(email="customer@example.com", password="pw", name="Customer")
        self.cce = User.objects.create_user(
            email="cce@example.com", password="pw", name="CCE", role=User.Role.CCE
        )
        self.order = Order.objects.create(
            order_number="ORD-TEST-001",
            user=self.customer,
            subtotal=Decimal("100.00"),
            shipping_total=Decimal("60.00"),
            grand_total=Decimal("160.00"),
        )

    def test_cce_can_view_all_orders_and_change_each_status(self):
        self.client.force_authenticate(self.cce)

        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

        for action, expected_status in (
            ("confirm", Order.Status.CONFIRMED),
            ("process", Order.Status.PROCESSING),
            ("ship", Order.Status.SHIPPED),
            ("deliver", Order.Status.DELIVERED),
            ("cancel", Order.Status.CANCELLED),
        ):
            response = self.client.post(f"/api/orders/{self.order.id}/{action}/")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["status"], expected_status)

    def test_cce_cannot_access_admin_only_areas(self):
        self.client.force_authenticate(self.cce)

        self.assertEqual(self.client.post("/api/categories/", {"name": "New"}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/coupons/").status_code, 403)
        self.assertEqual(self.client.get("/api/users/").status_code, 403)

    def test_customer_cannot_change_order_status(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(f"/api/orders/{self.order.id}/confirm/")
        self.assertEqual(response.status_code, 403)
