# گرفتن بکاپ قبل از انتقال داده

قبل از هر تغییر، دو بکاپ بگیر: یکی از **SQL Server (مبدأ)** و یکی از
**PostgreSQL (مقصد)**. هر دو فقط خواندن از دیتابیس هستند و به داده‌ها آسیب نمی‌زنند.

---

## ۱) بکاپ SQL Server (مبدأ)

### روش الف: با SSMS 22 (گرافیکی)

1. در **Object Explorer** روی دیتابیس موردنظر کلیک راست کن.
2. مسیر: **Tasks → Back Up...**
3. در پنجرهٔ Back Up Database:
   - **Backup type**: `Full`
   - **Destination**: دکمهٔ **Remove** را بزن تا مسیر پیش‌فرض حذف شود، بعد
     **Add...** و مسیر و نام فایل را بده:
     `C:\Backup\MyDatabase_20261121.bak`
   - در تب **Options**:
     - ✅ **Verify backup when finished**
     - ✅ **Compress backup** (اگر نسخهٔ SQL Server پشتیبانی کند)
     - **Overwrite media**: `Overwrite all existing backup sets`
4. **OK** و صبر کن تا پیام `The backup set on file 1 is valid` بیاید.

> نکته: پوشهٔ مقصد باید برای اکانت سرویس SQL Server قابل نوشتن باشد. اگر خطای
> دسترسی گرفتی، فایل را در مسیر پیش‌فرض خود SQL Server بگذار و بعد با File Explorer
> کپی کن.

### روش ب: با T-SQL (Query Window در SSMS)

```sql
BACKUP DATABASE [نام_دیتابیس_شما]
TO DISK = N'C:\Backup\MyDatabase_20261121.bak'
WITH COPY_ONLY, INIT, COMPRESSION, CHECKSUM, STATS = 10;
```

- `COPY_ONLY`: بکاپ را از زنجیرهٔ Log Backup جدا می‌کند و روی بکاپ‌های معمولی
  سرور اثری نمی‌گذارد. برای «فقط می‌خوام یک کپی داشته باشم» مناسب است.
- `COMPRESSION` اگر نسخه پشتیبانی نکند، حذفش کن.
- `STATS = 10` هر ۱۰٪ پیشرفت را نشان می‌دهد.

### بررسی سالم بودن بکاپ

```sql
RESTORE VERIFYONLY
FROM DISK = N'C:\Backup\MyDatabase_20261121.bak';
```

باید بنویسد: `The backup set on file 1 is valid.`

### برگرداندن بکاپ (در صورت نیاز)

روی یک دیتابیس جدید:

```sql
RESTORE DATABASE [MyDatabase_RestoreTest]
FROM DISK = N'C:\Backup\MyDatabase_20261121.bak'
WITH MOVE N'نام_فایل_داده' TO N'C:\Data\MyDatabase_RestoreTest.mdf',
     MOVE N'نام_فایل_لاگ'  TO N'C:\Data\MyDatabase_RestoreTest_log.ldf',
     RECOVERY;
```

برای پیدا کردن نام منطقی فایل‌ها:

```sql
RESTORE FILELISTONLY
FROM DISK = N'C:\Backup\MyDatabase_20261121.bak';
```

---

## ۲) بکاپ PostgreSQL (مقصد)

پروژه از کانتینر `nexivo_db` استفاده می‌کند: دیتابیس `kermankhodro`، کاربر
`nexivo_user`، پورت `5544`.

### گرفتن بکاپ

از ریشهٔ پروژه در PowerShell:

```powershell
cd C:\KermanKhodroTravel
New-Item -ItemType Directory -Force -Path backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"

docker exec -e PGPASSWORD=nexivo_pass_change_me nexivo_db `
  pg_dump -U nexivo_user -d kermankhodro -Fc -f "/tmp/nexivo_$ts.dump"

docker cp "nexivo_db:/tmp/nexivo_$ts.dump" ".\backups\nexivo_$ts.dump"
docker exec nexivo_db rm "/tmp/nexivo_$ts.dump"

Get-Item ".\backups\nexivo_$ts.dump"
```

- `-Fc` فرمت فشرده و قابل بازیابی انتخابی است.
- فایل در `backups\` ذخیره می‌شود (این پوشه در `.gitignore` است).
- قبلاً یک بکاپ هم گرفته شده:
  `backups\kermankhodro_before_mssql_import_20261121_120814.dump`

### بررسی فایل بکاپ

```powershell
docker exec -i -e PGPASSWORD=nexivo_pass_change_me nexivo_db `
  pg_restore -l /dev/stdin < .\backups\nexivo_YYYYMMDD_HHMMSS.dump | Select-Object -First 20
```

### برگرداندن بکاپ

```powershell
docker cp .\backups\nexivo_YYYYMMDD_HHMMSS.dump nexivo_db:/tmp/restore.dump
docker exec -e PGPASSWORD=nexivo_pass_change_me nexivo_db `
  pg_restore -U nexivo_user -d kermankhodro --clean --if-exists --no-owner /tmp/restore.dump
docker exec nexivo_db rm /tmp/restore.dump
```

⚠️ `--clean` جداول موجود را قبل از بازیابی حذف می‌کند. فقط وقتی بزن که مطمئنی
می‌خواهی وضعیت قبلی کامل برگردد.

---

## ۳) کپی امن بکاپ‌ها

فایل `.bak` و `.dump` را روی همان سرور نگه ندار — یک کپی روی کامپیوتر شخصی یا
فضای ابری بگذار. قبل از ایمپورت، تاریخ و نام فایل‌ها را یادداشت کن.
