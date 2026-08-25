from decimal import Decimal

from django.db import migrations

from apps.orders.pricing import get_delivery_fee


def backfill_delivery_charge(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    # Only touch orders the checkout bug actually affected — shipping_total
    # left at 0 with a known shipping district — so a legitimately free
    # order (no address, or one you intentionally zeroed out later) is left
    # alone rather than silently overwritten.
    orders = Order.objects.filter(shipping_total=0, shipping_address__isnull=False).select_related(
        "shipping_address"
    )
    for order in orders:
        district = order.shipping_address.district
        fee = get_delivery_fee(district)
        if fee == Decimal("0.00"):
            continue
        order.shipping_total = fee
        order.grand_total = order.subtotal - order.discount_total + fee + order.tax_total
        order.save(update_fields=["shipping_total", "grand_total"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0003_alter_order_status"),
    ]

    operations = [
        migrations.RunPython(backfill_delivery_charge, noop_reverse),
    ]
