from django.db import migrations, models


def copy_category_to_categories(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    for product in Product.objects.exclude(category_id=None).iterator():
        product.categories.add(product.category_id)


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_inventorylog"),
    ]

    operations = [
        # 1. Add the M2M with a throwaway related_name so it can coexist with the
        #    still-present `category` FK (which owns related_name "products")
        #    without a reverse-accessor clash.
        migrations.AddField(
            model_name="product",
            name="categories",
            field=models.ManyToManyField(related_name="+", to="catalog.category"),
        ),
        # 2. Copy every product's existing single category into the M2M.
        migrations.RunPython(
            copy_category_to_categories,
            reverse_code=migrations.RunPython.noop,
        ),
        # 3. Drop the old FK - its related_name "products" is now free.
        migrations.RemoveField(
            model_name="product",
            name="category",
        ),
        # 4. Rename categories' related_name to the final clean value.
        #    State-only change - the through table is keyed by field name +
        #    models, not related_name, so this executes no DDL.
        migrations.AlterField(
            model_name="product",
            name="categories",
            field=models.ManyToManyField(related_name="products", to="catalog.category"),
        ),
    ]
