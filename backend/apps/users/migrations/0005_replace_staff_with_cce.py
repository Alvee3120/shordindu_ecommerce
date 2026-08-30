from django.db import migrations, models


def replace_staff_with_cce(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="staff").update(role="cce", is_staff=False)


class Migration(migrations.Migration):
    dependencies = [("users", "0004_alter_address_address_alter_address_district_and_more")]

    operations = [
        migrations.RunPython(replace_staff_with_cce, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("customer", "Customer"),
                    ("cce", "CCE (Customer Care Executive)"),
                    ("admin", "Admin"),
                ],
                default="customer",
                max_length=20,
            ),
        ),
    ]
