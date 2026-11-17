@echo off
setlocal

set PYTHON=python
set PIP=pip
set NPM=npm
set MANAGE=%PYTHON% backend\manage.py

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="install" goto install
if "%1"=="migrate" goto migrate
if "%1"=="seed" goto seed
if "%1"=="setup" goto setup
if "%1"=="start-db" goto startdb
if "%1"=="start-redis" goto startredis
if "%1"=="start-services" goto startservices
if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend
if "%1"=="dev" goto dev
if "%1"=="stop" goto stop
if "%1"=="dump" goto dump
if "%1"=="restore" goto restore
if "%1"=="test-backend" goto testbackend
if "%1"=="test-frontend" goto testfrontend

echo Unknown command: %1
goto help

:help
echo.
echo   Nexivo - Local Development Commands (Windows)
echo   =============================================
echo.
echo   dev.bat install        Install all dependencies
echo   dev.bat setup          First-time setup (install + migrate + seed)
echo   dev.bat migrate        Run database migrations
echo   dev.bat seed           Create dev superuser + sample users
echo   dev.bat start-db       Start PostgreSQL via Docker
echo   dev.bat start-redis    Start Redis via Docker
echo   dev.bat start-services Start all required services
echo   dev.bat backend        Start Django backend (port 8000)
echo   dev.bat frontend       Start Vite frontend (port 3000)
echo   dev.bat stop           Stop Docker containers (keeps data)
echo   dev.bat dump           Snapshot database to backups\nexivo_TIMESTAMP.sql
echo   dev.bat restore [file] Restore a snapshot (default: newest in backups\)
echo   dev.bat test-backend   Run Django checks
echo   dev.bat test-frontend  Run TypeScript typecheck
echo.
goto :eof

:install
echo Installing backend dependencies...
cd backend && %PIP% install -r requirements.txt && cd ..
echo Installing frontend dependencies...
cd frontend && %NPM% install && cd ..
goto :eof

:migrate
echo Running migrations...
cd backend && %MANAGE% migrate && cd ..
goto :eof

:seed
echo Creating dev users...
cd backend && %MANAGE% create_dev_data && cd ..
goto :eof

:setup
echo.
echo ===========================================
echo   Nexivo - First-Time Setup
echo ===========================================
call :install
if not exist "backend\.env" (
    copy .env.example backend\.env
    echo Created backend\.env from .env.example
) else (
    echo backend\.env already exists, skipping
)
call :migrate
call :seed
echo.
echo Setup complete! Run 'dev.bat backend' and 'dev.bat frontend' in separate terminals.
goto :eof

:startdb
echo Starting PostgreSQL...
docker start nexivo_db 2>nul || docker run -d --name nexivo_db -e POSTGRES_DB=nexivo -e POSTGRES_USER=nexivo_user -e POSTGRES_PASSWORD=nexivo_pass -p 5544:5432 postgres:15
goto :eof

:startredis
echo Starting Redis...
docker start nexivo_redis 2>nul || docker run -d --name nexivo_redis -p 6379:6379 redis:7-alpine
goto :eof

:startservices
call :startdb
call :startredis
echo Waiting for PostgreSQL...
timeout /t 3 /nobreak >nul
echo Services started!
goto :eof

:backend
echo Starting Django backend on http://localhost:8000 ...
cd backend && %MANAGE% runserver 0.0.0.0:8000
goto :eof

:frontend
echo Starting Vite frontend on http://localhost:3000 ...
cd frontend && %NPM% run dev
goto :eof

:dev
call :migrate
call :seed
echo.
echo ===========================================
echo   Nexivo - Starting Local Development
echo ===========================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   Admin:    admin / admin12345
echo ===========================================
echo.
echo Start the backend and frontend in separate terminals:
echo   dev.bat backend
echo   dev.bat frontend
goto :eof

:stop
echo Stopping containers (data is kept)...
docker stop nexivo_db nexivo_redis 2>nul
goto :eof

:dump
if not exist "backups" mkdir backups
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%i"
set "DUMPFILE=backups\nexivo_%STAMP%.sql"
echo Dumping database nexivo from nexivo_db to %DUMPFILE% ...
docker exec nexivo_db pg_dump -U nexivo_user -d nexivo --clean --if-exists --no-owner > "%DUMPFILE%"
if errorlevel 1 (
    echo Backup FAILED
    del "%DUMPFILE%" 2>nul
    goto :eof
)
echo Wrote %DUMPFILE%
goto :eof

:restore
set "DUMPFILE=%~2"
if not "%DUMPFILE%"=="" goto :restorecheck
for /f "delims=" %%f in ('dir /b /o-d "backups\*.sql" 2^>nul') do (
    if not defined DUMPFILE set "DUMPFILE=backups\%%f"
)
if not defined DUMPFILE goto :nobackup
:restorecheck
if not exist "%DUMPFILE%" goto :nobackup
echo Restoring %DUMPFILE% into nexivo on nexivo_db ...
docker exec -i nexivo_db psql -v ON_ERROR_STOP=1 -U nexivo_user -d nexivo < "%DUMPFILE%"
if errorlevel 1 (
    echo Restore FAILED
    goto :eof
)
echo Restore complete.
goto :eof

:nobackup
echo No backup found. Run 'dev.bat dump' first, or: dev.bat restore backups\FILE.sql
goto :eof

:testbackend
echo Running Django checks...
cd backend && %MANAGE% check
goto :eof

:testfrontend
echo Running TypeScript typecheck...
cd frontend && npx tsc --noEmit
goto :eof
