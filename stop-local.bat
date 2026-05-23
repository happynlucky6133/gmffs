@echo off
setlocal

echo Stopping FreshStack PostgreSQL...
C:\tmp\pgsql\bin\pg_ctl.exe -D C:\tmp\freshstack-pgdata stop

echo.
echo If the dev server is still running, close its terminal or press Ctrl+C.
