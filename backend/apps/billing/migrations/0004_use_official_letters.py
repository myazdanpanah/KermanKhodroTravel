from django.db import migrations

LEGAL_NOTE = (
    "**** برابر قانون و با توجه به ماهیت کار آژانس (ارائه خدمات واسطه‌ای) برای هریک از خدمات "
    "ارائه شده ، صورتحساب به نام و کد ملی مسافر صادر و به سامانه مودیان ارسال می‌گردد. ****"
)


def forwards(apps, schema_editor):
    InvoiceTemplate = apps.get_model("billing", "InvoiceTemplate")
    CompanySettings = apps.get_model("billing", "CompanySettings")

    # The seeded template used to carry the old table layout; empty content
    # means "use the built-in official letter" (debt / subsidiary / credit).
    InvoiceTemplate.objects.filter(name="قالب پیش‌فرض").update(html_content="", css_content="")

    settings_obj = CompanySettings.objects.filter(pk=1).first()
    if settings_obj is not None and not (settings_obj.legal_note or "").strip():
        settings_obj.legal_note = LEGAL_NOTE
        settings_obj.save(update_fields=["legal_note"])


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0003_companysettings_legal_note_and_more"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
