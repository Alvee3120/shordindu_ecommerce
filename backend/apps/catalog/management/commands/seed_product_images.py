"""Give image-less products a type-matched photo from the media bucket.

The bucket ships a small set of catalogue photos grouped by filename
(``Dress1.webp``, ``Panjabi1.webp``, ``Sharee1.webp``, ``bag1.webp``). Products
whose names match a group are assigned one of those photos, cycling through the
group. Products without a matching group keep their "No image" state, and
products that already have an image are never touched.

    python manage.py seed_product_images            # dry run
    python manage.py seed_product_images --commit   # create the rows
"""

import re

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from apps.catalog.models import Product, ProductImage

IMAGE_GROUPS = {
    "Panjabi": re.compile(r"^Panjabi(\d+)\.webp$", re.IGNORECASE),
    "Sharee": re.compile(r"^Sharee(\d+)\.webp$", re.IGNORECASE),
    "Dress": re.compile(r"^Dress(\d+)\.webp$", re.IGNORECASE),
    "bag": re.compile(r"^bag(\d+)\.webp$", re.IGNORECASE),
}

NAME_GROUPS = (
    ("Panjabi", re.compile(r"\bpanjabi\b", re.IGNORECASE)),
    ("Sharee", re.compile(r"\b(?:saree|sharee|jamdani)\b", re.IGNORECASE)),
    ("bag", re.compile(r"\bbag\b", re.IGNORECASE)),
    ("Dress", re.compile(r"\b(?:jama|dress)\b", re.IGNORECASE)),
)


def _group_images():
    _, files = default_storage.listdir("products")
    groups = {group: [] for group in IMAGE_GROUPS}
    for filename in files:
        for group, pattern in IMAGE_GROUPS.items():
            match = pattern.match(filename)
            if match:
                groups[group].append((int(match.group(1)), f"products/{filename}"))
                break
    return {
        group: [key for _, key in sorted(entries)]
        for group, entries in groups.items()
        if entries
    }


def _product_group(name):
    for group, pattern in NAME_GROUPS:
        if pattern.search(name or ""):
            return group
    return None


class Command(BaseCommand):
    help = "Assign type-matched placeholder photos to products that have no image."

    def add_arguments(self, parser):
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Create the ProductImage rows. Without this flag the command only reports.",
        )

    def handle(self, *args, **options):
        images = _group_images()
        if not images:
            self.stdout.write("No product images found in storage.")
            return

        commit = options["commit"]
        products = Product.objects.filter(images__isnull=True).order_by("id")
        planned = {group: [] for group in images}
        skipped = 0

        for product in products:
            group = _product_group(product.name)
            if group is None or group not in images:
                skipped += 1
                continue
            bucket = images[group]
            planned[group].append((product, bucket[len(planned[group]) % len(bucket)]))

        rows = []
        for group, entries in planned.items():
            self.stdout.write(f"{group}: {len(entries)} product(s) <- {len(images[group])} image(s)")
            for product, key in entries:
                if not commit:
                    self.stdout.write(f"  would assign {key} to #{product.pk} {product.name}")
                rows.append(
                    ProductImage(
                        product=product,
                        image=key,
                        alt_text=product.name,
                        sort_order=0,
                        is_primary=True,
                    )
                )

        assigned = len(rows)
        if commit:
            ProductImage.objects.bulk_create(rows)
        verb = "assigned" if commit else "would assign"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb}: {assigned}, no matching image group: {skipped}"
            )
        )
        if not commit and assigned:
            self.stdout.write("Re-run with --commit to create these rows.")
