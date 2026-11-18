# SkillSense AI: security audit

Stage 1 (audit) produced the **Findings** table; Stage 2 and 3 fixed what could be fixed, and **Status after fixes** says per finding what is fixed, accepted, or yours to do. No secret value appears in this file, in the chat or in any log: only file names, commit hashes, counts and yes/no results.

## Headline

- **No real secret is committed anywhere.** The real values from `backend/.env` (JWT secret, Atlas password, Gmail app password, demo passwords) were searched as exact strings in the whole working tree (including `dist`, `e2e`, docs, scripts, ignored files) and in **all 5 commits** (every file version, including deleted files and the tracked `node_modules` / `python_bin` history). They appear **only** in `backend/.env`. **No rotation is required for secrets.**
- `backend/.env` and `.env` are git-ignored and not tracked. `backend/.env` *was* committed in the two oldest commits (`ee527649`, `0f1588f2`), but those versions held only a local MongoDB URL and a placeholder JWT secret, so nothing real leaked.
- The frontend bundle (`dist`) contains no secret. Only `VITE_API_BASE_URL` and the public Google client ID are used as `VITE_` variables.
- **One account-hygiene item you must act on (M-09):** the real admin password is the same value as `DEMO_ADMIN_PASSWORD` stored in plaintext in `backend/.env`.
- No Critical findings. 3 High, 11 Medium, 12 Low (below).

## Status after fixes (Stage 2 and 3)

Every fix has a regression test in `backend/tests/test_security_hardening.py` (the section comments there carry the finding ids).

