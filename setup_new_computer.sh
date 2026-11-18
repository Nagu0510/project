#!/usr/bin/env bash
# SkillSense AI: set up a new computer (macOS / Linux).  Usage: bash setup_new_computer.sh
# Needs only Python 3.11 or 3.12 and Node.js 20 or newer.
set -eu
cd "$(dirname "$0")"

echo "========================================================"
echo " SkillSense AI - setup on a new computer"
echo " Needs: Python 3.11 or 3.12 and Node.js 20 or newer"
echo "========================================================"

PYTHON=""
for candidate in python3.11 python3.12 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] < (3, 13) else 1)' 2>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python 3.11 or 3.12 was not found. Install it from https://www.python.org/downloads/"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/"
  exit 1
fi
if ! node -e 'process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)'; then
  echo "ERROR: this needs Node.js 20 or newer. You have: $(node --version)"
  exit 1
fi

echo "[1/4] Creating backend/.venv ..."
if [ ! -x backend/.venv/bin/python ]; then
  "$PYTHON" -m venv backend/.venv
else
  echo "      already there, keeping it."
fi

echo "[2/4] Installing the backend packages (a few minutes the first time) ..."
backend/.venv/bin/python -m pip install --upgrade pip >/dev/null
backend/.venv/bin/python -m pip install -r backend/requirements.txt

echo "[3/4] Installing the frontend packages ..."
npm install

echo "[4/4] Creating the settings files (only if they do not exist) ..."
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env && echo "      created backend/.env"; else echo "      backend/.env already exists, not touched."; fi
if [ ! -f .env ]; then cp .env.example .env && echo "      created .env"; else echo "      .env already exists, not touched."; fi

cat <<'EOF'

========================================================
 Setup finished. Now fill in these values (names only):

 backend/.env   MONGODB_URL        your MongoDB Atlas connection string
                JWT_SECRET_KEY     a random secret of 32+ characters:
                   backend/.venv/bin/python -c "import secrets;print(secrets.token_urlsafe(64))"
                optional: GOOGLE_CLIENT_ID, EMAIL_ENABLED, SMTP_USER, SMTP_APP_PASSWORD, EMAIL_FROM
 .env           optional: VITE_GOOGLE_CLIENT_ID (same value as GOOGLE_CLIENT_ID)

 Then:
   1. Load the starter content once:   (cd backend && .venv/bin/python -m app.seed)
   2. Create an admin account:         (cd backend && .venv/bin/python -m app.create_admin)
   3. Start the app:                   bash run_dev.sh
 The app opens at http://localhost:5173
========================================================
EOF
