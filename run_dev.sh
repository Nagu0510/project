#!/usr/bin/env bash
# SkillSense AI: start the backend and the frontend (macOS / Linux).  Usage: bash run_dev.sh
set -u
cd "$(dirname "$0")"

PY="backend/.venv/bin/python"

echo "========================================================"
echo " SkillSense AI - dev run (backend + frontend)"
echo "========================================================"

if [ ! -x "$PY" ]; then
  echo "ERROR: backend/.venv is missing. On a new computer run: bash setup_new_computer.sh"
  exit 1
fi
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env is missing. Run setup_new_computer.sh, then fill in MONGODB_URL and JWT_SECRET_KEY."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "ERROR: node_modules is missing. Run setup_new_computer.sh, or: npm install"
  exit 1
fi

echo "Checking the database connection ..."
if ! (cd backend && ../"$PY" scripts/check_db.py); then
  echo
  echo "The database check failed. Fix backend/.env (MONGODB_URL) and the Atlas IP allow-list, then run this again."
  exit 1
fi
echo

echo "[1/2] Starting the backend on http://127.0.0.1:8000 ..."
"$PY" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null' EXIT INT TERM
sleep 2

echo "[2/2] Starting the frontend on http://localhost:5173 ..."
echo
echo "========================================================"
echo " Frontend: http://localhost:5173"
echo " Backend:  http://127.0.0.1:8000   (API docs: /docs, development only)"
echo " Press Ctrl+C to stop both."
echo "========================================================"
npm run dev
