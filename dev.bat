@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem  Kerman Khodro Travel - Local Development (Windows)
rem  Usage: dev.bat [command]   (run "dev.bat help" for the list)
rem ============================================================

set "ROOT=%~dp0"
set "PYTHON=%ROOT%.venv\Scripts\python.exe"
if not exist "%PYTHON%" set "PYTHON=python"
set "NPM=npm"

set "DB_CONTAINER=nexivo_db"
set "REDIS_CONTAINER=nexivo_redis"
set "DB_NAME=kermankhodro"
set "DB_USER=nexivo_user"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=3000"

if "%~1"=="" goto help
if /i "%~1"=="help" goto help
if /i "%~1"=="install" goto install
if /i "%~1"=="setup" goto setup
if /i "%~1"=="migrate" goto migrate
if /i "%~1"=="seed" goto seed
if /i "%~1"=="start-db" goto startdb
if /i "%~1"=="start-redis" goto startredis
if /i "%~1"=="start-services" goto startservices
if /i "%~1"=="backend" goto backend
if /i "%~1"=="frontend" goto frontend
if /i "%~1"=="dev" goto dev
if /i "%~1"=="stop" goto stop
if /i "%~1"=="status" goto status
if /i "%~1"=="dump" goto dump
if /i "%~1"=="restore" goto restore
if /i "%~1"=="test-backend" goto testbackend
if /i "%~1"=="test-frontend" goto testfrontend

echo Unknown command: %~1
goto help

:help
echo.
echo   Kerman Khodro Travel - Local Development (Windows)
echo   ==================================================
echo.
echo   dev.bat dev            Start DB + Redis, migrate, then open backend and frontend
echo   dev.bat backend        Start Django backend only (port %BACKEND_PORT%)
echo   dev.bat frontend       Start Vite frontend only (port %FRONTEND_PORT%)
echo   dev.bat start-services Start PostgreSQL and Redis containers
echo   dev.bat status         Show container and port status
echo   dev.bat stop           Stop containers (data is kept)
echo.
echo   dev.bat setup          First-time setup (venv, deps, .env, migrate, seed)
echo   dev.bat install        Install backend and frontend dependencies
echo   dev.bat migrate        Run database migrations
echo   dev.bat seed           Create admin user and default data
echo.
echo   dev.bat dump           Snapshot database to backups\kkt_TIMESTAMP.sql
echo   dev.bat restore [file] Restore a snapshot (default: newest in backups\)
echo   dev.bat test-backend   Run Django system checks
echo   dev.bat test-frontend  Run TypeScript typecheck
echo.
goto :eof

:install
echo [1/2] Installing backend dependencies...
pushd "%ROOT%backend"
"%PYTHON%" -m pip install -r requirements.txt
popd
echo [2/2] Installing frontend dependencies...
pushd "%ROOT%frontend"
call %NPM% install
popd
goto :eof

:setup
echo.
echo ===========================================
echo   Kerman Khodro Travel - First-Time Setup
echo ===========================================
if not exist "%ROOT%.venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv "%ROOT%.venv"
    set "PYTHON=%ROOT%.venv\Scripts\python.exe"
)
call :install
if not exist "%ROOT%backend\.env" (
    copy "%ROOT%.env.example" "%ROOT%backend\.env" >nul
    echo Created backend\.env from .env.example - review the values before running.
) else (
    echo backend\.env already exists, skipping.
)
call :migrate
call :seed
echo.
echo Setup complete. Run "dev.bat dev".
goto :eof

:migrate
echo Running migrations...
pushd "%ROOT%backend"
"%PYTHON%" manage.py migrate --noinput
popd
goto :eof

:seed
echo Seeding admin user and default data...
pushd "%ROOT%backend"
"%PYTHON%" manage.py seed_kkt
popd
goto :eof

:startdb
echo Starting PostgreSQL (%DB_CONTAINER%)...
docker start %DB_CONTAINER% >nul 2>&1
if errorlevel 1 (
    docker run -d --name %DB_CONTAINER% -e POSTGRES_DB=%DB_NAME% -e POSTGRES_USER=%DB_USER% -e POSTGRES_PASSWORD=nexivo_pass -p 5544:5432 postgres:15
)
goto :eof

:startredis
echo Starting Redis (%REDIS_CONTAINER%)...
docker start %REDIS_CONTAINER% >nul 2>&1
if errorlevel 1 (
    docker run -d --name %REDIS_CONTAINER% -p 6379:6379 redis:7-alpine
)
goto :eof

:waitdb
echo Waiting for PostgreSQL to accept connections...
set /a WAITED=0
:waitdbloop
docker exec %DB_CONTAINER% pg_isready -U %DB_USER% -d %DB_NAME% >nul 2>&1
if not errorlevel 1 goto :eof
set /a WAITED+=1
if %WAITED% GEQ 30 (
    echo WARNING: PostgreSQL did not become ready in 30 seconds. Check "docker logs %DB_CONTAINER%".
    goto :eof
)
timeout /t 1 /nobreak >nul
goto waitdbloop

