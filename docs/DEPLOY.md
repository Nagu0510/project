# Deploying SkillSense AI on free tiers

This guide uses only free plans: MongoDB Atlas (database), Render or Railway (backend), Vercel or Netlify (frontend). Free plans change, so check each provider's current limits before you rely on them. **Nothing in this file is a secret**: every value below is a placeholder (`<like-this>`). Never commit a real `.env`, and never paste a real connection string, JWT secret or app password into a chat, an issue or this file.

The project is a demo. Do not change or rotate the admin login for deployment; create the admin account the normal way (step 6).

## 0. How the pieces fit (read this once)

```
browser ──► https://<your-site>            (static frontend: Vercel or Netlify)
               └─ /api/*  is proxied to ──► https://<your-api>   (FastAPI: Render or Railway)
                                                   └──► MongoDB Atlas
```

**Why the proxy matters:** the login refresh token is an `httpOnly` cookie with `SameSite=Lax`, set for the path `/api/auth`. A cookie like that is only sent when the page and the API are the *same site*. If the frontend is on `x.vercel.app` and the API on `y.onrender.com`, the browser treats them as different sites and refreshing the session fails. So keep `VITE_API_BASE_URL=/api` and let the frontend host forward `/api/*` to the backend (steps 4 and 5). The browser then only ever talks to your frontend's domain.

## 1. MongoDB Atlas (free cluster)

1. Create a free cluster (shared tier) and a database user with a **strong generated password**, with read/write access to the `skillsense_ai` database only.
2. **Network Access:** the free hosts have no fixed outgoing address, so add `0.0.0.0/0` (allow from anywhere) and rely on the database user's password. Tighten this to fixed addresses if you later move to a plan that has them. Never use an Atlas user with admin rights for the app.
3. Copy the `mongodb+srv://...` connection string (Connect, Drivers). It goes into the backend variable `MONGODB_URL` (step 3) and nowhere else.
4. After the first backend start, load the starter content once (step 6).

## 2. Generate the secrets (on your own computer)

```bash
python -c "import secrets;print(secrets.token_urlsafe(64))"
```

Use the output as `JWT_SECRET_KEY`. Keep it only in the host's environment settings.

## 3. Backend on Render or Railway

The backend lives in `backend/` and needs Python 3.11 or 3.12.

**Render (Web Service)**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`
- Health check path: `/health` (answers 200 only when MongoDB is reachable)

**Railway**
- New project from the repository, set the service's root directory to `backend`.
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`