| id | status | what was done / why not |
|---|---|---|
| H-01 | **Fixed** | Google sign-in on an account whose email was never verified now deletes the stored password, sets `password_changed_at` (every older session dies) and marks the account Google-only. A verified account keeps its password. |
| H-02 | **Fixed** | PDF pages are rendered at no more than 16 megapixels (the DPI is lowered; a page that would need under 60 DPI is refused with 413). A DOCX is refused before unpacking when its declared uncompressed size exceeds 40 MB or it has over 2000 entries. Tests build a 200-inch-page PDF and a zip bomb. |
| H-03 | **Fixed** | `question_text` is limited to 5000 characters, `topic` to 100, and `/question-intelligence/match` is limited to 30 per minute per client. |
| M-01 | **Fixed** | Every refresh issues a new refresh cookie and revokes the old one. A second request with the old cookie is refused with 401, except inside a 10-second grace window (two browser tabs refreshing together), where it receives an access token but no new cookie. Logout and a password change still kill the cookie at once. |
| M-02 | **Fixed (API, Vite, `dist/_headers`)** | API: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cache-Control: no-store` on `/api/auth/*`, and HSTS only when `ENV=production`. Web app: `vite.config.js` sends a CSP for `npm run dev` and `vite preview` (Google sign-in script/frame/style/connect, Google Fonts, the Vite websocket, `frame-ancestors 'none'`), and `npm run build` writes the production headers to `dist/_headers` (read by Netlify and Cloudflare Pages). Another static host must send the same headers itself, and HSTS belongs to that host. The browser audit (`npm run test:ui`, console errors are fatal) runs clean under the CSP. |
| M-03 | **Fixed** | All request models have length limits on text, lists and dictionaries (a test sweeps every route's body model and fails on a new unbounded field); the two raw `dict` practice endpoints are typed models; JSON bodies over 1 MB and uploads over 10 MB get 413 (by `Content-Length` and while streaming). |
| M-04 | **Fixed** | Every route has a default limit of 240 per minute per signed-in user (per client address when anonymous), `DEFAULT_RATE_LIMIT`; admin paper upload has 10 per minute. slowapi's own `default_limits` cannot see routes added with `include_router` in this FastAPI version (probed), so a small middleware using the same `limits` library applies it. Stricter limits on login, register, uploads, code runs and resume analysis stay. |
| M-05 | **Fixed in code; your server needs the flags** | The Vite proxy forwards the client address (`xfwd: true`) and uvicorn trusts it from 127.0.0.1; a test shows two people behind a trusted proxy get separate buckets and that a spoofed `X-Forwarded-For` from any other peer is ignored. On a real server start uvicorn with `--proxy-headers --forwarded-allow-ips <proxy address>` (never `*`); see README, Security notes. |
| M-06 | **Fixed** | python-jose replaced by PyJWT (`exp` and `iat` required, algorithm pinned, `none` and other algorithms refused); `ecdsa` and python-jose are uninstalled from the venv; `JWT_ALGORITHM` accepts only HS256/HS384/HS512. |
| M-07 | **Fixed** | A 422 now returns only `loc`, `msg` and `type` (no `input`, no `ctx`), so a rejected password is not echoed. The shape the frontend reads is unchanged. |
| M-08 | **Not fixed: yours** | Atlas database user privileges (see "What you must still do"). |
| M-09 | **Code fixed; the rest is yours** | `DEMO_STUDENT_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `ENABLE_DEMO_ACCOUNTS` and the demo-account code are removed from the code, `.env.example`, README and CLAUDE.md (a leftover line in your `.env` is ignored). You remove them from your own `.env` and reset the admin password. |
| M-10 | **Partly fixed, rest accepted** | `npm audit fix` (no `--force`) fixed source-map-js. vitest stays on 3 and react-router-dom on 6 by your decision: see "Accepted advisories". |
| M-11 | **Fixed** | `application_link` must be `http://` or `https://` with a host (422 otherwise, also on update); the frontend normalizer drops any other scheme, so `window.open` never receives `javascript:` or `data:`. |
| L-01 | Not fixed (accepted trade-off) | Register still says the email exists; changing it needs a mail flow. |
| L-02 | Partly fixed | `Referrer-Policy: no-referrer` stops the verification token leaking through Referer. The token still travels in a GET query string. |
| L-03 | Partly fixed | Only HMAC algorithms are accepted. The secret is still only length-checked (32+). |
| L-04 | **Fixed** | CORS allows GET, POST, PUT, PATCH, DELETE, OPTIONS and the headers Authorization, Content-Type, Accept. |
| L-05 | **Fixed** | Database errors are logged by type only; the admin CLI prints the error type, not the driver message. |
| L-06 | Not fixed | Launch scripts still use `--reload` (development); the production command with `--no-server-header` is documented in the README. |
| L-07, L-08 | Not fixed | A password list for students and admin MFA are features, not fixes. |
| L-09 | Yours | Set `SMTP_USER` to the full address before enabling email. |
| L-10 | **Fixed** | pip 26.2.1 and setuptools 84.0.0 in `backend\.venv`; `pip-audit` on `requirements.txt` reports no known vulnerabilities and `pip check` is clean. |
| L-11 | Not touched | Needs your approval before anything is deleted (see below). |
| L-12 | No action | The live database has no account using those old values. |

### Accepted advisories (`npm audit` still lists 5 entries, all from these two)

- **vitest 3 (`tinypool`, `@vitest/mocker`; critical, moderate).** The prototype-pollution-to-RCE needs an attacker to control the options handed to the test runner's worker pool. Vitest only runs on a developer machine or CI against this repository's own tests; it is not part of the production build and is never loaded by the app. The fix is vitest 5, which needs Node 22.12 or newer. Kept on 3 by your decision.
- **react-router-dom 6 (`react-router`; moderate).** The open redirect needs a backslash in a `Link` or `navigate()` target that a visitor controls. Every target in this app is a fixed route or an id from our own data, and the `redirect` query value is written but never read (checked in Stage 1). Version 7 is a breaking upgrade. Kept on 6 by your decision.

### Checks run after the fixes

| check | result |
|---|---|
| `pytest backend/tests` | 435 passed, 21 skipped (20 Docker tests are opt-in; one more is skipped on this machine when Windows Application Control blocks a subprocess, so the totals move by a few between runs) |
| `npm run build` and `npm test` (Vitest) | build OK and `dist/_headers` written; 15 tests passed |
| `npm run test:ui` (headless Chrome, 1280/768/390 px) | 48 visits, 0 fatal, 0 warnings; the one "external" note is Google refusing this origin (Google Cloud setting, below) |
| `backend/scripts/smoke_test.py` against the real backend and Atlas | 12 passed, 0 failed, 1 skipped (the admin steps need `ADMIN_TEST_EMAIL` and `ADMIN_TEST_PASSWORD`) |
| `pip-audit` / `pip check` | no known vulnerabilities / no broken requirements |
| `npm audit` | 5 entries, all the accepted ones above |

### What you must still do yourself

1. **M-08, Atlas:** Database Access > edit the app user > give it `readWrite` on `skillsense_ai` only (remove any cluster-wide role).
2. **M-09:** delete the three `DEMO_*` / `ENABLE_DEMO_ACCOUNTS` lines from your own `backend/.env`, then run `python -m app.create_admin --reset` in `backend\.venv` to set an admin password that is stored nowhere else. Use a separate database for development.
3. **Production server:** start uvicorn without `--reload`, with `ENV=production`, `--proxy-headers --forwarded-allow-ips <proxy address>` and `--no-server-header`, behind HTTPS. If the static host is not Netlify or Cloudflare Pages, copy the headers from `dist/_headers` into its config and add HSTS there.
4. **Google Cloud:** add your real site origin (and `http://localhost:5173` for development) under Authorized JavaScript origins of the OAuth client; this clears the "refused this origin" note.
5. **L-09:** set `SMTP_USER` to the full Gmail address before turning email on.
6. **Decisions I did not take (nothing was deleted):** `backend/python_bin`, `dist`, the six `src/data/mock*.js` files, `scripts/test_normalizers.js`, the two `skillsense-ai-share-*.zip` files, `e2e/screenshots/p9/student-04-FAILED.png`, and untracking `node_modules`, `backend/python_bin` and `__pycache__` from git (L-11). Say which you want removed.
7. Never reuse the old demo passwords from earlier commits (L-12).

## Findings (Stage 1, as found)

| id | severity | file | issue | proposed fix |
|---|---|---|---|---|
| H-01 | High | `backend/app/routers/auth.py` (`google_login`) | **Pre-hijack account takeover.** Registration does not require email verification. An attacker can register `victim@x.com` with the attacker's own password; when the victim later signs in with Google, the account is linked (`email_verified` becomes true) but the attacker's password still works and nothing is revoked. | When Google links an existing account whose email was not verified: delete the stored password hash, set `password_changed_at` (revokes all earlier sessions). Regression test. |
| H-02 | High | `backend/app/services/resume_extract.py` (`_read_pdf`, `_read_docx`) | **Memory bombs in uploads (student resume upload and admin paper upload).** A tiny PDF with a huge page size is rendered at 200 DPI with no pixel cap (a 14400 pt page is about 1.6 gigapixels, about 4.8 GB). A DOCX is a zip with no limit on uncompressed size (an 8 MB zip can expand to gigabytes). Images are capped at 50 MP, PDFs and DOCX are not. Not executed during the audit, to avoid exhausting memory. | Scale the render DPI so width x height <= `MAX_PIXELS` (or reject); before opening a DOCX sum `ZipInfo.file_size` and reject over a limit (for example 50 MB) or a large ratio. Tests with a generated large-page PDF and a generated zip bomb. |
| H-03 | High | `backend/app/routers/question_intelligence.py` (`POST /question-intelligence/match`), `models/question_paper.py` | **Unauthenticated CPU/memory DoS.** The endpoint is public, has no rate limit, and `question_text` has no length limit (a 3 MB body was accepted and processed with status 200). | `max_length` on `question_text`/`topic`; rate limit per client. |
| M-01 | Medium | `auth.py` (`refresh`), `auth_service.py` | **No refresh-token rotation or reuse detection.** `/auth/refresh` returns a new access token but the same refresh cookie stays valid for 7 days; a stolen cookie keeps working until logout or a password change. | Issue a new refresh cookie on every refresh and revoke the old `jti`; a reused revoked refresh token revokes the account's sessions. |
| M-02 | Medium | `backend/app/main.py`, `vite.config.js` | **No security headers** on the API or on the dev/preview servers: no CSP, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, and no HSTS in production (clickjacking of the admin pages is possible). Verified by probe. | API middleware that adds them (HSTS only when `ENV=production`); `server.headers` / `preview.headers` in Vite and a header template for the real host; CSP must allow Google Identity Services, Google Fonts and the dev server. |
| M-03 | Medium | `models/user.py`, `models/placement.py`, `routers/practice.py` (`answer`, `attempt`), `main.py` | **No request body size limit and unbounded fields.** A 2 MB `college` value was accepted on register; profile and placement lists have no bounds; `POST /practice/problems/{slug}/attempt` and `/practice/questions/{id}/answer` take a raw `dict` (a 3 MB code snapshot or arbitrary JSON would be stored). | `max_length` / list limits on all models; typed models for the two `dict` endpoints; a body-size cap (middleware checking `Content-Length`, and a streaming limit). |
| M-04 | Medium | all routers | **Rate limiting covers only 15 of 95 routes** (login, register, forgot, verify, Google, refresh, unsubscribe, resume, code run/submit). Unlimited: assessment start/submit/answers, notifications, practice answer/attempt, admin upload and content editor, placements, previous-questions, the public match endpoint, `/auth/me`. No default limit. | A default limit for every route (slowapi `default_limits` + middleware), tighter per-route limits for expensive ones. |
| M-05 | Medium | `backend/app/limiter.py`, `vite.config.js`, launch scripts | **Rate-limit key is the TCP peer address.** Behind the Vite proxy every user appears as 127.0.0.1, so all students share one login/register bucket (one person can lock out everyone) and per-client limits are meaningless in dev. In production behind a reverse proxy, uvicorn only trusts `X-Forwarded-For` from `--forwarded-allow-ips` (default 127.0.0.1): safe by default, but must never be set to `*`. | Vite proxy `xfwd: true`; document and test the production flags (`--proxy-headers --forwarded-allow-ips <proxy ip>`). |
| M-06 | Medium | `backend/requirements.txt`, `auth_service.py`, `notification_service.py` | **python-jose 3.5.0 is unmaintained with an open advisory (CVE-2026-85394, HMAC key confusion) and no fixed version**; its dependency `ecdsa` has PYSEC-2026-1325 (Minerva timing, not used by HS256). Not exploitable with our setup (HS256, random secret, `algorithms` pinned) but there is no upstream fix. | Replace with PyJWT in the two files that use it; `ecdsa` then leaves the dependency tree. |
| M-07 | Medium | `main.py` (validation errors) | **422 responses echo the submitted value** (`input`), including a rejected password, back in JSON (verified). | Exception handler for `RequestValidationError` that removes `input` and `ctx`. |
| M-08 | Medium | Atlas (not in code) | **The Atlas database user looks over-privileged**: it can run `listDatabases` and sees 4 databases, so it likely has a cluster-wide role. | You: give the app user `readWrite` on `skillsense_ai` only (Atlas > Database Access). |
| M-09 | Medium | `backend/.env` (local, ignored) | **The real admin password equals `DEMO_ADMIN_PASSWORD` kept in plaintext in `.env`**, although demo accounts are off. Both demo passwords sit in the file for nothing. Dev and production would also share one Atlas database. | You: remove both `DEMO_*_PASSWORD` lines; change the admin password with `python -m app.create_admin --reset` to a value that is stored nowhere; use a separate database for development. |
| M-10 | Medium | `package.json` dependencies | `npm audit`: **react-router-dom 6.x** (open redirect via backslash in `Link`/`navigate`; not reachable here: no user-controlled navigation target, and the `redirect` query value is never read), **vitest 3.x** (critical advisory chain via `tinypool` / `@vitest/mocker`, dev-only; the fix is vitest 5 which needs Node 22.12+), **source-map-js** (high, build-time DoS, fixable without a major bump). | `npm audit fix` for source-map-js; vitest 5 (raises the Node floor to 22.12) or accept as dev-only; react-router-dom 7 (breaking) after a test pass. Decision needed. |
| M-11 | Medium | `models/placement.py`, `PlacementTrackerPage.jsx` | `application_link` accepts any URL scheme and is opened with `window.open` (`javascript:` / `data:` possible; only admins can set it). | Validate `http(s)://` on the model; the page also refuses other schemes. |
| L-01 | Low | `auth.py` | **User enumeration:** register answers "An account with this email already exists" (400); a locked account answers 429 (reveals it exists). Login, forgot-password, reset and verify are generic. | Accept as a documented trade-off, or answer register with a generic message and send the owner a mail. |
| L-02 | Low | `auth.py` (`verify-email`), frontend links | Verification token travels in a **GET query string**: it lands in uvicorn access logs and browser history; no `Referrer-Policy` to stop it leaking via Referer. Reset and unsubscribe tokens sit in the page URL too (the API calls use POST). | `Referrer-Policy: no-referrer` (with M-02); make verify-email a POST from the page; do not log query strings. |
| L-03 | Low | `config.py` | `JWT_ALGORITHM` is a free-form string; the JWT secret is only length-checked (32+), not for entropy or repetition. | `Literal["HS256","HS384","HS512"]`; reject obviously repetitive secrets. |
| L-04 | Low | `main.py` | CORS `allow_methods=["*"]`, `allow_headers=["*"]` with credentials (origins are an explicit list, which is correct). | List the real methods and headers. |
| L-05 | Low | `main.py` (`_service_unavailable`), `create_admin.py`, `database.py` | A database error is logged with the driver message (can contain cluster host names); the admin CLI prints the driver message. The connection string itself is never logged. | Log and print the error type only. |
| L-06 | Low | `run_dev.*`, `run_skillsense.bat`, `package.json` | Every launch script uses `--reload`; there is no production launch command; uvicorn sends a `Server:` banner. | Add `--no-server-header`; document the production command (no `--reload`, `ENV=production`, behind TLS). |
| L-07 | Low | `models/user.py` | Student password policy is minimal (8+ characters, a letter and a digit, no common-password list); the admin reset is already strong. | Reuse the common-password list for students. |
| L-08 | Low | `auth.py` | Five wrong passwords lock an account for 15 minutes: an attacker can keep the admin locked out (availability). No MFA for the admin account. | Note only (MFA would be a feature). |
| L-09 | Low | `backend/.env` | `SMTP_USER` is a bare name, not a full email address; Gmail needs the address. (Email is off, so no impact today.) | You: set the full address before enabling email. |
| L-10 | Low | venv | `pip-audit`: `pip 24.0` (8 advisories, fixed in 26.2) and `setuptools 65.5.0` (4 advisories, fixed in 83+) in the virtual environment (build tooling, not app code). | `python -m pip install --upgrade pip setuptools`. |
| L-11 | Low | repository | **Clutter and tracked junk:** `backend/python_bin` (353 MB, 10,496 tracked files, includes `python311.zip`), 14,596 tracked `node_modules` files, 4,114 tracked `__pycache__` files, `dist`, six unused `src/data/mock*.js` files, stale `scripts/test_normalizers.js` (contains demo values), two share zips next to the project, 6.4 MB of old screenshots (ignored); unused packages `gsap` and `clsx`; `pypdf` and the test packages (`pytest`, `mongomock-motor`, `pytest-asyncio`) sit in the runtime `requirements.txt`. | After your approval only: remove them and `git rm -r --cached`; split `requirements-dev.txt`. |
| L-12 | Low | git history | Earlier commits contain hard-coded weak demo passwords in code (`create_admin.py`, `routers/auth.py`, `seed.py`, `LoginPage.jsx`, `AdminLoginPage.jsx`, old `dist` bundles; all 5 commits) and the committed `.env` mentioned above. The live database has **no** account using any of those, no demo or test accounts, and no legacy SHA-256 hashes. | None needed; do not reuse those values anywhere. |

## Verified and working (no change needed)

| area | result |
|---|---|
| Passwords | bcrypt with legacy SHA-256 upgrade on login; `hmac.compare_digest` for the legacy check; dummy-hash timing equalisation for unknown emails; 72-byte limit enforced. |
| Tokens | Access token 30 min; refresh 7 days; role always read from the database, never from the token or request; revoked-token list with TTL; password change/reset/admin reset invalidate every older token. |
| Refresh cookie | `HttpOnly`, `SameSite=Lax`, `Secure` in production, path-scoped to `/api/auth`. Access token kept in memory, not in `localStorage`. |
| Login | Generic error for wrong email/password/role; 5-failure lockout; Google tokens verified for signature, expiry, issuer, audience and `email_verified`; Google cannot sign into admin. |
| Reset and verify tokens | Random 256-bit, only the SHA-256 hash is stored (checked in the live database: collections empty, hashed format), single use, TTL index. |
| Authorization | 95 routes inventoried (appendix): every student route derives the user from the token; no `user_id`, `email` or `role` is read from a body or query; every admin route is `require_admin` and a test walks the OpenAPI schema for 401/403. Mass assignment on register and on `PUT /student/profile` probed: `role`, `id`, `user_id`, `email` in the body are ignored. |
| CSRF | State-changing calls use the `Authorization` header (not the cookie), so cross-site forms cannot act. |
| Injection | Typed Pydantic bodies; every regex built from user text uses `re.escape`; no `$where`/`$expr`; page and filter parameters are typed. |
| Frontend | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`; no open redirect (the `redirect` value is written but never read); external links use `noopener`. |
| Output safety | CSV export formula-safe; email templates HTML-escape every value; the report PDF survives markup in names. |
| Uploads | Size limit (8 MB), magic-byte check, extension/content agreement, temp file deleted, image 50 MP cap, 4-page PDF cap, OCR time limit (40 s) and worker cap (2). (H-02 lists what is still missing.) |
| Online compiler | Only source, language and stdin are sent; the provider key is read only on the server; browser calls only our own endpoints. |
| Answer keys | Never in a response before submit (existing tests `test_no_endpoint_response_contains_an_answer_key`, session tests); hidden coding test cases never returned. |
| Transport | CORS uses an explicit origin list (no wildcard with credentials); `/docs`, `/redoc`, `/openapi.json` are off in production (tested in a subprocess); generic JSON for unexpected errors (no traceback to the client). |
| Database | Unique indexes on `users.email`, `id`, `google_sub`; TTL indexes on revoked tokens, reset and verification tokens, assessment sessions (live Atlas confirmed); the connection string is never logged or printed. Live data: 1 admin, 2 students, no demo or test accounts. |
| SSRF | No server-side fetch of a user-supplied URL anywhere. |

## Could not verify from here

- Which role the Atlas user has (only that it is broader than one database; M-08).
- Google Cloud OAuth client settings (authorized origins).
- Text inside the screenshot PNGs (images are not searchable); they are git-ignored and hold test data from throwaway users.

## Appendix: route inventory (guard / method / path / body / query)

```
PUBLIC         GET    /api/assessments                                     body[] q[career_path,difficulty,skill,preview]
PUBLIC         GET    /api/assessments/catalog                             body[] q[career_path,difficulty,skill]
PUBLIC         POST   /api/auth/admin/login                                body[credentials] q[]
PUBLIC         POST   /api/auth/forgot-password                            body[data] q[]
PUBLIC         POST   /api/auth/google                                     body[data] q[]
PUBLIC         POST   /api/auth/login                                      body[credentials] q[]
PUBLIC         POST   /api/auth/logout                                     body[] q[]
PUBLIC         POST   /api/auth/refresh                                    body[] q[]
PUBLIC         POST   /api/auth/register                                   body[user_in] q[]
PUBLIC         POST   /api/auth/reset-password                             body[data] q[]
PUBLIC         GET    /api/auth/verify-email                               body[] q[token]
PUBLIC         GET    /api/courses                                         body[] q[skill,level]
PUBLIC         GET    /api/courses/{slug}                                  body[] q[]
PUBLIC         POST   /api/notifications/unsubscribe                       body[body] q[]
PUBLIC         GET    /api/practice/problems                               body[] q[difficulty,topic]
PUBLIC         GET    /api/practice/problems/{problem_slug}                body[] q[]
PUBLIC         GET    /api/previous-questions                              body[] q[company,year,topic,difficulty,search,page,page_size]
PUBLIC         GET    /api/question-intelligence/companies                 body[] q[]
PUBLIC         GET    /api/question-intelligence/company/{company_id}      body[] q[]
PUBLIC         POST   /api/question-intelligence/match                     body[req] q[]
PUBLIC         GET    /api/question-intelligence/summary                   body[] q[]
optional-login GET    /api/career-paths                                    body[] q[]
optional-login GET    /api/career-paths/{career_id}                        body[] q[]
optional-login GET    /api/student/roadmap                                 body[] q[career_path]
any-login      GET    /api/assessments/practice/questions                  body[] q[skill,difficulty,topic,company]
any-login      POST   /api/assessments/practice/verify                     body[req] q[]
any-login      GET    /api/assessments/{assessment_id}                     body[] q[]
any-login      POST   /api/auth/change-password                            body[data] q[]
any-login      GET    /api/auth/me                                         body[] q[]
any-login      POST   /api/auth/send-verification                          body[] q[]
any-login      GET    /api/placements                                      body[] q[status_filter]
any-login      GET    /api/placements/{job_id}                             body[] q[]
any-login      POST   /api/practice/problems/{problem_slug}/attempt        body[body] q[]
any-login      GET    /api/practice/questions                              body[] q[skill,topic,difficulty,question_type,company]
any-login      GET    /api/practice/questions/{question_id}                body[] q[]
any-login      POST   /api/practice/questions/{question_id}/answer         body[body] q[]
any-login      GET    /api/practice/stats                                  body[] q[]
STUDENT        GET    /api/assessments/result/latest                       body[] q[]
STUDENT        PUT    /api/assessments/sessions/{session_id}/answers       body[body] q[]
STUDENT        POST   /api/assessments/submit                              body[submission] q[]
STUDENT        GET    /api/assessments/{assessment_id}/result              body[] q[]
STUDENT        POST   /api/assessments/{assessment_id}/start               body[] q[]
STUDENT        POST   /api/assessments/{assessment_id}/submit              body[submission] q[]
STUDENT        POST   /api/courses/{slug}/progress                         body[body] q[]
STUDENT        GET    /api/notifications                                   body[] q[]
STUDENT        POST   /api/notifications/read-all                          body[] q[]
STUDENT        POST   /api/notifications/{notification_id}/read            body[] q[]
STUDENT        POST   /api/practice/code/run                               body[req] q[]
STUDENT        POST   /api/practice/code/submit                            body[req] q[]
STUDENT        GET    /api/practice/solved                                 body[] q[]
STUDENT        GET    /api/recommendations/courses                         body[] q[]
STUDENT        POST   /api/resume/analyze                                  body[file,career_path,job_description] q[]
STUDENT        POST   /api/resume/analyze-text                             body[body] q[]
STUDENT        GET    /api/resume/history                                  body[] q[]
STUDENT        GET    /api/resume/questions                                body[] q[analysis_id,company]
STUDENT        POST   /api/student/career-path                             body[req] q[]
STUDENT        GET    /api/student/courses                                 body[] q[]
STUDENT        GET    /api/student/dashboard                               body[] q[]
STUDENT        GET    /api/student/profile                                 body[] q[]
STUDENT        PUT    /api/student/profile                                 body[updated] q[]
STUDENT        GET    /api/student/progress                                body[] q[]
STUDENT        GET    /api/student/report.pdf                              body[] q[]
STUDENT        PUT    /api/student/roadmap/progress                        body[req] q[]
STUDENT        PUT    /api/student/roadmap/{step_id}/progress              body[req] q[]
STUDENT        PUT    /api/student/settings                                body[body] q[]
ADMIN          GET    /api/admin/analytics                                 body[] q[]
ADMIN          GET    /api/admin/content/career-paths                      body[] q[]
ADMIN          PUT    /api/admin/content/career-paths/{path_id}            body[body] q[]
ADMIN          GET    /api/admin/content/courses                           body[] q[]
ADMIN          POST   /api/admin/content/courses                           body[body] q[]
ADMIN          PUT    /api/admin/content/courses/{slug}                    body[body] q[]
ADMIN          POST   /api/admin/content/courses/{slug}/activate           body[] q[]
ADMIN          POST   /api/admin/content/courses/{slug}/deactivate         body[] q[]
ADMIN          GET    /api/admin/content/meta                              body[] q[]
ADMIN          GET    /api/admin/content/questions                         body[] q[skill,difficulty,active,search]
ADMIN          POST   /api/admin/content/questions                         body[body] q[]
ADMIN          PUT    /api/admin/content/questions/{question_id}           body[body] q[]
ADMIN          POST   /api/admin/content/questions/{question_id}/activate  body[] q[]
ADMIN          POST   /api/admin/content/questions/{question_id}/deactivate body[] q[]
ADMIN          GET    /api/admin/dashboard                                 body[] q[]
ADMIN          GET    /api/admin/extracted-questions                       body[] q[paper_id,status_filter]
ADMIN          PUT    /api/admin/extracted-questions/{question_id}/status  body[body] q[]
ADMIN          GET    /api/admin/question-papers                           body[] q[]
ADMIN          POST   /api/admin/question-papers/upload                    body[file,company,exam,year,paper_type,role,description] q[]
ADMIN          GET    /api/admin/question-papers/{paper_id}/questions      body[] q[]
ADMIN          DELETE /api/admin/questions/{question_id}                   body[] q[]
ADMIN          POST   /api/admin/questions/{question_id}/approve           body[] q[]
ADMIN          POST   /api/admin/questions/{question_id}/publish           body[] q[]
ADMIN          POST   /api/admin/questions/{question_id}/reject            body[] q[]
ADMIN          GET    /api/admin/students                                  body[] q[]
ADMIN          GET    /api/admin/students/export.csv                       body[] q[]
ADMIN          POST   /api/placements                                      body[new_job] q[]
ADMIN          DELETE /api/placements/{job_id}                             body[] q[]
ADMIN          PUT    /api/placements/{job_id}                             body[updated_job] q[]
ADMIN          PATCH  /api/placements/{job_id}/status                      body[body] q[]
95 routes
```
