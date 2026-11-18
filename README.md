# SkillSense AI

SkillSense AI helps students find out where they stand and what to do next. A student takes timed skill assessments, practises coding problems, analyses a resume, follows a roadmap with matching courses, sees placement opportunities with their real eligibility, and gets notified when something relevant happens. Admins upload previous placement papers, review the extracted questions, manage placements, courses, questions and career paths, and watch student progress.

- **Frontend:** React 18 + Vite (JavaScript), react-router-dom v6, framer-motion, three.js
- **Backend:** FastAPI + MongoDB (`motor`), JWT sign-in, bcrypt, slowapi rate limiting
- **"AI":** rule-based scoring and TF-IDF text similarity (scikit-learn). There are no LLM calls. See [How the "AI" works](#how-the-ai-works-honestly).

## Prerequisites

| You need | Version | Notes |
|---|---|---|
| Python | **3.11** (3.12 should work; developed and tested on 3.11.9) | with `venv` and `pip` |
| Node.js | **20 or newer** (developed and tested on 24) | includes `npm` |
| MongoDB | Atlas (free tier is fine) or a local MongoDB | see [MongoDB Atlas](#mongodb-atlas) |
| Internet | for the code runner, Google sign-in and Atlas | |

Nothing else is needed: no Docker, no C/C++/Java compilers, no Tesseract.

## Set up on a new computer

1. Install Python and Node.js (links above) and unzip or clone the project.
2. Run the setup script once. It creates `backend/.venv`, installs the backend and frontend packages, and copies `backend/.env.example` to `backend/.env` and `.env.example` to `.env` **only if those files do not exist**:
   - Windows: double-click `setup_new_computer.bat`
   - macOS / Linux: `bash setup_new_computer.sh`
3. Open `backend/.env` and fill in the two required values (the script prints them):
   - `MONGODB_URL`: your Atlas connection string
   - `JWT_SECRET_KEY`: a random secret of 32+ characters. Generate one with `backend\.venv\Scripts\python.exe -c "import secrets;print(secrets.token_urlsafe(64))"` (macOS/Linux: `backend/.venv/bin/python -c ...`)
4. Load the starter content once (safe to repeat): from `backend/`, `.venv\Scripts\python.exe -m app.seed`
5. Create an admin account (see [Creating an admin](#creating-an-admin)).
6. Start the app:
   - Windows: `run_dev.bat` (or `run_skillsense.bat`)
   - macOS / Linux: `bash run_dev.sh`

   Open **http://localhost:5173**. The backend runs on http://127.0.0.1:8000 (API docs at `/docs` in development only).

`run_dev.*` checks the virtual environment and the database connection (`backend/scripts/check_db.py`) before starting. `run_skillsense.bat` does the same with the packaged startup check. Always use `backend\.venv`; never `backend\python_bin` (it lacks the packages, so every `/api` call fails).

### Sharing the project with someone else

`powershell -ExecutionPolicy Bypass -File .\make_share_zip.ps1` builds `skillsense-ai-share-<date>.zip` next to the project folder. It contains **no `.env` files and no secrets** (it also scans for connection strings and keys and refuses to zip if it finds one), and leaves out `backend/.venv`, `node_modules`, `dist`, `e2e/screenshots`, caches and `backend/python_bin`. The other person runs `setup_new_computer.bat` and fills in their own `backend/.env`.

## MongoDB Atlas

1. Create a free account and a **free (M0) cluster** at https://www.mongodb.com/cloud/atlas.
2. **Database Access** → add a database user with a password (a read/write role on any database is enough). Use a password without `@`, `:` or `/`, or URL-encode it.
3. **Network Access** → **Add IP Address**. Add your current IP (or `0.0.0.0/0` for a quick test only; remove it afterwards). Atlas refuses connections from addresses that are not listed; this is the most common reason the app cannot start.
4. **Connect** → **Drivers** → copy the `mongodb+srv://...` string, replace `<password>`, and put it in `backend/.env` as `MONGODB_URL`.
5. Check it: from `backend/`, `.venv\Scripts\python.exe scripts\check_db.py` prints `OK` and the collection names (never the connection string).

## Google sign-in (optional)

Without it the "Continue with Google" button is hidden and email/password sign-in still works.

1. Google Cloud Console → **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID** → type **Web application**.
2. **Authorized JavaScript origins**: add `http://localhost:5173` **and** `http://127.0.0.1:5173` (and your real domain when you deploy). No redirect URI is needed.
3. Copy the client ID into `GOOGLE_CLIENT_ID` in `backend/.env` **and** `VITE_GOOGLE_CLIENT_ID` in `.env` (the same value; it is not a secret). Restart both servers.

## Email with Gmail (optional)

Email is used for address verification, password reset and (if a student opts in) placement alerts. It is **off** by default (`EMAIL_ENABLED=false`): nothing is sent, the message type is logged and, in development only, the link is printed in the backend console.

1. Turn on 2-Step Verification for the Google account, then create an **App Password** at https://myaccount.google.com/apppasswords (16 characters).
2. In `backend/.env`: `EMAIL_ENABLED=true`, `SMTP_USER=you@gmail.com`, `SMTP_APP_PASSWORD=<the 16 characters>`, `EMAIL_FROM=you@gmail.com`. Restart the backend. The app refuses to start if `EMAIL_ENABLED=true` without both values.
3. Placement emails are only sent to a **verified** address **and** only if the student turned on "email notifications" in Settings (off by default). Every one carries a one-click unsubscribe link.

## OCR engine for resumes and scanned papers

Scanned PDFs and photos are read with OCR (`OCR_ENGINE` in `backend/.env`):

- `rapidocr` (default): a pip package installed by `requirements.txt`. No extra program needed.
- `tesseract`: needs the Tesseract program installed on the computer plus `pip install pytesseract`.

If the chosen engine cannot load, the other is tried. If neither loads, text-based files still work and only scans and photos answer `503 OCR engine unavailable`. OCR can make mistakes (see limitations); the resume page lets the student correct the text and re-score it.

## Practice Arena (coding practice) and the online code runner

The Practice Arena is a function-style coding workspace: the student sees the problem statement, examples, constraints and a function stub, writes the function, **Run** tries it on the examples (and on custom cases), **Submit** judges every hidden test. It is laid out like the well-known coding-practice sites (list, two resizable panes, code editor, console) but it is its own design: own colours, own name, original problems.

- **12 original problems** (4 easy, 5 medium, 3 hard) in Python, JavaScript, Java, C++ and C. Starter code is generated from the function signature and never contains a solution or a hint. C is only offered when the problem uses numbers, booleans, text and integer arrays.
- **Editor**: CodeMirror 6 (bundled, no CDN), line numbers, syntax highlighting, bracket matching, auto-indent, Tab inserts spaces, `Ctrl+Enter` runs, `Ctrl+Shift+Enter` submits, font and tab size settings, "Reset to starter code" (asks first), code remembered per problem and language, error lines marked.
- **Results**: Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded (every case has a time limit; a slow solution fails on the large hidden case), Compile Error (with your own line numbers), Output Limit Exceeded, and *Judge unavailable* when the provider fails (never a Wrong Answer, nothing is saved). A hidden test that fails shows only its number: no input, no expected output, nothing your program printed for it. A function that returns nothing is a failed case.
- **Hints** come one at a time and never give the answer; **Submissions** lists your last 20 attempts with "Load this code".

The code runs on an **online compiler API called only from the backend**. **It needs internet.** The default is the free public Judge0 CE instance (`CODE_PROVIDER=judge0_ce`), which needs no key. Only the source code, the language and the test inputs are sent. The browser never talks to the provider. If the provider is slow, busy or down the student sees a clear message (HTTP 503/429 or the verdict *Judge unavailable*).

Honest limits: the free shared instance can be slow or busy, and all the cases of one Run or Submit share one execution (10 s CPU, 15 s wall); at most 10 runs or submissions per minute per student; C is limited to simple types; JavaScript numbers are exact only up to 2^53 (so `long` test values stay below that); the "Running case n of N" counter only paces the wait; a student could tamper with the verdict of their own attempt from inside their own program, so this is a practice tool, not an exam proctor.

Other providers: `judge0_rapidapi` (set `CODE_API_KEY`), `judge0` or `piston` (your own server, set `CODE_API_URL`). `SANDBOX_MODE=subprocess` (development only, not a security boundary) and `docker` (real isolation) exist as alternatives.

Checking a problem against the real provider (needs internet, prints pass/fail tables): `cd backend` then `.venv\Scripts\python.exe scripts\check_reference_solutions.py --slow --sweep --starters` (reference solutions in all languages, a slow brute force per medium and hard problem that must end in Time Limit Exceeded, every supported type round-tripped in every language, every generated starter).

## Environment variables

All names live in `backend/.env.example` and `.env.example` with comments and placeholders. Copy them, never commit the copies.

**Backend (`backend/.env`)**

| Variable | Default | What it does |
|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017` | **Required in practice.** Atlas or local connection string |
| `JWT_SECRET_KEY` | none | **Required.** 32+ random characters; the app refuses to start without it |
| `ENV` | `development` | `development`, `test` or `production` (production turns off `/docs`, narrows CORS, forbids demo accounts and the in-memory fallback) |
| `PROJECT_NAME`, `API_V1_STR` | `SkillSense AI`, `/api` | Title and API prefix |
| `DATABASE_NAME` | `skillsense_ai` | Database name |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin and the base of links in emails |
| `SIMILARITY_THRESHOLD` | `0.80` | TF-IDF similarity needed for "asked before" |
| `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | `HS256`, `30`, `7` | Token settings |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `AUTH_RATE_LIMIT`, `REFRESH_RATE_LIMIT`, `RESUME_RATE_LIMIT`, `CODE_RATE_LIMIT` | `10/minute`, `60/minute`, `12/minute`, `10/minute` | slowapi limits |
| `UPLOAD_RATE_LIMIT`, `EXPORT_RATE_LIMIT` | `10/minute`, `6/minute` | admin paper uploads; admin CSV exports (students, assessment results), per user |
| `GOOGLE_CLIENT_ID` | empty | Enables Google sign-in |
| `SANDBOX_MODE` | `online` | `online`, `subprocess` or `docker` |
| `CODE_PROVIDER`, `CODE_API_URL`, `CODE_API_KEY` | `judge0_ce`, empty, empty | Online compiler provider (the key stays on the server) |
| `CODE_REQUEST_TIMEOUT`, `SANDBOX_MAX_CONCURRENT` | `15`, `4` | Provider timeout (s); programs run at once |
| `OCR_ENGINE` | `rapidocr` | `rapidocr` or `tesseract` |
| `EMAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM` | `false`, `smtp.gmail.com`, `587`, empty | Gmail SMTP |
| `ENABLE_MEMORY_FALLBACK` | `false` | Development only: start without MongoDB on a throwaway in-memory database |

**Frontend (`.env` in the project root)**

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API address. `/api` uses the Vite dev proxy so the httpOnly refresh cookie works |
| `VITE_GOOGLE_CLIENT_ID` | empty | Same value as `GOOGLE_CLIENT_ID`; empty hides the Google button |

**Only for the browser test scripts** (read by Playwright, not by the app): `ADMIN_TEST_EMAIL`, `ADMIN_TEST_PASSWORD` (a real admin account for the admin proofs), `UI_WIDTHS` (for example `390,1280`).

## Creating an admin

Admin accounts are never created by the sign-up form, and no password is ever stored in a file. From `backend/`:

```
.venv\Scripts\python.exe -m app.create_admin
```

It asks for a name and email and then for the password (hidden). Running it for an existing email promotes that account to admin. Admins sign in at **/admin/login**.

**Forgot the admin password?** From `backend/` run `.venv\Scripts\python.exe -m app.create_admin --reset`. It asks for the admin email and a new password twice (hidden), then updates only that admin: the password must be at least 12 characters with upper case, lower case, a digit and a symbol, and not a common password (such as `admin123`). It clears any lockout and signs the admin out everywhere. It refuses an email that belongs to a student, and prints only `Admin updated for <email>`.

## Running the app

| Task | Command |
|---|---|
| Backend + frontend | `run_dev.bat` / `bash run_dev.sh` (or `run_skillsense.bat`) |
| Backend only | `npm run backend` |
| Frontend only | `npm run dev` |
| Startup check | `npm run backend:check` |
| Production build | `npm run build` (output in `dist/`; serve the API on the same site as the frontend) |

## Running the tests

| What | Command |
|---|---|
| Backend (pytest, mongomock, online compiler **mocked**, no internet) | `npm run test:api` (same as `pytest backend/tests`; it needs `pytest` on your PATH, so activate `backend\.venv` first, or run `backend\.venv\Scripts\python.exe -m pytest backend/tests`). The 20 Docker isolation tests are skipped unless you set `RUN_DOCKER_TESTS=1` (Docker running and the runtime images pulled), so the normal result is `387 passed, 20 skipped` |
| Frontend unit tests (Vitest) | `npm test` |
| UI audit (headless Chrome, 3 widths, light and dark, screenshots in `e2e/screenshots/ui/<theme>/`) | `npm run test:ui` (`UI_THEMES=dark UI_WIDTHS=390 npm run test:ui` for a subset) |
| Production settings check before a deploy | `cd backend` then `.venv\Scripts\python.exe scripts\check_production_env.py --env-file PATH` |
| Real-database smoke test (needs the backend running) | `cd backend` then `.venv\Scripts\python.exe scripts\smoke_test.py` |
| Check the question bank, sets and courses | `cd backend` then `.venv\Scripts\python.exe scripts\validate_questions.py` |

Browser specs (headed Chrome, real backend and real Atlas, each deletes its own test student). Run with `npx playwright test -c e2e/playwright.config.js <name>`: `auth-fix`, `p11-arena` (the Practice Arena: Python and Java, shortcuts, hints, history, 390px layout; paces itself under the run limit, so it takes a few minutes), `p5-resume`, `p6-learning`, `p7-dropdowns`, `p7b-dashboard`, `p8-sessions`, `p9-student`, `p14-improvements` (seeds the demo data, checks the admin Analytics and both CSV downloads in both themes, the daily challenge and streak with a real submission, My submissions; removes the demo data again; admin is stubbed with REAL analytics and CSV responses unless the admin variables are set), `p13-theme` (dark and light mode proof; admin pages use a stubbed session unless `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` are set), `p9-admin` (needs `ADMIN_TEST_EMAIL` and `ADMIN_TEST_PASSWORD`; it refuses to run without them). The older `p3`, `p3b-online`, `p4-judge` and `practice-subprocess` specs test the removed stdin-era practice page and are obsolete. Install the browser once with `npx playwright install chromium` if Google Chrome is not installed.

## Dark and light mode (theming)

The whole site has a **Light**, **Dark** and **System** theme. The choice is stored only in this browser (`localStorage` key `skillsense-theme`, never in the backend); with no choice the theme follows the device.

- **Switch it**: the round sun/moon/monitor button (top bar of the public pages, the sidebar header on the student and admin pages, the top bar on a phone), or Settings > Appearance (Light / Dark / System plus a live preview card).
- **How it works**: `src/theme/themeCore.js` (plain JS, unit-tested) keeps the preference and sets `data-theme="light|dark"`, `color-scheme` and `<meta name="theme-color">` on `<html>`; `src/context/ThemeContext.jsx` wraps it for React (`useTheme()` gives `preference`, `resolvedTheme`, `setPreference`, `cycle`). `src/theme/theme-init.js` is inlined into `index.html` and runs before the first paint, so there is no flash; production CSP allows exactly that script by its sha256 hash (computed in `vite.config.js`), never `'unsafe-inline'` for scripts. A switch adds `.theme-switching` to `<html>` for 260 ms for a 200 ms colour fade (not under `prefers-reduced-motion`).
- **Tokens** (all in `src/index.css`, light on `:root`, dark on `:root[data-theme="dark"]`): `--bg --bg-subtle --surface --surface-raised --surface-sunken --border --border-mid --border-strong --text --text-muted --text-faint --text-on-accent --accent --accent-hover --accent-soft --accent-soft-strong --lime-soft --link --focus-ring --overlay --shadow-color` (+ `--shadow-xs..2xl`), status triples `--success|warning|danger|info` with `-soft`, `-text`, `-border`, code and editor tokens `--code-bg --code-text --code-gutter --code-selection --syn-*`, charts `--chart-1..6`, `--skeleton --skeleton-hi --scrollbar-thumb --scrollbar-track --selection-bg --selection-text --option-active-bg --btn-primary-*`. The old `--color-*` names still exist: the brand palette is constant, and the role names (`--color-text-muted`, `--color-border-*`, `--color-success|warning|error|info*`) now point at the tokens. Always-dark panels use the constant `--on-dark*`, `--dark-*` names.
- **Add a themed component**: never write a hex / `rgb()` colour; use `var(--token)` for every colour (text `--text` / `--text-muted`, panels `--surface`, borders `--border`, primary action `btn btn-primary` or `--accent` with `--text-on-accent`, status `--success-*` etc.). Pairs must stay at 4.5:1 (3:1 for large text and control borders). The test `src/theme/noHardcodedColors.test.js` fails on a new literal outside `index.css` and its documented allowlist (WebGL palettes, brand artwork, canvas confetti).
- **Special surfaces**: CodeMirror reads the `--syn-*` / `--code-*` tokens and is reconfigured through a Compartment on a theme change (the code, cursor and undo history stay). The Three.js scenes (roadmap ribbon, landing core) swap colours and light intensities in place on the same renderer (`setTheme`), so a toggle never creates a WebGL context. The Google sign-in button redraws as `outline` (light) or `filled_black` (dark). Printing and the PDF report stay light.
- **Test it**: `npm test` (Vitest: theme engine, no-flash script, grep guard, 3D palette contrast), `npm run test:ui` (every route, both themes, 3 widths; fails on text contrast under 4.5:1 / 3:1 large, a text colour equal to its background, select-option contrast, horizontal scroll, console errors, and a theme flash), `npx playwright test -c e2e/playwright.config.js p13-theme` (headed Chrome: persistence, keyboard, reduced motion, screenshots of every page and state in `e2e/screenshots/p13/`).

## Demo data, analytics, daily challenge and submissions (Improvement Pack 1)

- **Demo data** (`backend/scripts/seed_demo_data.py`, run from `backend/`): about 25 fake students (`demo01@example.test` ...) with assessment results across the score bands, roadmap progress, resume scans, practice submissions with mixed verdicts and notifications, spread over the last 30 days. Every record has `demo: true`; the students have no password and the reserved `.test` address, so nobody can sign in as one. Load the starter content first (`python -m app.seed`).
  ```bash
  cd backend
  .venv\Scripts\python.exe scripts\seed_demo_data.py --yes             # create or refresh 25 demo students (running it again duplicates nothing)
  .venv\Scripts\python.exe scripts\seed_demo_data.py --yes --count 40  # 1 to 100
  .venv\Scripts\python.exe scripts\seed_demo_data.py --yes --reset     # remove ONLY the demo-flagged records
  ```
  It refuses to run without `--yes`, and with `ENV=production` unless `--allow-production`. `--reset` only deletes users that are flagged, use an `@example.test` address AND have a `usr-demo-` id, plus their flagged records; a real user is never touched. The admin Analytics page says when demo students are included.
- **Admin Analytics** (`/admin/analytics`): total students, active in 7 days, average readiness, assessments taken; a readiness distribution chart (students with no activity are counted apart); the weakest topics (lowest question-weighted average, topics with fewer than 3 answered questions are not ranked); activity over the last 30 days. Charts use the theme tokens. **CSV exports** (admin only, `EXPORT_RATE_LIMIT`, formula-safe cells, an explicit column list so no password hash, token or answer key can be written): `GET /api/admin/students/export.csv` and `GET /api/admin/assessment-results/export.csv`, with download buttons on the page.
- **Daily challenge and streaks** (`/api/practice/daily`, `/api/practice/achievements`): one problem per UTC day, the same for everybody (chosen from the date alone, never the same problem two days in a row). A **streak day** is a day with at least one Accepted submission of any problem (many count once), on the student's own calendar: the UTC time shifted by the minutes saved with `PUT /api/student/day-offset` (the browser sends its own offset once). The current streak runs up to today, or up to yesterday while today has no Accepted submission yet; a whole missed day resets it to 0; the best streak is the longest run ever. Badges: 7-day streak, 30-day streak, 10 problems solved. The card is on the dashboard and in the Practice Arena (top-bar chip and problem list); streak and badges are on the profile. It reuses the normal submit path: there is no second judge. (This is separate from the dashboard's "streak" under readiness, which counts any assessment or submission.)
- **My submissions** (`/my-submissions`, `GET /api/practice/submissions` and `/api/practice/submissions/{id}`): the student's own judged submissions, newest first, 10 per page (the API caps `page_size` at 50, a larger value is a 422), filters by verdict, language and difficulty, and the submitted code opens in a dialog. Someone else's submission id is a 404; hidden test cases are never part of any response.
- **Hosting**: `docs/DEPLOY.md` (free tiers: Atlas, Render or Railway, Vercel or Netlify, CORS and Google origins, production flags, a smoke checklist) and `backend/scripts/check_production_env.py` (`--env-file PATH`, `--check-db`): reports missing or unsafe production settings without printing a value, exit code 1 on a problem.

## Features

**Students:** email/password and Google sign-in, email verification, password reset · timed skill assessments (server-side sessions, auto-submit, answer review, topic bands) · practice mode and the Practice Arena (12 original function-style problems, 5 languages, hidden tests, hints, submission history) · resume analyzer (PDF, DOCX, TXT, photos with OCR) with fixes, course links and a personal question set · 13 courses, recommendations and a 4-week plan · roadmaps per career path with locked milestones, priority gaps and course links · placements with skill match and eligibility from CGPA, branch and graduation year · previous-question search and company intelligence · readiness dashboard computed from real activity, PDF report · notifications (in-app, optional email).

**Admins:** question paper upload (text, PDF, DOCX, JSON, scans) → review queue → approve/publish · placement drives (draft, published, closed) · content editor for assessment questions, courses and career paths · student list with CSV export · analytics.

## Security notes

- Passwords are hashed with bcrypt; sign-in locks after repeated failures; sessions use a short-lived access token plus an httpOnly refresh cookie, and logout or a password change revokes old tokens.
- Roles come from the database, never from the client. Every admin route rejects anonymous callers (401) and students (403).
- Answer keys and hidden test cases never leave the server before a submission; sessions are per student and one-shot.
- Uploads are checked by their content (magic bytes), limited to 8 MB, and the temporary copy is deleted. The CSV export neutralises spreadsheet formulas.
- Secrets live only in `backend/.env` (git-ignored). Logs record error types, never passwords, tokens or connection strings. In production `/docs` is off and CORS allows only `FRONTEND_URL`.
- The compiler provider key (if any) is used only by the backend.
- Refresh cookies rotate on every refresh (a replayed old cookie is refused; two tabs refreshing at once are tolerated for 10 s). A Google sign-in on an account whose email was never verified removes the password set at registration.
- Every API response carries `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and a locked-down CSP; `Strict-Transport-Security` only when `ENV=production`. The web app gets its own CSP (Google sign-in and Google Fonts allowed) from `vite.config.js` for `npm run dev` and `vite preview`, and `npm run build` writes the same production headers to `dist/_headers` (read by Netlify and Cloudflare Pages). Any other static host must send those headers itself: copy them from `dist/_headers`, and add HSTS there.
- Request bodies are capped (1 MB JSON, 10 MB uploads), every request field has a length limit, and every route has a default rate limit per signed-in user (`DEFAULT_RATE_LIMIT`, 240/minute) on top of the stricter limits for login, uploads, code runs and resume analysis.
- Behind a reverse proxy start the API without `--reload`, as `uvicorn app.main:app --proxy-headers --forwarded-allow-ips <the proxy's address> --no-server-header` (never `*`), so rate limits use the real client address and not the proxy's. In development the Vite proxy forwards the client address (`xfwd`) and uvicorn trusts it from 127.0.0.1.
- `make_share_zip.ps1` refuses to build a zip containing secrets. If a secret ever reaches a public place, rotate it.

## How the "AI" works (honestly)

- **Resume score:** a rule-based **ATS-style score** with nine categories that add up to 100. It is **an estimate**, not the result of any real company's applicant-tracking software, and different companies' systems will score a resume differently.
- **Question matching:** TF-IDF text similarity (scikit-learn) between a question and the questions an admin has approved and published. It finds similar wording; it does not understand meaning.
- **OCR:** text read from scans and photos **can contain mistakes**, especially on small, blurred or skewed pages. A low-confidence read is flagged, and a student can edit the text before scoring. Scanned question papers always go through human review before students see them.
- **Company questions:** questions tagged with a company (TCS, Infosys, ...) are original practice questions labelled **"Pattern-inspired practice"**. Only a question taken from a paper that an admin uploaded and approved is shown as a previous-year question.
- **Courses:** a course lists providers and links only to the provider's **home page**, never a deep link, and each is marked for the admin to verify. Recommendations are rules over the student's own gaps (career path, assessments, resume).
- **Readiness and roadmap:** simple, transparent formulas over the student's own records; a new student sees zeros, not demo numbers.

## Known limitations

- The online compiler is a free public service: it can be slow, busy or rate limited, and needs internet. Programs cannot read files or use the network. C is only offered for problems with simple types. A slow solution is detected by a time limit per test case, and the free instance also caps one whole run at 10 s CPU.
- OCR quality depends on the scan. Handwriting is not supported.
- The ATS-style score is an estimate (see above). Resume parsing handles common layouts, not every design.
- Placement eligibility only checks CGPA, branch and graduation year (not backlogs). Skill match uses the skills found by assessments.
- Email goes through one Gmail account (about 500 messages a day) and the daily deadline check runs inside the backend process; if the backend is off all day it runs when it starts again.
- Free-text skills an admin adds to a career path are not mapped to the skill catalogue, so recommendations may not credit them.
- Question and course content is small (178 questions, 13 courses, 12 coding problems) and written by the project, not exhaustive.
- Everything runs on one backend process with in-process rate limiting; it is built for a campus pilot, not for large scale.
- The Playwright admin proof needs a real admin account that you provide.

## Troubleshooting

| Symptom | What to do |
|---|---|
| Every page shows errors or `/api` calls return 500/502 | The backend is not running, or the frontend started the wrong Python. Start it with `run_dev.bat`, or `npm run backend`. It must use `backend\.venv`, never `backend\python_bin`. Check http://127.0.0.1:8000/health |
| Backend stops with `JWT_SECRET_KEY must be at least 32 characters` | Fill in `JWT_SECRET_KEY` in `backend/.env` (generator command above) |
| `check_db.py` or startup says `ServerSelectionTimeoutError` / cannot reach MongoDB | In Atlas **Network Access** add your current IP address (it changes on a new network). Check the username and password in `MONGODB_URL` (URL-encode special characters) and that the cluster is not paused |
| `/health` answers 503 `disconnected` | The database is unreachable; same fixes as above |
| Google says **"origin not allowed"** or the button shows an error | In Google Cloud Console add **both** `http://localhost:5173` and `http://127.0.0.1:5173` to the OAuth client's Authorized JavaScript origins, wait a few minutes, hard-refresh, and make sure `VITE_GOOGLE_CLIENT_ID` equals `GOOGLE_CLIENT_ID`. Open the app on the same host you authorized |
| The Run button says the compiler is busy / unavailable (Judge0) | The free public instance is rate limited or slow. Wait a minute and try again, check your internet, or set `CODE_PROVIDER` to your own Judge0 or RapidAPI key. Nothing is marked wrong while the provider is down |
| Resume upload says **OCR engine unavailable** | Text PDFs, DOCX and TXT still work. For scans: `backend\.venv\Scripts\python.exe -m pip install rapidocr-onnxruntime`, or install Tesseract and set `OCR_ENGINE=tesseract`. Restart the backend |
| `pip install` fails on Windows with a blocked DLL | Windows Application Control can block some packages; use pip-only packages and Python 3.11 as in `requirements.txt` |
| Sign-in works but you are signed out on refresh | Open the app through `http://localhost:5173` with `VITE_API_BASE_URL=/api` so the cookie and API share one site |
| No emails arrive | `EMAIL_ENABLED=false` by default. Turn it on with a Gmail App Password; placement emails also need a verified address and the Settings opt-in |
