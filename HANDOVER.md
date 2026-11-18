# SkillSense AI: handover

A skill assessment, resume analysis, placement intelligence and coding practice platform for students, with admin tools. React 18 + Vite (JavaScript) frontend, FastAPI + MongoDB (Motor) backend. The "AI" is rule-based scoring and TF-IDF similarity; there are no LLM calls. It is a demo / campus-pilot project.

Read `README.md` first (set-up, environment variables, tests). `CLAUDE.md` holds the working rules and the detailed design notes per feature. `SECURITY_AUDIT.md` lists the security controls that must not be weakened.

## Start it (Windows)

```bash
npm run backend      # backend on 127.0.0.1:8000 (uses backend\.venv, never backend\python_bin)
npm run dev          # frontend on http://localhost:5173
```

First time on a computer: `setup_new_computer.bat`, then fill in `backend/.env` (JWT secret, MongoDB Atlas URL) from `backend/.env.example`. Load the starter content once: `cd backend` then `.venv\Scripts\python.exe -m app.seed`. Create the admin with `python -m app.create_admin` (hidden prompts). The admin login is a demo login: do not change or rotate it as part of other work.

## Where things are

| Area | Frontend | Backend |
|---|---|---|
| Pages and shared UI | `src/pages`, `src/components`, theme in `src/theme` + `src/index.css` | `app/routers` (HTTP), `app/services` (logic), `app/repositories` (MongoDB), `app/models` (Pydantic) |
| Practice Arena (function-style judge) | `src/pages/CodingPracticePage.jsx`, `src/components/practice` | `routers/practice.py`, `services/function_judge.py`, `judge_drivers.py`, `data/coding_problems.py` |
| Daily challenge, streaks, badges | `components/practice/DailyChallengeCard.jsx`, `AchievementsPanel.jsx` | `services/daily_challenge_service.py` (the day rules are written at its top) |
| My submissions | `src/pages/MySubmissionsPage.jsx` | `routers/practice.py` (`/practice/submissions`) |
| Admin Analytics and CSV exports | `src/pages/admin/AdminAnalyticsPage.jsx`, `components/admin/AnalyticsCharts.jsx` | `routers/admin.py`, `services/admin_analytics_service.py` |
| Readiness score | dashboard | `services/readiness_service.py` (the only place it is calculated) |
| Dark and light mode | `src/theme`, `src/context/ThemeContext.jsx`, tokens in `src/index.css` | none (stored in the browser only) |

## Demo data (so the admin pages have something to show)

```bash
cd backend
.venv\Scripts\python.exe scripts\seed_demo_data.py --yes            # about 25 fake students and their activity over 30 days
.venv\Scripts\python.exe scripts\seed_demo_data.py --yes --reset    # removes ONLY the demo-flagged records
```

Demo records carry `demo: true`; the students use `demo01@example.test`-style addresses and have no password, so nobody can sign in as one. The script needs `--yes` and refuses in production. Running it twice does not duplicate anything.

## Tests

| What | Command |
|---|---|
| Backend | `npm run test:api` (or `backend\.venv\Scripts\python.exe -m pytest backend/tests`); the 20 Docker tests are opt-in |
| Frontend unit tests | `npm test` |
| UI audit, both themes, 3 widths | `npm run test:ui` |
| Browser proofs (headed Chrome, real Atlas, each deletes what it creates) | `npx playwright test -c e2e/playwright.config.js <name>`; for example `p13-theme`, `p14-improvements`, `p11-arena`, `p12-roadmap3d` |
| Real-database smoke test | `cd backend` then `.venv\Scripts\python.exe scripts\smoke_test.py` |

`p9-admin` and the admin steps of other proofs need a real admin account in `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD`; without them the proofs use a stubbed admin session and say so.

## Deploying

`docs/DEPLOY.md` (free tiers: Atlas, Render or Railway, Vercel or Netlify). Before a deploy run `backend\.venv\Scripts\python.exe backend\scripts\check_production_env.py --env-file <copy of the production env>`: it reports unsafe settings without printing any value. Key rule: keep `VITE_API_BASE_URL=/api` and let the frontend host proxy `/api` to the backend, because the refresh cookie is `SameSite=Lax`.

## Rules of the house

- Never print or log a secret, connection string or token. Never hard-code a colour (use theme tokens), a credential, demo metrics or fallback mock data.
- Every protected route uses `require_student` or `require_admin`; never trust a client-sent role. Every request-model field needs a length cap.
- Keep API response shapes stable: add fields, do not rename or remove.
- One layout breakpoint: 768px.
- Ask before deleting files or folders. Run the tests after each change.

## Known limits

The online code runner is a free shared service (needs internet, can be slow). OCR needs a pip package. Rate limiting is in-process (one backend process). The streak and daily challenge use UTC days for the challenge and the student's saved UTC offset for streak days. See "Known limitations" in `README.md`.
