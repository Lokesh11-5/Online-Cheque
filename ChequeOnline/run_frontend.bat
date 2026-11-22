@echo off
echo ========================================================
echo Starting ChequeMates Frontend Server (HTTP Port 3000)
echo ========================================================
cd frontend
python -m http.server 3000
pause
