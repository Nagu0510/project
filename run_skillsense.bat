@echo off
title SkillSense AI Launcher
echo ========================================================
echo  SkillSense AI Platform - Starting Backend and Frontend
echo ========================================================
echo.

if not exist ".\backend\.venv\Scripts\python.exe" (
  echo ERROR: backend\.venv is missing. Run once:
  echo   cd backend
  echo   python -m venv .venv
  echo   .venv\Scripts\activate
  echo   pip install -r requirements.txt
  pause
  exit /b 1
)

echo Checking backend setup ...
pushd backend
.\.venv\Scripts\python.exe -m app.startup_check
set CHECK=%errorlevel%
popd
if not "%CHECK%"=="0" (
  echo.
  echo Fix the problem above, then run this file again.
  pause
  exit /b 1
)
echo.

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "SkillSense Backend (FastAPI)" cmd /k ".\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Vite Frontend on http://localhost:5173 ...
start "SkillSense Frontend (Vite)" cmd /k "npm run dev"

echo.
echo ========================================================
echo  SkillSense AI is running!
echo  Frontend: http://localhost:5173
echo  Backend:  http://127.0.0.1:8000
echo  API Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
