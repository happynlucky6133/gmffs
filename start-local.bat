@echo off
setlocal

cd /d "%~dp0"
if not exist ".local" mkdir ".local"

echo Checking PostgreSQL on port 5432...
netstat -ano | findstr ":5432" >nul
if errorlevel 1 (
  echo Starting FreshStack PostgreSQL...
  C:\tmp\pgsql\bin\pg_ctl.exe -D C:\tmp\freshstack-pgdata -l "%~dp0.local\freshstack-postgres.log" start
) else (
  echo PostgreSQL is already running.
)

echo.
echo Starting FreshStack Fulfillment...
npm run dev