About `--forwarded-allow-ips="*"`: rate limiting needs the real client address, which the platform's proxy forwards in `X-Forwarded-For`. `*` is only acceptable when the platform guarantees that nothing except its own proxy can reach the container's port (check the provider's documentation for your plan). If you are unsure, leave the flag off: the app still works, but all visitors then share the proxy's address for rate limiting.

**Free-plan realities:** the service sleeps when idle and the first request after a pause is slow; memory is small. The resume analyzer's OCR engine (`rapidocr-onnxruntime`) and PDF libraries are heavy. If the service runs out of memory, remove `rapidocr-onnxruntime` from `requirements.txt` for the deployed copy: text PDFs, DOCX and TXT resumes still work; only scans and photos answer "OCR engine unavailable" (503).

**Environment variables to set on the backend host** (names only; see `backend/.env.example` for comments):

| Variable | Value |
|---|---|
| `ENV` | `production` |
| `JWT_SECRET_KEY` | the generated value from step 2 (32+ random characters) |
| `MONGODB_URL` | your Atlas `mongodb+srv://...` string |
| `DATABASE_NAME` | `skillsense_ai` |
| `FRONTEND_URL` | `https://<your-site>` exactly, no trailing slash (the only CORS origin, and the base of email links) |
| `SANDBOX_MODE` | `online` (never `subprocess` in production) |
| `CODE_PROVIDER` | `judge0_ce` (free shared instance) or your own `judge0` with `CODE_API_URL` |
| `CODE_API_KEY` | only if your provider needs one (backend only) |
| `BCRYPT_ROUNDS` | `12` |
| `GOOGLE_CLIENT_ID` | only if you use Google sign-in (step 7) |
| `EMAIL_ENABLED`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM` | only if you send email; without them verification and reset links are only logged |
| `ENABLE_MEMORY_FALLBACK` | leave unset (`false`); the app refuses `true` in production |

Never set `DEBUG`, demo or in-memory options. Run the checker locally against the same values before you deploy (step 8).

## 4. Frontend on Vercel

1. Import the repository, framework preset **Vite**, root directory = the project root, build command `npm run build`, output directory `dist`.
2. Build-time variables: `VITE_API_BASE_URL=/api` and, if you use Google sign-in, `VITE_GOOGLE_CLIENT_ID=<same as the backend>`.
3. Add a `vercel.json` in the project root (a single-page app needs the rewrite; the first rule forwards the API):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-api-host>/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

4. Vercel does not read `dist/_headers`. The app sets its security headers (Content-Security-Policy, nosniff, frame denial, referrer policy) from `vite.config.js` in development and into `dist/_headers` on build. Copy the same headers into the `headers` section of `vercel.json` (open the generated `dist/_headers` after `npm run build` and mirror every line), otherwise the hosted site has no CSP.

## 4b. Frontend on Netlify (alternative)

1. New site from the repository: build command `npm run build`, publish directory `dist`, same two build variables as above.
2. Netlify reads `dist/_headers` automatically (the build writes it), so the security headers are already in place.
3. Add a `public/_redirects` file (it is copied to `dist/`):

```
/api/*  https://<your-api-host>/api/:splat  200
/*      /index.html                          200
```

## 5. CORS and cookies checklist

- `FRONTEND_URL` on the backend is the exact public origin of the frontend (`https://<your-site>`): scheme, host, no path, no trailing slash. CORS allows this one origin only.
- The frontend calls `/api` on its own domain, which the host forwards to the backend. Because of that the refresh cookie is same-site and works. In production the cookie is `Secure`, so the site must be served over HTTPS (all four hosts do this by default).
- If you decide to call the API on a different domain directly (not recommended): set `VITE_API_BASE_URL=https://<your-api-host>/api` at build time (it is added to the CSP `connect-src` automatically) and make sure both sites share a registrable domain (for example `app.example.org` and `api.example.org`), or sign-in will not persist.

## 6. First start: content and the admin account

Run these once from a computer that has the repository and the same `MONGODB_URL` in its own `backend/.env` (never in a shared terminal log):

```bash
cd backend
.venv\Scripts\python.exe -m app.seed          # starter content (assessments, problems, courses, ...), safe to repeat
.venv\Scripts\python.exe -m app.create_admin  # asks for the admin email and password (hidden prompts)
```

Do not seed demo students into a live database: `scripts/seed_demo_data.py` refuses to run when `ENV=production`.

## 7. Google sign-in (optional)

In Google Cloud Console, open your OAuth client (Web application) and add under **Authorized JavaScript origins**: `https://<your-site>` (and keep `http://localhost:5173` for development). Set the same client id as `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend build), then redeploy the frontend. The Google button is hidden while the id is empty.

## 8. Production flags and the environment check

`ENV=production` already does the following, nothing else to switch on:

- the interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are off;
- HSTS is sent (the host's HTTPS must be working first);
- the refresh cookie is `Secure`;
- the app refuses a placeholder JWT secret and the in-memory database;
- CORS allows `FRONTEND_URL` only.

Before every deploy, run the checker with the same values you give the host (it prints names and fixed messages only, never a value, and exits with 1 when something is unsafe):

```bash
cd backend
.venv\Scripts\python.exe scripts\check_production_env.py --env-file C:\path\to\a\copy-of-the-production.env
.venv\Scripts\python.exe scripts\check_production_env.py --env-file C:\path\to\production.env --check-db   # also looks for demo students in that database
```

It reports: `ENV` not production, debug flags on, a missing, short, placeholder or low-variety `JWT_SECRET_KEY`, the in-memory database, a local or non-TLS `MONGODB_URL`, a wildcard, non-HTTPS or localhost `FRONTEND_URL`, `SANDBOX_MODE=subprocess`, a low `BCRYPT_ROUNDS`, half-configured email, demo-account flags, and (with `--check-db`) demo records.

## 9. Post-deploy smoke checklist

Open the deployed site in a private window and tick each line:

- [ ] `https://<your-site>/` loads with the right fonts and no console errors (CSP violations show here).
- [ ] `https://<your-api-host>/health` answers 200 with `"status": "healthy"` and `"database": "connected"`.
- [ ] `https://<your-site>/api/auth/refresh` (a POST in the app; in the browser address bar it answers 405 as JSON) is JSON, not your site's HTML page: this proves the `/api` proxy rule works.
- [ ] `https://<your-api-host>/docs` is a 404 (docs are off).
- [ ] Response headers include `Strict-Transport-Security`, `X-Content-Type-Options` and, on the site, `Content-Security-Policy`.
- [ ] Register a new student, then log out and log in again; **reload the page while logged in** (this proves the refresh cookie works through the proxy).
- [ ] Take one assessment and see the result page.
- [ ] Practice Arena: run and submit a solution (needs the online code runner; the free shared one can be slow).
- [ ] Upload a text PDF resume and see the score.
- [ ] Admin: log in at `/admin/login`, open Analytics, download both CSV files and open one in a spreadsheet (no cell should start with `=`, `+`, `-` or `@`).
- [ ] Dark and light themes both load without a flash.
- [ ] No demo students exist (`check_production_env.py --check-db` says "no demo students").
- [ ] Rotate nothing you did not mean to: the admin login stays as it is.

## 10. When something fails

| Symptom | Likely cause |
|---|---|
| Login works, but the session is lost on reload | The frontend calls the API on another site: use the proxy (step 4) and `VITE_API_BASE_URL=/api` |
| Browser console: CORS error | `FRONTEND_URL` differs from the real origin (https, trailing slash, `www.`) |
| Every request answers 503 | The backend cannot reach Atlas: Network Access, the database user, or the connection string |
| First request after a pause takes a long time | Free plans sleep when idle |
| Resume scans answer 503 "OCR engine unavailable" | The OCR package was removed or the service ran out of memory (see step 3) |
| Run / Submit answer "Judge unavailable" | The free online code runner is busy or rate limited; try again, or host your own Judge0 |
