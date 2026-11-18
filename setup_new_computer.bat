@echo off
setlocal
title SkillSense AI setup
cd /d "%~dp0"
echo ========================================================
echo  SkillSense AI - setup on a new computer
echo  Needs: Python 3.11 and Node.js 20 or newer (nothing else)
echo ========================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python was not found. Install Python 3.11 from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
  pause
  exit /b 1
)
python -c "import sys; sys.exit(0 if (3,11) <= sys.version_info[:2] < (3,13) else 1)"
if errorlevel 1 (
  echo ERROR: this needs Python 3.11 or 3.12. You have:
  python --version
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)
node -e "process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo ERROR: this needs Node.js 20 or newer. You have:
  node --version
  pause
  exit /b 1
)

echo [1/4] Creating backend\.venv ...
if not exist "backend\.venv\Scripts\python.exe" (
  python -m venv backend\.venv
  if errorlevel 1 ( echo ERROR: could not create the virtual environment. & pause & exit /b 1 )
) else (
  echo       already there, keeping it.
)

echo [2/4] Installing the backend packages ^(a few minutes the first time^) ...
backend\.venv\Scripts\python.exe -m pip install --upgrade pip >nul
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 ( echo ERROR: pip install failed. Read the message above. & pause & exit /b 1 )

echo [3/4] Installing the frontend packages ...
call npm install
if errorlevel 1 ( echo ERROR: npm install failed. Read the message above. & pause & exit /b 1 )

echo [4/4] Creating the settings files ^(only if they do not exist^) ...
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo       created backend\.env
) else (
  echo       backend\.env already exists, not touched.
)
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo       created .env
) else (
  echo       .env already exists, not touched.
)

echo.
echo ========================================================
echo  Setup finished. Now fill in these values ^(names only^):
echo.
echo  backend\.env   MONGODB_URL        your MongoDB Atlas connection string
echo                 JWT_SECRET_KEY     a random secret of 32+ characters:
echo                    backend\.venv\Scripts\python.exe -c "import secrets;print(secrets.token_urlsafe(64))"
echo                 optional: GOOGLE_CLIENT_ID, EMAIL_ENABLED, SMTP_USER, SMTP_APP_PASSWORD, EMAIL_FROM
echo  .env           optional: VITE_GOOGLE_CLIENT_ID ^(same value as GOOGLE_CLIENT_ID^)
echo.
echo  Then:
echo    1. Load the starter content once:   cd backend ^& .venv\Scripts\python.exe -m app.seed
echo    2. Create an admin account:         .venv\Scripts\python.exe -m app.create_admin
echo    3. Start the app:                   run_dev.bat   ^(from the project folder^)
echo  The app opens at http://localhost:5173
echo ========================================================
pause
