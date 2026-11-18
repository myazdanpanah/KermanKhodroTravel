<div align="center">

# کرمان خودرو — Kerman Khodro Travel

### سیستم مالی، بی‌آی و CRM آژانس مسافرتی

فورک اختصاصی «کرمان خودرو» از پلتفرم Nexivo — سه ماژول تحویل‌شده: داشبورد مدیریتی (BI)، مالی/صورت‌حساب و CRM.

</div>

---

## فهرست

- [این پروژه چیست](#این-پروژه-چیست)
- [ماژول‌های تحویل‌شده](#ماژولهای-تحویلشده)
- [پشتهٔ فنی](#پشتهٔ-فنی)
- [ساختار پروژه](#ساختار-پروژه)
- [راه‌اندازی توسعهٔ محلی](#راهاندازی-توسعهٔ-محلی)
- [متغیرهای محیطی](#متغیرهای-محیطی)
- [دادهٔ اولیه و seed](#دادهٔ-اولیه-و-seed)
- [احراز هویت و مجوزها](#احراز-هویت-و-مجوزها)
- [دامنهٔ مالی (billing)](#دامنهٔ-مالی-billing)
- [شماره‌گذاری نامه و گردش تأیید](#شمارهگذاری-نامه-و-گردش-تأیید)
- [تولید فایل: Word و PDF](#تولید-فایل-word-و-pdf)
- [API مالی](#api-مالی)
- [فرانت‌اند](#فرانتاند)
- [تست و بررسی](#تست-و-بررسی)
- [استقرار و عملیات](#استقرار-و-عملیات)
- [قواعد و نکات توسعه](#قواعد-و-نکات-توسعه)
- [کارهای باقی‌مانده / محدودیت‌ها](#کارهای-باقیمانده--محدودیتها)
- [تاریخچه و منابع](#تاریخچه-و-منابع)

---

## این پروژه چیست

نکس‌یوو یک «سیستم‌عامل سازمانی» ماژولار است (Django REST + React) که برای نیازهای مختلف کسب‌وکار ماژول دارد. این مخزن **فورک مشتری «کرمان خودرو»** است و فقط بخشی از ماژول‌ها برای این مشتری فعال و کامل شده‌اند؛ بقیهٔ ماژول‌های Nexivo در کد هستن اما در لانچر نمایش داده نمی‌شوند و برای این مشتری پشتیبانی نمی‌شوند.

جریان کاری اصلی مشتری:

1. کارشناس، درخواست صدور صورت‌حساب (پرواز / هتل / ویزا / اتوبوس / قطار / گشت / تور / CIP …) ثبت می‌کند، چند فایل اکسل/همراه بار می‌کند و ردیف‌ها را در یک ادیتور جدولی نهایی می‌کند.
2. نامه با شمارهٔ `YYYY/COMPANYCODE/NNNNN` ساخته می‌شود و وارد گردش تأیید (مدیر / مدیرعامل) می‌شود.
3. پس از تأیید، **نامهٔ رسمی Word** و **صورت‌حساب PDF** تولید و در مسیر «فایل‌های تأییدشده» ذخیره می‌شوند.
4. پرداخت‌ها ثبت می‌شوند (از صفحهٔ پرداخت‌ها یا مستقیماً از ردیف صورت‌حساب) و ماندهٔ هر مشتری در «عملکرد» و «مشتریان» به‌صورت مشتق‌شده نمایش داده می‌شود.

---

## ماژول‌های تحویل‌شده

| کلید | عنوان | وضعیت |
|---|---|---|
| `bi_dashboard` | داشبورد مدیریتی | تحویل‌شده |
| `finance` | مالی — صورت‌حساب، پرداخت، مشتریان، عملکرد، خدمات | تحویل‌شده |
| `crm` | CRM — سرنخ‌ها، فرصت‌ها، فعالیت‌ها | تحویل‌شده |
| `settings` | تنظیمات شرکت، کاربران و مجوزها | تحویل‌شده |

لیست بالا در `frontend/src/pages/LauncherPage.tsx` با ثابت `DELIVERED_MODULES` کنترل می‌شود؛ هر ماژول جدید که بخواهد در لانچر دیده شود باید به همین مجموعه اضافه شود. ناوبری داخل ERP در `frontend/src/pages/ERPLayout.tsx` تعریف شده است (سه گروه: مالی، CRM، تنظیمات).

---

## پشتهٔ فنی

**بک‌اند**

- Python 3.11+ / Django 4.2 LTS / Django REST Framework 3.14
- PostgreSQL 15 (پیش‌فرض `psycopg2`)
- JWT دستی (`PyJWT`، `apps/accounts/authentication.py`)، بدون SimpleJWT
- Celery + Redis (تعریف‌شده؛ `CELERY_BEAT_SCHEDULE` خالی است، پس پاک‌سازی دوره‌ای فایل‌ها با cron سرور اجرا می‌شود — بخش «استقرار و عملیات»)
- Channels/Daphne برای هشدارهای realtime (اختیاری)
- تولید فایل: `python-docx` + `docxtpl` (Word)، `Jinja2` (HTML صورت‌حساب)، `WeasyPrint` و مرورگر headless (PDF)
- `jdatetime` برای تاریخ شمسی، `openpyxl`/`pandas` برای اکسل، `drf-spectacular` برای OpenAPI

**فرانت‌اند**

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3 (توکن‌های برند در `tailwind.config.js` و `src/index.css`)
- Ant Design 6 برای فرم/جدول/مودال، ECharts برای نمودار، AG Grid برای جداول سنگین
- Zustand برای state، React Router 6، axios
- PWA سبک (`manifest.webmanifest`) و i18n فارسی/تقویم شمسی

---

## ساختار پروژه

```
KermanKhodroTravel/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── nexivo/                 # settings, urls, asgi/wsgi
│   ├── apps/
│   │   ├── accounts/           # User, Company, JWT, roles, seed users
│   │   ├── billing/            # ★ ماژول اصلی این مشتری
│   │   │   ├── models.py       # Payer, Invoice, Payment, ApprovalRequest, …
│   │   │   ├── views.py        # endpointهای مالی
│   │   │   ├── permissions.py  # PERMISSION_FLAGS + perm_required
│   │   │   ├── urls.py
│   │   │   ├── services/
│   │   │   │   ├── balance.py      # فرمول مشتق مانده
│   │   │   │   ├── numbers.py      # شماره نامه: رزرو/پیش‌نمایش (شمارهٔ ابطال‌شده آزاد نمی‌شود)
│   │   │   │   ├── normalize.py    # ارقام فارسی و تاریخ شمسی
│   │   │   │   ├── generation.py   # Word نامه + PDF صورت‌حساب
│   │   │   │   ├── files.py        # ذخیره/بازیابی/انقضای فایل‌ها
│   │   │   │   ├── excel.py        # خواندن فایل‌های ورودی
│   │   │   │   └── assets/         # Vazirmatn (woff2) + OFL.txt
│   │   │   ├── management/commands/
│   │   │   │   ├── seed_kkt.py             # seed اولیهٔ KKT
│   │   │   │   └── purge_billing_files.py  # آزادسازی فایل‌های قدیمی
│   │   │   └── tests/test_billing.py
│   │   ├── crm/                # سرنخ/فرصت/فعالیت
│   │   ├── dashboards/, datasets/, reporting/   # BI
│   │   ├── core/               # ماژول‌ها، تنظیمات پایه
│   │   └── … (finance, inventory, purchasing, sales, …)  # Nexivo، غیرفعال برای این مشتری
│   └── media/                  # لوگو/امضا/مهر، فایل‌های تولیدشده، approved/
├── frontend/
│   ├── index.html, vite.config.ts
│   ├── public/                 # آیکن‌ها، manifest، لوگوی پیش‌فرض
│   └── src/
│       ├── App.tsx             # routing + Suspense fallback (لوگوی برند)
│       ├── pages/
│       │   ├── LauncherPage.tsx
│       │   ├── ERPLayout.tsx   # سایدبار دسکتاپ + نوار پایین و شیت منوی موبایل
│       │   ├── LoginPage.tsx
│       │   ├── billing/        # Issue, Invoices, Payments, Performance, Payers, Services
│       │   ├── crm/, dashboard/, settings/
│       ├── components/, hooks/, store/, lib/
├── docs/                       # اسناد طراحی Nexivo + اسناد مالی
├── docker-compose.yml          # postgres/redis/superset/backend/celery/frontend (dev-ish)
├── docker-compose.prod.yml
├── Makefile / dev.bat          # دستورهای توسعه (لینوکس/ویندوز)
├── .env.example                # نمونهٔ متغیرهای محیطی (در ریشه)
└── PROGRESS.md / CHANGELOG.md
```

---

## راه‌اندازی توسعهٔ محلی

### پیش‌نیازها

- Python 3.11+، Node.js 20+، npm، Git Bash (روی ویندوز)
- PostgreSQL 15 — در این نصب به‌صورت کانتینر `nexivo_db` روی پورت **۵۵۴۴** بالا می‌آید
- (اختیاری) Redis برای Celery/Channels
- (لازم برای PDF) Microsoft Edge یا Google Chrome نصب‌شده. در نبود آن‌ها `WeasyPrint` استفاده می‌شود.

### گام‌به‌گام (ویندوز)

```bash
# 1) دیتابیس
docker start nexivo_db || docker run -d --name nexivo_db \
  -e POSTGRES_DB=nexivo -e POSTGRES_USER=nexivo_user -e POSTGRES_PASSWORD=nexivo_pass \
  -p 5544:5432 postgres:15

# 2) محیط پایتون
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 3) متغیرهای محیطی
cp .env.example backend/.env      # سپس مقادیر واقعی را وارد کنید

# 4) مهاجرت‌ها و دادهٔ اولیه
cd backend
../.venv/Scripts/python.exe manage.py migrate
../.venv/Scripts/python.exe manage.py seed_kkt        # ادمین، دسته‌های خدمت، قالب پیش‌فرض
../.venv/Scripts/python.exe manage.py create_dev_data # کاربران نمونه (اختیاری)
cd ..

# 5) اجرا (دو ترمینال جدا)
cd backend && ../.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
cd frontend && npm install && npm run dev      # http://localhost:3000
```

`npm run dev` روی پورت **۳۰۰۰** بالا می‌آید و `/api` و `/media` را به `http://localhost:8000` پروکسی می‌کند (`vite.config.ts`؛ با `VITE_PROXY_TARGET` قابل تغییر است).

روی ویندوز می‌توانید از `dev.bat` استفاده کنید: `dev.bat setup|migrate|seed|backend|frontend|dump|restore|test-backend|test-frontend`. معادل لینوکس/مک: `make` با همان تارگت‌ها (`make help`).

### ورود پیش‌فرض

`admin` / `admin12345` (از `seed_kkt` و `create_dev_data`) — **در محیط واقعی حتماً عوض شود**.

---

## متغیرهای محیطی

فایل `backend/.env` (نمونه در `.env.example` ریشه):

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `SECRET_KEY` | — | کلید Django؛ در تولید الزامی و تصادفی |
| `DEBUG` | `0` | پیش‌فرض در `settings.py`؛ `.env.example` مقدار `1` می‌گذارد |
| `POSTGRES_DB` | `nexivo` | نام دیتابیس (این نصب: `kermankhodro`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `nexivo_user` / `nexivo_pass` | کاربر DB |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | آدرس DB (برای کانتینر محلی: `127.0.0.1:5544`) |
| `REDIS_URL` | `redis://redis:6379/0` | بروکر Celery و لایهٔ Channels؛ `.env.example` برای اجرای محلی `localhost:6379` می‌دهد |
| `SUPERSET_API_URL` و … | — | فقط برای BI/Superset؛ برای مشتری لازم نیست |
| `PDF_BROWSER_PATH` | — | مسیر دستی Edge/Chrome برای تولید PDF (وقتی مرورگر در مسیرهای پیش‌فرض نیست) |

- `ALLOWED_HOSTS = ["*"]` است؛ برای تولید محدود شود.
- CORS سه مبدأ `http://localhost:3000`، `http://127.0.0.1:3000` و `http://localhost:5173` را مجاز می‌کند؛ دامنهٔ تولید باید در `CORS_ALLOWED_ORIGINS` افزوده شود.
- JWT با `JWT_SECRET` (پیش‌فرض `SECRET_KEY`) و انقضای ۲۴ ساعت (`JWT_EXPIRATION_HOURS`) امضا می‌شود.

---

## دادهٔ اولیه و seed

- `manage.py seed_kkt` — ایدمپوتنت: کاربر `admin` با نقش `admin`، شرکت پیش‌فرض، شش دستهٔ خدمت (ویزا، اتوبوس، قطار، گشت، تور، CIP) و قالب پیش‌فرض صورت‌حساب/نامه. **روی نصب تازه اول این را بزنید.**
- `manage.py create_dev_data` — کاربران نمونه برای توسعه (نقش‌های مختلف برای تست مجوزها).
- `manage.py seed_default_modules` — ماژول‌های لانچر را همگام می‌کند.
- `manage.py purge_billing_files [--hours N]` — محتوای فایل‌های تولیدشدهٔ قدیمی‌تر از پنجرهٔ نگه‌داری (پیش‌فرض ۲۴ ساعت، `services/files.py::RETENTION_HOURS`) را پاک می‌کند. متادیتای فایل و امکان بازسازی باقی می‌ماند.

---

## احراز هویت و مجوزها

- ورود: `POST /api/v1/auth/login/` با `username`/`password` → `{ token }`؛ همهٔ درخواست‌ها با هدر `Authorization: Bearer <token>`.
- کلاس احراز هویت پیش‌فرض `apps.accounts.authentication.JWTAuthentication` و اجازهٔ پیش‌فرض `IsAuthenticated`.
- نقش‌ها در `accounts.User.role`؛ نقش‌های `ceo` و `admin` همیشه از ماتریس مجوز عبور می‌کنند. بقیهٔ کاربران تابع فلگ هستند.

فلگ‌های مجوز (`apps/billing/permissions.py::PERMISSION_FLAGS`):

```
can_view, can_pay, can_issue, can_manage_users, can_manage_settings,
can_delete_history, can_delete_payment, can_export, can_manage_companies,
can_submit, can_approve, can_edit_template
```

- محافظت مسیرها با دکوریتور `@perm_required("can_x")`؛ پاسخ ۴۰۱ برای کاربر ناشناس و ۴۰۳ برای نداشتن مجوز (پیام فارسی).
- فرانت مجوزهای کاربر را از `GET /api/v1/billing/me/` می‌گیرد و آیتم‌های ناوبری/دکمه‌ها را بر همان اساس نشان می‌دهد (مثلاً «صدور» فقط با `can_issue`). **در سمت سرور همیشه دوباره بررسی شود؛ هرگز به UI اعتماد نکنید.**

---

## دامنهٔ مالی (billing)

`apps/billing/models.py`:

| مدل | نقش |
|---|---|
| `Payer` | طرف حساب (کد یکتا، نام، نوع `legal`/`person`، `parent` برای شرکت زیرمجموعه، شناسه/کد اقتصادی، تلفن، آدرس) |
| `Invoice` | یک ردیف دفتر کل به‌ازای هر فایل تولیدشده: payer_code، نوع خدمت، شماره نامه، مبلغ، تاریخ صدور، مسیر فایل و فیلدهای ابطال (`reversed_at`/`reversed_by`/`reversal_reason`). ردیف ابطال‌شده باقی می‌ماند و در مانده حساب نمی‌شود |
| `BillingAuditEntry` | ردپای ابطال و حذف ردیف‌های مالی: موجودیت، شناسه، عملیات، دلیل، تصویر کامل رکورد و کاربر |
| `Payment` | پرداخت: payer، مبلغ، تاریخ، شماره پیگیری، توضیح، `created_at` (فیلد «سازنده» وجود ندارد) |
| `ManualDebt` | بدهی دستی (بدون صورت‌حساب) |
| `Credit` | بستانکاری/اعتبار |
| `LetterSequence` / `AvailableLetterNumber` | شماره‌گذاری نامه و شماره‌های آزادشده |
| `ApprovalRequest` | درخواست صدور + وضعیت گردش تأیید + payload ردیف‌ها |
| `FinalFile` | فایل تولیدشده: دو نسخه (BLOB در `file_data` + مسیر روی دیسک)، `purged_at` پس از پنجرهٔ نگه‌داری |
| `ServiceCategory` | دستهٔ خدمت (نام فارسی، کد، ترتیب) |
| `InvoiceTemplate` | قالب قابل ویرایش صورت‌حساب/نامه (HTML/Word) |
| `CompanySettings` | تک‌رکورد: نام/شناسه/آدرس/تلفن، دو حساب بانکی + شبا، لوگو، امضا، مهر، نام و سمت مدیر، سه قالب Word (اصلی/زیرمجموعه/بستانکاری)، پانویس قانونی، مسیر ذخیرهٔ فایل تأییدشده |

### مانده: همیشه مشتق‌شده

هیچ فیلد ذخیره‌شده‌ای برای مانده وجود ندارد. `services/balance.py` مانده را از دفتر کل محاسبه می‌کند:

```
مانده = مبلغ صورت‌حساب‌ها + بدهی‌های دستی − پرداخت‌ها − بستانکاری‌ها
```

نتیجه در سه جا یکسان است: `Payer` در فهرست، اندپوینت `payers/<code>/balance/` و صفحهٔ عملکرد. **قاعده:** هیچ‌وقت مانده را در مدل ذخیره/کش نکنید؛ هر تغییر در فرمول باید در `balance.py` باشد و تست `test_invoice_row_payment_lowers_balance_and_keeps_the_invoice` را به‌روز کند.

### پرداخت از ردیف صورت‌حساب

دکمهٔ پرداخت روی هر ردیف صورت‌حساب همان `POST /api/v1/billing/payments/` را صدا می‌زند (با شمارهٔ نامه به‌عنوان مرجع). فقط یک دفتر کل وجود دارد؛ بنابراین پرداخت فوراً در مانده و در فهرست پرداخت‌ها دیده می‌شود و صورت‌حساب هم حذف/پنهان نمی‌شود (صورت‌حساب پرداخت‌شده در فهرست می‌ماند و با فیلتر خدمت/وضعیت قابل جداسازی است).

---

## شماره‌گذاری نامه و گردش تأیید

- شمارهٔ نامه: `YYYY/COMPANYCODE/NNNNN` (مثال `1404/8200/00001`)، تولید در `services/numbers.py` و ارسال از `GET /billing/next-letter/`.
- گردش: `pending` → `approve` (فایل‌ها ساخته می‌شوند) یا `reject` (شماره آزاد می‌شود). `approval_approve` فایل‌ها را در `FinalFile` ثبت و در مسیر «فایل‌های تأییدشده» (`CompanySettings.approved_output_path` یا `MEDIA_ROOT/approved`) ذخیره می‌کند.
- دسترسی: خواندن `can_view`، ثبت `can_submit`، تأیید `can_approve`. صف‌ها: `GET /billing/approvals/pending/` (با `can_view`) و `GET /billing/approvals/mine/` (با `can_submit`).
- دانلود نامه: `GET /billing/files/<id>/download/` یا `GET /billing/files/by-letter/<letter_number>/` (برای ردیف‌هایی که فایل با شناسه ندارند). بازسازی: `POST /billing/files/<id>/regenerate/`.

---

## تولید فایل: Word و PDF

`apps/billing/services/generation.py`

1. **نامه = Word (`.docx`)** — قالب Word آپلودی شرکت (سه قالب: اصلی، زیرمجموعه، بستانکاری) با placeholderهای `{{ }}` و `docxtpl`؛ اگر قالبی آپلود نشده باشد، همان نامه به‌صورت برنامه‌ای با `_render_programmatic_docx` ساخته می‌شود (پوشهٔ `services/templates/` وجود ندارد). لوگو/امضا/مهر و اطلاعات شرکت تزریق می‌شوند.
2. **صورت‌حساب = PDF** — از HTML ساخته می‌شود (`INVOICE_HTML` + `INVOICE_CSS` با Jinja)، نه از Word:
   - A4 افقی، جهت RTL، اعداد فارسی. فونت **Vazirmatn داخل خود PDF جاسازی می‌شود** (دو زیرمجموعهٔ arabic و latin با وزن ۴۰۰/۷۰۰ از `services/assets/`، مجوز SIL OFL)؛ بنابراین خروجی روی هر ماشینی یکسان است و به نصب B Nazanin یا Tahoma وابسته نیست. B Nazanin همچنان در نامهٔ Word استفاده می‌شود، چون آن را Word روی سیستم کاربر رندر می‌کند.
   - عرض ستون‌ها با `<colgroup>` ثابت است (ردیف ۵٪، قرارداد ۹٪، مسافر ۱۶٪، شرح خدمات ۲۰٪، تاریخ ۱۰٪، توضیحات ۱۲٪، بدهکار ۱۰٪، بستانکار ۸٪، مانده ۱۰٪) و `overflow-wrap: anywhere` باعث می‌شود نام‌های طولانی در همان سلول بشکنند و جدول از حاشیهٔ صفحه بیرون نزند.
   - هدر: لوگو، تاریخ، شمارهٔ صورت‌حساب؛ عنوان «صورت حساب {نوع خدمت} {شرکت}»
   - جدول ۹ ستونی، **۸ ردیف در هر صفحه**، **جمع هر صفحه** و **جمع کل** در پایان
   - فوتر: محل امضا، مهر و نام/سمت مدیر؛ لوگو/امضا/مهر به‌صورت data-URI تزریق می‌شوند
   - نکتهٔ مهم Jinja: استایل‌شیت با `{{ css|safe }}` درج می‌شود؛ اگر `safe` حذف شود، فاصله‌گذاری HTML کوتیشن‌های `font-family` را به `&#39;` تبدیل می‌کند، کل اعلان فونت بی‌اثر می‌شود و خروجی بی‌صدا با فونت پیش‌فرض (Times New Roman) چاپ می‌شود. تست `test_stylesheet_is_not_html_escaped` مراقب این رگرسیون است.
   - موتور PDF: یک پروسهٔ headless Edge/Chrome که **برای هر درخواست فقط یک‌بار** بالا می‌آید (`PdfBrowser` در همان فایل، با پروتکل DevTools) و همهٔ صورت‌حساب‌های آن درخواست را چاپ می‌کند؛ یک تأیید سه‌خدمتی با سه ردیف PDF در حدود ۴ ثانیه تمام می‌شود. فقط وقتی هیچ مرورگری پیدا نشود `WeasyPrint` استفاده می‌شود؛ اگر مرورگر موجود باشد ولی بالا نیاید یا چاپ را برنگرداند، `GenerationError` با پیام فارسی پرتاب و در `generation_error` درخواست ثبت می‌شود (دیگر به‌صورت خاموش به WeasyPrint برنمی‌گردد).
3. ستون‌ها بر اساس نوع خدمت نگاشت می‌شوند: پرواز (مسیر/تاریخ پرواز/`بلیط: …`)، هتل (هتل + نوع اتاق، بازهٔ ورود و خروج، نفرات)، سایر خدمات (شرح خدمات/تاریخ/توضیحات).
4. پس از پنجرهٔ نگه‌داری، فقط payload فایل پاک می‌شود؛ `regenerate_file` همان ورودی ذخیره‌شده را دوباره می‌سازد (Word و PDF هر دو).

> نکته: قالب قابل ویرایش (`InvoiceTemplate`) فقط در پیش‌نمایش **نامه** (`render_html`) اعمال می‌شود؛ صورت‌حساب PDF همیشه از `INVOICE_HTML`/`INVOICE_CSS` ثابت ساخته می‌شود. پیش‌نمایش `POST /billing/templates/active/preview/` است و مجوز `can_edit_template` می‌خواهد.

---

## API مالی

پیشوند: `/api/v1/billing/`

| متد و مسیر | کار | مجوز |
|---|---|---|
| `GET/POST /payers/` | فهرست/ایجاد طرف حساب (با مانده) | `can_view` / `can_manage_companies` |
| `GET/PUT/DELETE /payers/<code>/` | جزئیات/ویرایش/حذف | `can_view` / `can_manage_companies` |
| `GET /payers/<code>/balance/` | ماندهٔ مشتق‌شده | `can_view` |
| `GET /invoices/?type=&payer_code=` | فهرست صورت‌حساب‌ها با فیلتر خدمت | `can_view` |
| `DELETE /invoices/` | **ابطال گروهی** همهٔ صورت‌حساب‌های فعال (ردیفی حذف نمی‌شود؛ شماره‌ها آزاد نمی‌شوند) | `can_delete_history` |
| `GET /invoices/<id>/` | جزئیات ردیف | `can_view` |
| `DELETE /invoices/<id>/` | **ابطال** صورت‌حساب (ردیف و شمارهٔ نامه باقی می‌مانند؛ دلیل اختیاری در `reason`) | `can_delete_history` |
| `GET /invoices/types/` | انواع خدمت موجود در داده | `can_view` |
| `GET/POST /payments/` | فهرست/ثبت پرداخت | `can_view` / `can_pay` |
| `DELETE /payments/<id>/` | حذف پرداخت + ثبت در `BillingAuditEntry` | `can_delete_payment` |
| `GET/POST /debts/`, `/credits/` | بدهی دستی و بستانکاری | `can_view` / `can_issue` |
| `DELETE /debts/<id>/`, `/credits/<id>/` | حذف ردیف + ثبت در `BillingAuditEntry` | `can_delete_history` |
| `POST /upload/excel/`, `/process/excel/` | آپلود و پردازش فایل‌های ورودی | `can_issue` |
| `GET/POST /approvals/` | درخواست‌ها | `can_view` / ثبت با `can_submit` |
| `GET /approvals/pending/`, `/approvals/mine/` | صف تأیید | `can_view` / `can_submit` |
| `POST /approvals/<id>/approve/`, `/reject/` | تأیید/رد | `can_approve` |
| `GET /approvals/<id>/files/` | فایل‌های درخواست | `can_view` |
| `GET /files/<id>/download/` | دانلود Word/PDF | `can_view` |
| `GET /files/by-letter/<letter_number>/` | دانلود با شمارهٔ نامه | `can_view` |
| `POST /files/<id>/regenerate/` | بازسازی فایل | `can_approve` |
| `GET /templates/active/`, `POST …/preview/` | قالب فعال و پیش‌نمایش | `can_view` / `can_edit_template` |
| `GET/POST /service-categories/`, `…/<id>/` | دسته‌های خدمت | `can_view` / `can_manage_settings` |
| `GET/PUT /settings/` | تنظیمات شرکت (تک‌رکورد) | `can_view` / `can_manage_settings` |
| `POST /settings/upload-asset/` | آپلود لوگو/امضا/مهر | `can_manage_settings` |
| `POST /settings/upload-template/` | آپلود قالب Word | `can_manage_settings` |
| `POST /admin/backup/`, `/admin/restore/` | پشتیبان‌گیری/بازیابی | `can_manage_settings` |
| `GET /me/` | مجوزهای کاربر جاری | `can_view` (کاربر بدون این فلگ ۴۰۳ می‌گیرد) |
| `GET /next-letter/` | شمارهٔ نامهٔ بعدی | `can_issue` |
| `GET /passengers/?q=` | پیشنهاد مسافران از تاریخچه | `can_view` |
| `GET /dashboard/summary/` | خلاصهٔ داشبورد | `can_view` |

OpenAPI: با `drf-spectacular` تولید می‌شود و همیشه روی `/api/schema/` (YAML) و `/api/docs/` (Swagger UI) در دسترس است؛ در استقرار تولید پشت احراز هویت/شبکه قرار دهید.

---

## فرانت‌اند

### مسیرها (`src/App.tsx`)

| مسیر | صفحه |
|---|---|
| `/login` | ورود |
| `/` و `/launcher` | لانچر ماژول‌ها |
| `/erp` | داشبورد مدیریتی |
| `/erp/billing/issue` | صدور صورت‌حساب (آپلود چندفایلی + ادیتور جدولی) |
| `/erp/billing/invoices` | فهرست صورت‌حساب‌ها (فیلتر خدمت، دانلود، پرداخت از ردیف) |
| `/erp/billing/payments` | پرداخت‌ها |
| `/erp/billing/performance` | عملکرد (مانده‌ها، جمع‌ها، نمودار) |
| `/erp/billing/payers` | مشتریان/طرف‌حساب‌ها |
| `/erp/billing/services` | مدیریت دسته‌های خدمت |
| `/erp/crm`, `/erp/crm/leads`, `…/opportunities`, `…/activities` | CRM |
| `/erp/settings`, `/erp/settings/users` | تنظیمات شرکت و کاربران/مجوزها |

بقیهٔ مسیرهای ERP (finance/inventory/sales/…) از Nexivo باقی مانده‌اند و برای این مشتری در ناوبری نیستند؛ در صورت نیاز به فعال‌سازی، ابتدا مالکیت داده و مجوزها را مشخص کنید.

### چیدمان و تجربهٔ کاربری

- `ERPLayout.tsx` سایدبار دسکتاپ را فقط از `lg` به بالا نشان می‌دهد.
- **موبایل:** نوار پایین با ۴ مقصد پرکاربرد + دکمهٔ «منو». دکمهٔ همبرگری در هدر وجود ندارد. «منو» یک **کارت** از پایین باز می‌کند (ترنسفورم inline، `translateY(115%) → 0`، ۳۰۰ms) با دستگیره، عنوان، دکمهٔ بستن و ردیف‌های بزرگ (متن ۱۵–۱۶px، آیکون ۳۶px، هایلایت آیتم فعال). با انتخاب آیتم، کارت پایین می‌رود و بعد از همان ۳۰۰ms صفحه باز می‌شود (`SHEET_TRANSITION_MS`). وقتی کارت بسته است `inert` می‌شود تا فوکوس روی ردیف‌های نامرئی نرود.
- تم روشن/تیره با کلاس `dark` روی `html`. برای کارت‌های همیشه‌تیره (پوستهٔ نفتی) از کلاس `dark-surface` استفاده کنید تا متن سفید داخلشان با قاعدهٔ سراسری `html:not(.dark) .text-slate-600` دچار کنتراست پایین نشود.
- لودینگ زیرمنوها (Suspense در `App.tsx`) لوگوی **برند** را نشان می‌دهد (`useBrandLogo`)؛ لوگوی Nexivo فقط fallback پیش‌فرض است.
- `CARD` مشترک صفحات مالی در `src/pages/billing/shared.ts` است؛ ظاهر کارت‌ها را از آنجا تغییر دهید، نه تک‌تک صفحات.
- PWA: `manifest.webmanifest` + آیکن‌ها؛ نصب روی موبایل پشتیبانی می‌شود.

---

## تست و بررسی

```bash
# بک‌اند (کل مالی)
cd backend && ../.venv/Scripts/python.exe manage.py test apps.billing --noinput

# فقط یک تست
cd backend && ../.venv/Scripts/python.exe manage.py test apps.billing.tests.test_billing.BillingAPITest.test_invoice_row_payment_lowers_balance_and_keeps_the_invoice

# فرانت
cd frontend && npx tsc --noEmit && npm run build
```

وضعیت فعلی: **۴۷ تست بیلینگ سبز**، `tsc` بدون خطا، بیلد production موفق.

تست‌های موتور PDF: `test_one_browser_launch_serves_every_pdf_of_a_request` (یک `PdfBrowser` برای سه صورت‌حساب)، `test_browser_failure_is_reported_instead_of_falling_back` (بدون فراخوانی WeasyPrint) و `test_approval_records_the_pdf_failure_in_persian` (پیام فارسی در `generation_error`، Word ساخته می‌شود، PDF نه).

تست‌های محتوای PDF (`InvoicePdfContentTests`): PDF واقعی ساخته می‌شود و با **PyMuPDF** متن صفحات برگردانده می‌شود؛ با ۱۰ ردیف باید ۲ صفحه باشد، عنوان «صورت حساب پرواز شرکت نمونه»، جمع کل ۵۵,۰۰۰,۰۰۰ و نام مسافر طولانی هر کدام در متن صفحه پیدا شوند. یک صورت‌حساب معتبر اما خالی/خراب (یا قالب Jinja شکسته) همین‌جا شکست می‌خورد. اگر روی ماشین مرورگر headless نصب نباشد، تست به‌جای سبز شدنِ کاذب `skip` می‌شود.

> استخراج متن فارسی از PDF، ترتیب دیداری است و ZWNJ/شکستن سطر را ندارد؛ در نتیجه تست روی **واژه‌ها** assert می‌کند نه عبارت کامل. `pymupdf` فقط برای همین تست‌ها در `requirements.txt` است.

تست‌های مهم که نباید بی‌دلیل تغییر کنند:

- `test_invoice_row_payment_lowers_balance_and_keeps_the_invoice` — پرداخت از ردیف: افت مانده در سه سطح و باقی‌ماندن صورت‌حساب.
- تست‌های گردش تأیید — تأیید درخواست، تولید PDF با امضای `%PDF-` و وجود فایل Word.
- تست‌های شماره‌گذاری، مجوزها (۴۰۱/۴۰۳)، آپلود اکسل و تنظیمات شرکت.

---

## استقرار و عملیات

- `docker-compose.yml`: postgres، redis، superset، backend، frontend برای محیط توسعه/نمایش.
- `docker-compose.prod.yml`: نسخهٔ تولید (Gunicorn + Nginx/Vite build). پیش از استقرار: `DEBUG=0`، `SECRET_KEY` تصادفی، دامنه در `ALLOWED_HOSTS` و `CORS_ALLOWED_ORIGINS`، سرو `media/` و بکاپ دیتابیس.
- **بکاپ/بازیابی:** `make dump` / `make restore FILE=backups/x.sql` (ویندوز: `dev.bat dump|restore`). قبل از هر مهاجرت سنگین یک dump بگیرید.
- **فایل‌های تولیدی:** در `MEDIA_ROOT/approved` (یا مسیر تنظیمات). حجم را کنترل کنید؛ `purge_billing_files` را روزانه در cron بگذارید: `0 3 * * * python manage.py purge_billing_files --hours 24`.
- **فونت:** لازم نیست هیچ فونتی روی سرور نصب باشد؛ Vazirmatn (OFL) در `services/assets/` همراه کد است و به‌صورت base64 داخل CSS صورت‌حساب جاسازی می‌شود. فقط برای نامهٔ Word، نصب B Nazanin روی سیستم کاربر نهایی لازم است (در Docker فونت لازم نیست).
- **مرورگر headless:** `_find_pdf_browser` اول `PDF_BROWSER_PATH` و سپس مسیرهای ویندوز/لینوکس Edge و Chrome را می‌گردد؛ روی مک مسیر bundle (`/Applications/…`) در فهرست نیست، پس باید `PDF_BROWSER_PATH` را ست کرد. `--headless=new` نیاز به Chrome/Edge نسخهٔ ۱۱۲ به بالا دارد. کتابخانهٔ `websocket-client` کلاینت CDP است و در `requirements.txt` آمده است.
- **تصویر Docker پیش‌فرض نه مرورگر دارد نه کتابخانه‌های WeasyPrint:** `backend/Dockerfile` از `python:3.11-slim` استفاده می‌کند و نه Chromium نصب می‌کند نه pango/cairo (وابستگی‌های سیستمی WeasyPrint). یعنی در آن تصویر تولید PDF صورت‌حساب شکست می‌خورد؛ برای استقرار Docker باید Chromium (یا بستهٔ سیستمی WeasyPrint) به تصویر اضافه شود. اگر کانتینر با کاربر root اجرا شود، `PdfBrowser` خودش `--no-sandbox` را اضافه می‌کند (Chromium به‌عنوان root سندباکس را راه نمی‌اندازد)؛ روی کاربر عادی و روی ویندوز این فلگ اضافه نمی‌شود.

---

## قواعد و نکات توسعه

1. **مانده را ذخیره نکنید.** هر تغییر مالی باید در `services/balance.py` منعکس شود و تست داشته باشد.
2. **یک دفتر کل.** پرداخت از هر مسیری باید `POST /billing/payments/` را بزند؛ اندپوینت موازی نسازید.
3. **فایل‌ها قابل بازسازی‌اند.** تولید در `generation.py`؛ منطق ذخیره/انقضا در `files.py`. مسیر فایل را در مدل ذخیره نکنید مگر از طریق `FinalFile`.
4. **سرور توسعه با `--noreload`** بالا می‌آید؛ بعد از هر تغییر بک‌اند باید دستی ری‌استارت شود. اگر تغییرات را نمی‌بینید، اول همین را چک کنید.
5. **فرانت:** `npx tsc --noEmit` قبل از کامیت؛ بیلد production حدود ۵۰ ثانیه است. نوع‌ها را با `any` دور نزنید.
6. **متن‌ها فارسی و RTL** هستند؛ اعداد نمایشی با `to_persian_digits` و تاریخ‌ها با تقویم شمسی. در PDF/Word هم همین قواعد رعایت می‌شود.
7. **مجوز در سرور.** افزودن endpoint جدید بدون `@perm_required` ممنوع.
8. **کنتراست:** روی سطوح همیشه‌تیره `dark-surface` بگذارید؛ متن زیر ۳:۱ قابل قبول نیست (تست دستی با DevTools).
9. **مهاجرت‌ها:** پس از تغییر مدل `makemigrations` + `migrate` و کامیت فایل مهاجرت. هیچ‌وقت مهاجرت را دستکاری نکنید که روی دیتابیس مشتری اجرا شده باشد.
10. **Git:** ریموت `origin` = `github.com/myazdanpanah/KermanKhodroTravel` (شاخهٔ `main`)، ریموت `upstream` = Nexivo. شاخهٔ جاری توسعه `customer/kermankhodro` است و تغییرات با `git push origin HEAD:main` منتشر می‌شوند. ادغام آپ‌استریم باید با احتیاط و همراه با تست‌های مالی انجام شود (فایل‌های `generation.py`، `ERPLayout.tsx` و مدل‌های billing بیش از همه تعارض می‌گیرند).
11. **CRLF/LF:** مخزن روی ویندوز با `core.autocrlf` کار می‌کند؛ هنگام کامیت هشدار CRLF طبیعی است و نباید فایل‌ها را بازنویسی خطی کنید.

---

## کارهای باقی‌مانده / محدودیت‌ها

- ماژول‌های Nexivo (انبار، خرید، فروش، تولید، ترابر) برای این مشتری پیاده/آزمایش نشده‌اند؛ در لانچر پنهان‌اند.
- PDF بدون مرورگر به WeasyPrint برمی‌گردد، اما این مسیر فقط وقتی کار می‌کند که pango/cairo نصب باشند؛ در تصویر Docker فعلی هیچ‌کدام نیست (بالا را ببینید). اگر مرورگر موجود باشد ولی خطا بدهد، `GenerationError` فارسی ثبت می‌شود و PDF ساخته نمی‌شود — عمداً به WeasyPrint برنمی‌گردد.
- مسیر مرورگر روی مک در فهرست پیش‌فرض نیست؛ آنجا `PDF_BROWSER_PATH` لازم است.
- Superset برای BI پیکربندی نشده و داشبورد مدیریتی از داده‌های خود سیستم تغذیه می‌شود.
- حذف تاریخچه (`can_delete_history`) و بازیابی/پشتیبان‌گیری درون‌برنامه‌ای باید قبل از استفاده روی دادهٔ واقعی آزمایش شود.
- تست‌های frontend وجود ندارند؛ بررسی‌ها با `tsc`، بیلد و آزمون دستی انجام می‌شود.

---

## تاریخچه و منابع

- `docs/Financial/` — مشخصات مالی اصلی Nexivo: `ACCOUNTING_MODULE.md`، `API_SPECIFICATION.md`، `DATABASE_SCHEMA.md`، `DJANGO_BACKEND.md`، `IMPLEMENTATION_ROADMAP.md`.
- `docs/NEXIVO-COMPLETE-GUIDE.md` — راهنمای جامع پلتفرم.
- `PROGRESS.md` و `CHANGELOG.md` — تاریخچهٔ تغییرات و وضعیت کارها.
- `CONTRIBUTING.md` — قواعد مشارکت؛ `LICENSE` — مجوز.

> این README برای توسعهٔ آیندهٔ همین فورک نوشته شده است؛ اگر رفتاری در کد با این سند نمی‌خواند، کد مرجع است و این سند باید به‌روز شود.
