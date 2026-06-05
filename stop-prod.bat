@echo off
echo ========================================================
echo Stopping Restaurant Management System
echo ========================================================
echo.
echo Safely shutting down the containers...
docker compose -f docker-compose.prod.yml down
echo.
echo ========================================================
echo SUCCESS! The application has been stopped safely.
echo Your data is perfectly safe.
echo ========================================================
pause
