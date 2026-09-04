@echo off
title SkillSense AI Launcher
echo ========================================================
echo  SkillSense AI Platform — Starting Backend and Frontend
echo ========================================================
echo.

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "SkillSense Backend (FastAPI)" cmd /k ".\backend\python_bin\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

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
