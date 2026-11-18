@echo off
setlocal
title SkillSense AI (dev)
cd /d "%~dp0"
echo ========================================================
echo  SkillSense AI - dev run (backend + frontend)
echo ========================================================
echo.

if not exist "backend\.venv\Scripts\python.exe" (
  echo ERROR: backend\.venv is missing. On a new computer run setup_new_computer.bat first.
  pause
  exit /b 1
)
if not exist "backend\.env" (
  echo ERROR: backend\.env is missing. Run setup_new_computer.bat, then fill in MONGODB_URL and JWT_SECRET_KEY.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo ERROR: node_modules is missing. Run setup_new_computer.bat, or: npm install
  pause
  exit /b 1
)

echo Checking the database connection ...
pushd backend
.\.venv\Scripts\python.exe scripts\check_db.py
set CHECK=%errorlevel%
popd
if not "%CHECK%"=="0" (
  echo.
  echo The database check failed. Fix backend\.env ^(MONGODB_URL^) and the Atlas IP allow-list, then run this again.
  pause
  exit /b 1
)
echo.

echo [1/2] Starting the backend on http://127.0.0.1:8000 ...
start "SkillSense Backend (FastAPI)" cmd /k ".\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
timeout /t 2 /nobreak >nul

echo [2/2] Starting the frontend on http://localhost:5173 ...
start "SkillSense Frontend (Vite)" cmd /k "npm run dev"

echo.
echo ========================================================
echo  Frontend: http://localhost:5173
echo  Backend:  http://127.0.0.1:8000   (API docs: /docs, development only)
echo  Close the two new windows to stop the app.
echo ========================================================
pause
