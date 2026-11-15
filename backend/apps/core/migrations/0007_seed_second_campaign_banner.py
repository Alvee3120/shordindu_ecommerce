from django.core.management.color import no_style
from django.db import connection, migrations


def seed_second_banner(apps, schema_editor):
    """Create the second (before-Men) banner slot, hidden until an admin fills
    it in — so the homepage doesn't show the same campaign twice."""
    CampaignBanner = apps.get_model("core", "CampaignBanner")
    CampaignBanner.objects.get_or_create(
        slot=2,
        defaults={"pk": 2, "heading": "Campaign", "is_enabled": False},
    )
    # The original seed created pk=1 explicitly, so Postgres never advanced the
    # id sequence; reset it or the next insert collides with the seeded row.
    for statement in connection.ops.sequence_reset_sql(no_style(), [CampaignBanner]):
        schema_editor.execute(statement)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_alter_campaignbanner_options_campaignbanner_slot"),
    ]

    operations = [
        migrations.RunPython(seed_second_banner, migrations.RunPython.noop),
    ]
