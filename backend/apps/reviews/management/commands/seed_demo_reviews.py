"""Seed demo product reviews for local development.

Examples
--------
    python manage.py seed_demo_reviews
    python manage.py seed_demo_reviews --reviews 80 --reset

Reviews are authored by the demo customers (`*@shordindu.demo`) created by
`seed_demo_orders`, or a fresh set if none exist. Most are approved (so they
show on the storefront and in product ratings), with a few pending/rejected to
exercise the moderation screen.

`--reset` deletes only reviews authored by demo customers — real reviews are
left alone. This is a development tool: it refuses to run with DEBUG=False
unless `--force` is passed.
"""

import random
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Product
from apps.reviews.models import Review
from apps.users.models import User

DEMO_EMAIL_DOMAIN = "shordindu.demo"
DEMO_PASSWORD = "DemoPass123!"

COMMENTS = [
    "Excellent quality, exactly as shown in the pictures. Very happy with this purchase.",
    "Fabric is soft and comfortable. Fits true to size.",
    "Good value for the price. Delivery was quick too.",
    "Beautiful design, got lots of compliments. Will order again.",
    "The colour is slightly different from the photo but still very pretty.",
    "Stitching is neat and the finishing is great. Recommended.",
    "Nice product overall, though it took a couple of days longer to arrive.",
    "Perfect for the occasion I bought it for. Loved it!",
    "Material feels premium. Worth every taka.",
    "Decent quality but the size runs a bit small — order one up.",
    "Exactly what I was looking for. Packaging was lovely as well.",
    "Very satisfied. The colour hasn't faded after washing.",
    "Looks elegant and the price is reasonable. Happy customer.",
    "Slightly loose fitting but comfortable. Good for daily wear.",
    "Amazing craftsmanship, you can tell it's well made.",
]

TITLES = [
    "Loved it!", "Great quality", "Perfect fit", "Beautiful piece",
    "Worth the price", "Highly recommended", "Very happy", "Good buy",
    "Nice product", "Will order again",
]

# (rating, weight) — skewed towards positive, like a real storefront.
RATING_WEIGHTS = [(5, 45), (4, 30), (3, 15), (2, 7), (1, 3)]
# (status, weight)
STATUS_WEIGHTS = [
    (Review.Status.APPROVED, 80),
    (Review.Status.PENDING, 15),
    (Review.Status.REJECTED, 5),
]


class Command(BaseCommand):
    help = "Seed demo product reviews (development only)."

    def add_arguments(self, parser):
        parser.add_argument("--reviews", type=int, default=60, help="Number of reviews to create (default 60).")
        parser.add_argument("--days", type=int, default=90, help="Spread reviews over the last N days (default 90).")
        parser.add_argument("--customers", type=int, default=8, help="Demo customers to create if none exist (default 8).")
        parser.add_argument("--reset", action="store_true", help="Delete existing demo reviews first.")
        parser.add_argument("--seed", type=int, default=None, help="Optional random seed for reproducible output.")
        parser.add_argument("--force", action="store_true", help="Allow running when DEBUG is False.")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("Refusing to seed demo data with DEBUG=False. Pass --force to override.")
        if options["seed"] is not None:
            random.seed(options["seed"])

        if options["reset"]:
            deleted, _ = self._demo_reviews().delete()
            self.stdout.write(self.style.WARNING(f"Reset: deleted {deleted} demo review rows."))

        products = list(
            Product.objects.filter(status=Product.Status.ACTIVE).only("id", "name")[:800]
        ) or list(Product.objects.all().only("id", "name")[:800])
        if not products:
            raise CommandError("No products found — add products first.")

        customers = self._demo_customers(options["customers"])
        created, skipped = self._create_reviews(options["reviews"], options["days"], products, customers)

        self.stdout.write(self.style.SUCCESS(f"Created {created} demo reviews."))
        if skipped:
            self.stdout.write(f"  Skipped {skipped} (product already reviewed by that customer).")

    # -- data helpers ------------------------------------------------------
    def _demo_reviews(self):
        return Review.objects.filter(user__email__endswith=f"@{DEMO_EMAIL_DOMAIN}")

    def _demo_customers(self, count):
        customers = list(User.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}"))
        if customers:
            return customers
        for index in range(count):
            User.objects.create_user(
                email=f"demo{index + 1}@{DEMO_EMAIL_DOMAIN}",
                password=DEMO_PASSWORD,
                name=f"Demo Customer {index + 1}",
                phone=f"01{random.randint(3, 9)}{random.randint(10000000, 99999999)}",
                role=User.Role.CUSTOMER,
            )
        return list(User.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}"))

    def _weighted(self, pairs):
        values = [value for value, _ in pairs]
        weights = [weight for _, weight in pairs]
        return random.choices(values, weights=weights, k=1)[0]

    def _create_reviews(self, count, days, products, customers):
        now = timezone.now()
        seen = set(self._demo_reviews().values_list("product_id", "user_id"))
        created = 0
        skipped = 0

        with transaction.atomic():
            for _ in range(count):
                product = random.choice(products)
                customer = random.choice(customers)
                key = (product.id, customer.id)
                if key in seen:
                    skipped += 1
                    continue
                seen.add(key)

                review = Review.objects.create(
                    product=product,
                    user=customer,
                    rating=self._weighted(RATING_WEIGHTS),
                    title=random.choice(TITLES),
                    comment=random.choice(COMMENTS),
                    status=self._weighted(STATUS_WEIGHTS),
                )
                Review.objects.filter(pk=review.pk).update(
                    created_at=now - timedelta(days=random.randint(0, max(days - 1, 0)), hours=random.randint(0, 23))
                )
                created += 1

        return created, skipped
