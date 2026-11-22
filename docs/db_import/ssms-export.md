# گرفتن خروجی از SQL Server با SSMS 22

هدف: یک پوشه پر از فایل‌های **CSV** (یک فایل برای هر جدول، با ردیف عنوان/هدر) که
دستور `mssql_import` بتواند آن را بخواند.

> ⚠️ تمام مراحل فقط **خواندن** از SQL Server است. هیچ دستور `INSERT/UPDATE/DELETE`
> روی دیتابیس مبدأ اجرا نمی‌شود.

---

## روش ۱ (توصیه‌شده): اسکریپت PowerShell

این روش برای همهٔ جدول‌ها با یک دستور کار می‌کند و هدر و UTF-8 را درست می‌سازد.

پیش‌نیاز: روی همان ویندوزی که SSMS 22 نصب است، ماژول `SqlServer` (همراه SSMS نصب می‌شود).

اگر نصب نبود:

```powershell
Install-Module SqlServer -Scope CurrentUser
```

اجرا (Windows Authentication):

```powershell
cd C:\KermanKhodroTravel
.\docs\db_import\export-mssql.ps1 `
  -ServerInstance "localhost\SQLEXPRESS" `
  -Database "YourDatabaseName" `
  -OutputDir ".\mssql_export"
```

اجرا با کاربر/رمز SQL:

```powershell
.\docs\db_import\export-mssql.ps1 `
  -ServerInstance "192.168.1.10,1433" `
  -Database "YourDatabaseName" `
  -User "sa" `
  -Password "***" `
  -OutputDir ".\mssql_export"
```

فقط چند جدول خاص:

```powershell
.\docs\db_import\export-mssql.ps1 -ServerInstance "srv01" -Database "YourDatabaseName" `
  -Tables Customers,Invoices,InvoiceLines -OutputDir ".\mssql_export"
```

خروجی: فایل‌هایی مثل `Customers.csv`، `Invoices.csv` و یک `_manifest.json`.

اگر خطای دسترسی/SSL گرفتی، در ابتدای اسکریپت `TrustServerCertificate` قبلاً `true`
شده است. برای SQL Server قدیمی ممکن است لازم باشد `Encrypt=False` هم اضافه شود.

---

## روش ۲: Wizard داخل SSMS 22 (رابط گرافیکی)

در SSMS 22:

1. به سرور وصل شو.
2. در **Object Explorer** روی دیتابیس کلیک راست کن.
3. مسیر: **Tasks → Export Data...**
   - اگر این گزینه را ندیدی، از Start منوی ویندوز **SQL Server Import and Export
     Wizard** را باز کن (همراه SSMS/SSDT نصب می‌شود).
4. صفحهٔ **Choose a Data Source**:
   - Data source: `Microsoft OLE DB Driver for SQL Server` (یا `SQL Server Native Client`)
   - Server name / Authentication / Database را انتخاب کن → **Next**
5. صفحهٔ **Choose a Destination**:
   - Destination: **Flat File Destination**
   - **File name**: مثلاً `C:\KermanKhodroTravel\mssql_export\Customers.csv`
   - **Locale**: `English (United States)`
   - گزینهٔ **Unicode** را تیک بزن (برای متن فارسی مطمئن‌تر است؛ خوانندهٔ ما UTF-16 را
     هم تشخیص می‌دهد).
   - **Column names in the first data row** را تیک بزن. ✅ (خیلی مهم)
   - **Text qualifier**: `"` و **Delimiter**: `,`
   - **Next**
6. صفحهٔ **Specify Table Copy or Query**:
   - **Copy data from one or more tables or views** → **Next**
7. صفحهٔ **Select Source Tables and Views**:
   - برای هر بار اجرا **یک جدول** را تیک بزن → **Next**.
   - برای جدول بعدی، همین مراحل را با نام فایل جدید تکرار کن.
     (Wizard با مقصد Flat File برای چند جدول هم‌زمان، همه را در یک فایل می‌ریزد؛
     پس یک‌به‌یک امن‌تر است. اگر جدول‌های زیادی داری، روش ۱ را استفاده کن.)
8. **Run immediately** را بگذار و **Next → Finish**.

### گزینهٔ جایگزین تک‌فایلی (فقط برای جدول کوچک)

در SSMS: راست‌کلیک روی جدول → **Select Top 1000 Rows** → در گرید نتایج راست‌کلیک
→ **Save Results As...** → پسوند `.csv`.

این روش برای استخراج کامل و حجم بالا مناسب نیست.

---

## چیزهایی که خروجی نگیر

- **Generate Scripts → Data only** (فایل `.sql` پر از `INSERT`): خوانندهٔ فعلی
  فقط CSV را پشتیبانی می‌کند. اگر مجبوری از این روش استفاده کنی، بگو تا پشتیبانی
  پارس کردن `INSERT` را اضافه کنم.
- **Export Data-tier Application (.bacpac)**: یک فایل زیپ مخصوص SQL Server است و
  بدون یک SQL Server واسط قابل خواندن نیست.

---

## بررسی سریع خروجی

- تعداد فایل‌های CSV باید با تعداد جدول‌های انتخابی یکی باشد.
- اولین خط هر فایل باید نام ستون‌ها باشد.
- یک فایل را با Notepad باز کن؛ متن فارسی نباید `????` باشد. اگر بود،
  خروجی را با **Unicode** دوباره بگیر.
- ستون‌های `datetime` بهتر است به شکل `YYYY-MM-DD HH:MM:SS` باشند؛ خواننده
  فرمت‌های رایج `dd/mm/yyyy` و `mm/dd/yyyy` را هم می‌فهمد.

---

## مرحلهٔ بعد

پوشهٔ خروجی را داخل پروژه بگذار (مثلاً `C:\KermanKhodroTravel\mssql_export`) و
از پوشهٔ `backend` اجرا کن:

```powershell
..\.venv\Scripts\python.exe manage.py mssql_import --source ..\mssql_export --analyze
```

سپس `mssql_export\mssql_analysis.md` و `mssql_mapping.yaml` را ببین (توضیح کامل در
`README.md` همین پوشه).
