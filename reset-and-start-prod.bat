@echo off
echo ========================================================
echo WARNING: RESETTING RESTAURANT MANAGEMENT SYSTEM
echo ========================================================
echo This will DELETE all your database data and reset the system!
echo If you do not want to lose your data, close this window NOW.
echo.
pause
echo.
echo Deleting database...
docker compose down -v
echo.
echo Starting fresh production environment...
docker compose -f docker-compose.prod.yml up -d --build
echo.
echo ========================================================
echo SUCCESS! The database has been wiped and the app is restarting.
echo You can safely close this window.
echo ========================================================
pause