:startservices
call :startdb
call :startredis
call :waitdb
echo Services are ready.
goto :eof

:checkports
netstat -ano | findstr /r /c:":%BACKEND_PORT% .*LISTENING" >nul && echo WARNING: port %BACKEND_PORT% is already in use.
netstat -ano | findstr /r /c:":%FRONTEND_PORT% .*LISTENING" >nul && echo WARNING: port %FRONTEND_PORT% is already in use.
goto :eof

:backend
call :checkports
echo Starting Django backend on http://0.0.0.0:%BACKEND_PORT% ...
pushd "%ROOT%backend"
"%PYTHON%" manage.py runserver 0.0.0.0:%BACKEND_PORT%
popd
goto :eof

:frontend
call :checkports
echo Starting Vite frontend on http://0.0.0.0:%FRONTEND_PORT% ...
pushd "%ROOT%frontend"
call %NPM% run dev -- --host 0.0.0.0 --port %FRONTEND_PORT%
popd
goto :eof

:dev
call :startservices
call :migrate
call :checkports
set "LANIPS="
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPConfiguration).Where({ $_.IPv4DefaultGateway -ne $null }).ForEach({ $_.IPv4Address.IPAddress })"') do (
    echo %%i | findstr /b /c:"127." /c:"169.254." >/dev/null || set "LANIPS=!LANIPS! http://%%i:%FRONTEND_PORT%/"
)
echo.
echo ===========================================
echo   Kerman Khodro Travel - Development
echo ===========================================
echo   Backend:   http://localhost:%BACKEND_PORT%
echo   Frontend:  http://localhost:%FRONTEND_PORT%
if defined LANIPS echo   Network:  %LANIPS%
echo   Login:     admin / admin12345
echo ===========================================
echo.
echo Opening backend and frontend in separate windows...
start "KKT Backend (:%BACKEND_PORT%)" /D "%ROOT%backend" "%PYTHON%" manage.py runserver 0.0.0.0:%BACKEND_PORT%
start "KKT Frontend (:%FRONTEND_PORT%)" /D "%ROOT%frontend" cmd /k "%NPM% run dev -- --host 0.0.0.0 --port %FRONTEND_PORT%"
echo Both servers are starting. Close their windows to stop them.
goto :eof

:status
echo --- Containers ---
docker ps -a --filter name=%DB_CONTAINER% --filter name=%REDIS_CONTAINER% --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo --- Listening ports ---
netstat -ano | findstr /r /c:":%BACKEND_PORT% .*LISTENING" /c:":%FRONTEND_PORT% .*LISTENING"
goto :eof

:stop
echo Stopping containers (data is kept)...
docker stop %DB_CONTAINER% %REDIS_CONTAINER% >nul 2>&1
echo Done.
goto :eof

:dump
if not exist "%ROOT%backups" mkdir "%ROOT%backups"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%i"
set "DUMPFILE=%ROOT%backups\kkt_%STAMP%.sql"
echo Dumping database %DB_NAME% to %DUMPFILE% ...
docker exec %DB_CONTAINER% pg_dump -U %DB_USER% -d %DB_NAME% --clean --if-exists --no-owner > "%DUMPFILE%"
if errorlevel 1 (
    echo Backup FAILED
    del "%DUMPFILE%" 2>nul
    goto :eof
)
echo Wrote %DUMPFILE%
goto :eof

:restore
set "DUMPFILE=%~2"
if not "%DUMPFILE%"=="" goto restorecheck
for /f "delims=" %%f in ('dir /b /o-d "%ROOT%backups\*.sql" 2^>nul') do (
    if not defined DUMPFILE set "DUMPFILE=%ROOT%backups\%%f"
)
if not defined DUMPFILE goto nobackup
:restorecheck
if not exist "%DUMPFILE%" goto nobackup
echo Restoring %DUMPFILE% into %DB_NAME% ...
docker exec -i %DB_CONTAINER% psql -v ON_ERROR_STOP=1 -U %DB_USER% -d %DB_NAME% < "%DUMPFILE%"
if errorlevel 1 (
    echo Restore FAILED
    goto :eof
)
echo Restore complete.
goto :eof

:nobackup
echo No backup found. Run "dev.bat dump" first, or: dev.bat restore backups\FILE.sql
goto :eof

:testbackend
echo Running Django checks...
pushd "%ROOT%backend"
"%PYTHON%" manage.py check
popd
goto :eof

:testfrontend
echo Running TypeScript typecheck...
pushd "%ROOT%frontend"
call npx tsc --noEmit
popd
goto :eof
