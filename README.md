# SkillSense AI

Skill assessment, resume analysis, placement intelligence and coding practice for students, with admin tools for question papers and placements. React + Vite frontend, FastAPI + MongoDB backend. The "AI" is rule-based scoring and TF-IDF similarity (no LLM calls).

## Quick start (local development)

Prerequisites: Node 18+, Python 3.11, a MongoDB database (local or Atlas).

```bash
# backend (from backend/)
python -m venv .venv
.venv\Scriptsctivate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env             # then set MONGODB_URL and JWT_SECRET_KEY
python -m app.seed                 # load starter content (idempotent)
uvicorn app.main:app --reload --port 8000

# frontend (from the repo root)
npm install
npm run dev
```

Check the database connection any time with `python scripts/check_db.py` (from `backend/`).

## Running student code (practice arena)

**No Docker and no compilers are needed. The practice arena needs internet.** Code runs on an online compiler API that only the backend calls (C, C++, Java, JavaScript, Python). The default is `SANDBOX_MODE=online` with the free public [Judge0 CE](https://ce.judge0.com) instance, which needs no sign-up and no key:

```env
# backend/.env
SANDBOX_MODE=online
CODE_PROVIDER=judge0_ce
```

| `CODE_PROVIDER` | What it is | Extra `.env` lines |
|---|---|---|
| `judge0_ce` (default) | Free public Judge0 CE | none |
| `judge0_rapidapi` | Judge0 CE on RapidAPI (higher limits) | `CODE_API_KEY=<your RapidAPI key>` (sign up at rapidapi.com, subscribe to "Judge0 CE") |
| `judge0` | Your own Judge0 server | `CODE_API_URL=https://your-server`, optional `CODE_API_KEY` |
| `piston` | Piston (the public emkc.org instance is whitelist-only since 2026-02-15, so use your own) | `CODE_API_URL=https://your-piston/api/v2/piston`, optional `CODE_API_KEY` |

Restart the backend after changing these. The provider URL and key stay on the server; the browser only calls `/practice/code/run` and `/practice/code/submit`. Only the source code, the language and the stdin are sent to the provider (no user data, no environment variables).

Limits: login required, 10 runs or submissions per minute per student, 20 KB of source, 64 KB of output, 15 seconds per provider request. Java programs must use `public class Main`. A submit judges up to 5 test cases and stops at the first failure ("Wrong Answer on test case N"). If the provider is slow, down or rate limiting, you get "Online compiler is busy, try again in a moment." (503/429). That is never shown as a wrong answer.

Check the provider any time (about 20 requests): `python scripts/check_online_compiler.py` from `backend/`.

Public instances are shared and can be slow or rate limited; for heavier use switch to `judge0_rapidapi` or your own server.

**Other modes, kept in the code but not the default**
- `SANDBOX_MODE=subprocess`: runs code on your own machine (needs Python, Node, a JDK, `gcc`/`g++`). Empty environment, temp dir, time/memory/process limits. It is **not a security boundary**: the program can still read files by absolute path and open network connections. Only run your own code.
- `SANDBOX_MODE=docker`: one throw-away container per run (no network, read-only filesystem, 128 MB, 0.5 CPU). Needs Docker running and `docker pull python:3.11-alpine node:20-alpine eclipse-temurin:17-jdk-alpine gcc:13`.

## Tests

```bash
pytest backend/tests          # backend (Docker-only tests skip themselves when Docker is absent)
npm run build                 # frontend build
npm run e2e:p3b               # headed Chrome: every language, correct + wrong submit (online compiler, needs internet)
```

Project rules and conventions are in `CLAUDE.md`.
