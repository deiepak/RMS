@echo off
echo ========================================================
echo Starting Restaurant Management System (PRODUCTION MODE)
echo ========================================================
echo.
echo Building and starting the containers...
docker compose -f docker-compose.prod.yml up -d --build
echo.
echo ========================================================
echo SUCCESS! The application is running in production mode.
echo You can safely close this window.
echo ========================================================
pause
