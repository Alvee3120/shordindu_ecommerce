from django.db import migrations, models


def backfill_created_at(apps, schema_editor):
    """Cart items had no timestamp before this migration. A cart's own
    created_at is the only historical signal available, so use it as the
    item's age proxy for rows that already exist."""
    Cart = apps.get_model("cart", "Cart")
    CartItem = apps.get_model("cart", "CartItem")

    for cart in Cart.objects.all().iterator():
        CartItem.objects.filter(cart_id=cart.id, created_at__isnull=True).update(
            created_at=cart.created_at
        )


class Migration(migrations.Migration):

    dependencies = [
        ("cart", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="cartitem",
            name="created_at",
            field=models.DateTimeField(editable=False, null=True),
        ),
        migrations.RunPython(backfill_created_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="cartitem",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]
