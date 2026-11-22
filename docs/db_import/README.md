# انتقال داده از SQL Server به Nexivo (PostgreSQL)

این پوشه ابزار و مستندات تبدیل دیتابیس **SQL Server ↔ Nexivo** را نگه می‌دارد.
جریان کاملاً یک‌طرفه است:

```
SQL Server (فقط خواندن)  ──►  CSV در mssql_export/  ──►  PostgreSQL پروژه
```

هیچ دستور نوشتنی به SQL Server فرستاده نمی‌شود. ایمپورت هم فقط با اجرای صریح
`--apply` انجام می‌شود؛ `--analyze` و `--dry-run` هیچ داده‌ای را تغییر نمی‌دهند.

---

## فایل‌ها

| فایل | کاربرد |
|---|---|
| `target-schema.md` | فهرست کامل ۱۸۵ مدل Django با جدول/ستون‌ها (مرجع نگاشت) |
| `ssms-export.md` | روش گرفتن خروجی CSV از SSMS 22 |
| `export-mssql.ps1` | اسکریپت گرفتن خروجی همهٔ جدول‌ها به CSV |
| `mapping.example.yaml` | نمونهٔ کامل و توضیح‌دار فایل نگاشت |
| `../../backend/apps/db_manager/management/commands/mssql_import.py` | دستور تبدیل |

---

## ۰) پیش‌نیاز و بکاپ

مقصد همان دیتابیس پروژه است (`kermankhodro` روی پورت `5544`). قبل از هر ایمپورت
واقعی بکاپ بگیر:

```powershell
cd C:\KermanKhodroTravel
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
docker exec -e PGPASSWORD=nexivo_pass_change_me nexivo_db `
  pg_dump -U nexivo_user -d kermankhodro -Fc -f "/tmp/before_$ts.dump"
docker cp "nexivo_db:/tmp/before_$ts.dump" ".\backups\before_$ts.dump"
```

بازگردانی در صورت نیاز:

```powershell
docker cp .\backups\before_YYYYMMDD_HHMMSS.dump nexivo_db:/tmp/restore.dump
docker exec -e PGPASSWORD=nexivo_pass_change_me nexivo_db `
  pg_restore -U nexivo_user -d kermankhodro --clean --if-exists /tmp/restore.dump
```

پوشهٔ `backups/` در `.gitignore` است.

---

## ۱) گرفتن خروجی از SQL Server

طبق `ssms-export.md`. در پایان باید یک پوشه مثل `mssql_export/` داشته باشی:

```
mssql_export/
  Customers.csv
  Invoices.csv
  InvoiceLines.csv
  ...
  _manifest.json        (اختیاری)
```

هر CSV باید **ردیف هدر** داشته باشد و متن فارسی سالم باشد.

---

## ۲) تحلیل و ساخت پیش‌نویس نگاشت

از پوشهٔ `backend`:

```powershell
..\.venv\Scripts\python.exe manage.py mssql_import --source ..\mssql_export --analyze
```

خروجی:

- `mssql_export\mssql_mapping.yaml` — نگاشت پیشنهادی (قابل ویرایش)
- `mssql_export\mssql_analysis.md` — گزارش: هر جدول به کدام مدل خورد، چه ستون‌هایی
  نگاشت نشدند، و چه فیلدهای اجباری مقصد پر نشده‌اند.

معیار تطبیق نام‌ها: نام مدل/Django `db_table`/verbose name با تحمل جمع/مفرد و
شباهت رشته‌ای. جدول‌هایی که مطمئن نیست، `target: null` می‌مانند و باید دستی
تعیین شوند.

---

## ۳) بازبینی `mssql_mapping.yaml`

این مهم‌ترین مرحله است. برای هر جدول بررسی کن:

1. **`target`** — واقعاً همان مدل درست است؟ (مثلاً `finance.Invoice` یا
   `sales.SalesInvoice` یا `billing.Invoice`؟)
2. **`key_source`** — ستون کلید اصلی قدیمی. برای حفظ ارتباط جداول و `ref` لازم است.
3. **`key`** (اختیاری) — اگر می‌خواهی ایمپورت تکرارشدنی باشد (upsert)، یک فیلد
   یکتا در مدل مقصد بده (مثل `invoice_number`). بدون `key` هر ردیف جدید ساخته
   می‌شود.
4. **`company`** — همهٔ مدل‌های `BaseModel` فیلد `company` اجباری دارند. در
   `defaults` شناسهٔ شرکت مقصد را بگذار:
   ```yaml
   defaults:
     company: 2
   ```
