"""Seed (or reset) demo orders for local development.

Examples
--------
    python manage.py seed_demo_orders --reset
    python manage.py seed_demo_orders --orders 80 --days 60 --customers 20 --reset

`--reset` deletes every existing Order (cascading to its items, payments and
coupon redemptions), plus guest addresses and demo customers created by a
previous run, then creates a fresh set. Without `--reset` it only adds orders.

This is a development tool: it refuses to run with DEBUG=False unless `--force`
is passed.
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Product, ProductVariation
from apps.orders.models import Coupon, Order, OrderCoupon, OrderItem, Payment
from apps.orders.pricing import DHAKA_ZONES, get_delivery_fee, is_dhaka
from apps.orders.utils import generate_order_number
from apps.users.models import Address, User

DEMO_EMAIL_DOMAIN = "shordindu.demo"
DEMO_PASSWORD = "DemoPass123!"

FIRST_NAMES = [
    "Ayesha", "Rahim", "Nusrat", "Tanvir", "Farhana", "Sabbir", "Mim", "Arif",
    "Sumaiya", "Naeem", "Jarin", "Hasib", "Ruma", "Imran", "Tisha", "Fahim",
]
LAST_NAMES = [
    "Islam", "Akter", "Hossain", "Chowdhury", "Rahman", "Sultana", "Khan", "Ahmed",
]
DISTRICTS = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Mymensingh"]

# (status, weight)
STATUS_WEIGHTS = [
    (Order.Status.DELIVERED, 45),
    (Order.Status.PROCESSING, 15),
    (Order.Status.SHIPPED, 14),
    (Order.Status.CONFIRMED, 8),
    (Order.Status.CANCELLED, 10),
    (Order.Status.PENDING, 8),
]

COUPONS = [
    {"code": "SAVE10", "type": Coupon.Type.PERCENT, "value": Decimal("10.00")},
    {"code": "FLAT200", "type": Coupon.Type.FLAT, "value": Decimal("200.00")},
]


class Command(BaseCommand):
    help = "Delete existing orders and seed realistic demo orders (development only)."

    def add_arguments(self, parser):
        parser.add_argument("--orders", type=int, default=40, help="Number of orders to create (default 40).")
        parser.add_argument("--days", type=int, default=30, help="Spread orders over the last N days (default 30).")
        parser.add_argument("--customers", type=int, default=12, help="Number of demo customers (default 12).")
        parser.add_argument("--reset", action="store_true", help="Delete all existing orders (and demo data) first.")
        parser.add_argument("--seed", type=int, default=None, help="Optional random seed for reproducible output.")
        parser.add_argument("--force", action="store_true", help="Allow running when DEBUG is False.")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("Refusing to seed demo data with DEBUG=False. Pass --force to override.")

        if options["seed"] is not None:
            random.seed(options["seed"])

        if options["reset"]:
            self._reset()

        variations = list(
            ProductVariation.objects.filter(
                is_active=True,
                price__gt=0,
                product__status=Product.Status.ACTIVE,
            ).select_related("product")[:500]
        )
        if not variations:
            raise CommandError("No active product variations with a price found — add products first.")

        customers = self._create_customers(options["customers"])
        coupons = self._ensure_coupons()

        created = self._create_orders(options["orders"], options["days"], variations, customers, coupons)
        self._report(created)

    # -- reset -------------------------------------------------------------
    def _reset(self):
        orders_deleted, _ = Order.objects.all().delete()
        # Guest addresses (user IS NULL) only exist to back guest orders, which
        # are now gone; demo customers cascade their own addresses.
        addresses_deleted, _ = Address.objects.filter(user__isnull=True).delete()
        demo_users = User.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}")
        users_deleted, _ = demo_users.delete()
        self.stdout.write(
            self.style.WARNING(
                f"Reset: deleted {orders_deleted} order-related rows, "
                f"{users_deleted} demo user rows, {addresses_deleted} guest address rows."
            )
        )

    # -- customers ---------------------------------------------------------
    def _create_customers(self, count):
        customers = []
        for index in range(count):
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            email = f"demo{index + 1}@{DEMO_EMAIL_DOMAIN}"
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={"name": name, "phone": self._phone(), "role": User.Role.CUSTOMER},
            )
            if not user.phone:
                user.phone = self._phone()
                user.save(update_fields=["phone"])
            if not user.addresses.exists():
                Address.objects.create(
                    user=user,
                    name=user.name,
                    phone=user.phone,
                    address=self._street(),
                    district=random.choice(DISTRICTS),
                    is_default=True,
                )
            customers.append(user)
        return customers

    def _ensure_coupons(self):
        coupons = []
        for spec in COUPONS:
            coupon, _ = Coupon.objects.get_or_create(
                code=spec["code"],
                defaults={"type": spec["type"], "value": spec["value"]},
            )
            coupons.append(coupon)
        return coupons

    # -- orders ------------------------------------------------------------
    def _create_orders(self, count, days, variations, customers, coupons):
        now = timezone.now()
        stats = {"orders": 0, "revenue": Decimal("0.00"), "customers": set(), "by_status": {}}

        with transaction.atomic():
            for _ in range(count):
                is_guest = random.random() < 0.15
                customer = None if is_guest else random.choice(customers)
                district = random.choice(DISTRICTS)
                zone = random.choice(list(DHAKA_ZONES)) if is_dhaka(district) else ""

                items = random.sample(variations, k=min(random.randint(1, 3), len(variations)))
                line_specs = []
                subtotal = Decimal("0.00")
                for variation in items:
                    quantity = random.randint(1, 3)
                    unit_price = variation.price
                    line_total = unit_price * quantity
                    subtotal += line_total
                    line_specs.append((variation, quantity, unit_price, line_total))

                coupon = random.choice(coupons) if random.random() < 0.35 else None
                discount_total = coupon.compute_discount(subtotal) if coupon else Decimal("0.00")
                shipping_total = get_delivery_fee(district, zone)
                grand_total = subtotal - discount_total + shipping_total

                status = self._weighted_status()
                payment_status = self._payment_status(status)

                placed_at = now - timedelta(
                    days=random.randint(0, max(days - 1, 0)),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59),
                )

                address = self._address_for(customer, district, zone)

                order = Order.objects.create(
                    order_number=generate_order_number(),
                    user=customer,
                    guest_email=None if customer else f"guest{random.randint(1000, 9999)}@example.com",
                    status=status,
                    subtotal=subtotal,
                    discount_total=discount_total,
                    shipping_total=shipping_total,
                    tax_total=Decimal("0.00"),
                    grand_total=grand_total,
                    shipping_address=address,
                    billing_address=address,
                    payment_status=payment_status,
                )
                Order.objects.filter(pk=order.pk).update(placed_at=placed_at)

                for variation, quantity, unit_price, line_total in line_specs:
                    OrderItem.objects.create(
                        order=order,
                        product=variation.product,
                        variation=variation,
                        product_name_snapshot=variation.product.name,
                        variation_label_snapshot=variation.sku,
                        quantity=quantity,
                        unit_price=unit_price,
                        line_total=line_total,
                    )

                if coupon:
                    OrderCoupon.objects.create(order=order, coupon=coupon, discount_amount=discount_total)

                Payment.objects.create(
                    order=order,
                    method=Payment.Method.COD,
                    amount=grand_total,
                    status=Payment.Status.PAID if payment_status == Order.PaymentStatus.PAID else Payment.Status.PENDING,
                )

                stats["orders"] += 1
                stats["revenue"] += grand_total
                stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
                if customer:
                    stats["customers"].add(customer.id)

        return stats

    def _address_for(self, customer, district, zone):
        if customer:
            address = customer.addresses.first()
            if address:
                return address
        return Address.objects.create(
            user=customer,
            name=customer.name if customer else "Guest",
            phone=customer.phone if customer else self._phone(),
            address=self._street(),
            district=district,
            zone=zone,
        )

    def _weighted_status(self):
        statuses = [status for status, _ in STATUS_WEIGHTS]
        weights = [weight for _, weight in STATUS_WEIGHTS]
        return random.choices(statuses, weights=weights, k=1)[0]

    def _payment_status(self, status):
        if status == Order.Status.DELIVERED:
            return Order.PaymentStatus.PAID
        if status in (Order.Status.SHIPPED, Order.Status.PROCESSING):
            return Order.PaymentStatus.PAID if random.random() < 0.5 else Order.PaymentStatus.UNPAID
        return Order.PaymentStatus.UNPAID

    # -- helpers -----------------------------------------------------------
    def _phone(self):
        return f"01{random.randint(3, 9)}{random.randint(10000000, 99999999)}"

    def _street(self):
        return f"House {random.randint(1, 120)}, Road {random.randint(1, 30)}"

    def _report(self, stats):
        self.stdout.write(self.style.SUCCESS(f"Created {stats['orders']} demo orders."))
        self.stdout.write(f"  Revenue (grand total): {stats['revenue']:.2f}")
        self.stdout.write(f"  Distinct customers: {len(stats['customers'])}")
        for status, count in sorted(stats["by_status"].items()):
            self.stdout.write(f"  {status}: {count}")
