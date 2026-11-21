from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0003_correspondenceattachment"),
    ]

    operations = [
        migrations.AddField(
            model_name="secretariat",
            name="number_pattern",
            field=models.CharField(
                default="{year}/{code}/{type}/{seq}",
                help_text="Placeholders: {year} {code} {type} {seq}",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="secretariat",
            name="sequence_padding",
            field=models.PositiveSmallIntegerField(default=6),
        ),
        migrations.AddField(
            model_name="secretariat",
            name="persian_digits",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="secretariat",
            name="type_letters",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Optional per-type letters, e.g. {"outgoing": "ص"}',
            ),
        ),
    ]