5. **کلیدهای خارجی (FK)** — هر فیلدی که در گزارش `needs_fk` خورده باید بلوک
   `fk` بگیرد:
   ```yaml
   customer: {source: CustomerID, fk: {ref: Customers}}      # از جدول ایمپورت‌شده
   company:  {source: CompanyID,  fk: {model: accounts.Company, lookup: id}}
   ```
   ترتیب ایمپورت خودکار بر اساس `ref` مرتب می‌شود.
6. **تبدیل مقادیر** — مثلاً کدهای وضعیت عددی:
   ```yaml
   status:
     source: StatusID
     map: {"1": draft, "2": issued, "3": paid}
   ```
   یا پاک‌سازی تلفن: `{source: Phone, transform: digits}`.

قالب کامل: `mapping.example.yaml`.

### انواع تبدیل (`transform`)

`strip, trim, upper, lower, digits, phone, national_id, bool, int, float,
decimal, date, datetime, json`

### انواع مشخصهٔ فیلد

```yaml
field: SourceColumn
field: {source: SourceColumn, transform: digits, default: ""}
field: {constant: true}
field: {source: Code, map: {"1": a, "2": b}, default: a}
```

---

## ۴) آزمایش بدون نوشتن (Dry-run)

```powershell
..\.venv\Scripts\python.exe manage.py mssql_import --source ..\mssql_export --apply --dry-run --report ..\mssql_export\report.json
```

- همهٔ ردیف‌ها پردازش می‌شوند، اما در پایان کل تراکنش **rollback** می‌شود.
- اول با `--limit 50` تست کن.
- خطاهای هر جدول در خروجی و `report.json` می‌آید.

اگر همه‌چیز درست بود، بکاپ بند ۰ را بگیر و اجرای واقعی:

```powershell
..\.venv\Scripts\python.exe manage.py mssql_import --source ..\mssql_export --apply --report ..\mssql_export\report.json
```

پس از ایمپورت، شناسه‌های سری (sequence) جداول به‌صورت خودکار با `MAX(id)`
هم‌تراز می‌شوند تا رکوردهای جدید بعدی خطای تکراری ندهند. با
`--no-reset-sequences` می‌توانی این کار را غیرفعال کنی.

---

## ۵) بررسی بعد از ایمپورت

چند نمونه بررسی:

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py shell -c "from apps.finance.models import Customer; print(Customer.objects.count())"
..\.venv\Scripts\python.exe manage.py shell -c "from apps.sales.models import SalesInvoice; print(SalesInvoice.objects.count())"
```

نکات:

- Django `auto_now_add`/`auto_now` (مثل `created_at`/`updated_at`) را هنگام
  `create` نادیده می‌گیرد؛ اگر تاریخ اصلی مهم است، بعد از ایمپورت با یک اسکریپت
  `QuerySet.update()` مقداردهی کن.
- مدل‌هایی که `save()` سفارشی دارند (مثل `SalesInvoice`) ممکن است مبالغ را
  دوباره محاسبه کنند؛ همان اجزای محاسبه را نگاشت کن، نه مقدار نهایی را.
- برای مدل‌هایی که `unique_together` دارند (مثل `company + invoice_number`),
  بهتر است `key` بدهی تا اجرای دوباره خطا ندهد.

---

## محدودیت‌های فعلی

| مورد | وضعیت |
|---|---|
| CSV با هدر (UTF-8 / UTF-16 / cp1256) | ✅ |
| اسکریپت ساختار `CREATE TABLE` (`.sql`) برای تحلیل | ✅ |
| فایل `INSERT`-only (`.sql`) | ❌ هنوز نه |
| ستون‌های `varbinary` / فایل و تصویر | ❌ باید جداگانه منتقل شود |
| `uniqueidentifier` | ✅ به‌صورت رشته |
| `geography` / `hierarchyid` / XML | ❌ دستی |
| ستون محاسباتی / VIEW | ❌ (VIEW را به جدول واقعی Export کن) |
| حجم خیلی بالا | ✅ ولی خروجی CSV حجیم می‌شود؛ می‌توان batch کرد |

---

## عیب‌یابی

- **`No .csv or .sql files found`** → مسیر `--source` را چک کن؛ باید پوشه باشد.
- **`mapping not found`** → اول `--analyze`.
- **`FK ... got raw value`** → برای آن فیلد بلوک `fk` اضافه کن.
- **`required value missing`** یا خطای NOT NULL → فیلد اجباری مقصد پر نشده؛
  در `defaults`/`constants` مقدار بده.
- **متن فارسی `????`** → خروجی را با Unicode دوباره بگیر.
- **تاریخ نامعتبر** → فرمت را به `YYYY-MM-DD` تبدیل کن یا `transform: date` بده.
