// UI audit (headless Chrome): login, register, student dashboard, practice, resume analyzer, assessments and the admin dashboard
// at 1280, 768 and 390px, in BOTH themes (light and dark).   npm run test:ui          UI_WIDTHS=390,1280 UI_THEMES=dark npm run test:ui   (subset)
// Screenshots: e2e/screenshots/ui/<theme>/<role>/<route>/<width>.jpg      Report: e2e/screenshots/ui/report.md
// Theme checks (fatal): text contrast under 4.5:1 (3:1 for large text), text colour equal to its background, and a flash (the theme must
// already be on <html> at DOMContentLoaded, before any script of the app has run).
//
// FATAL (fails the run): horizontal scroll, console errors / page errors, a visible mobile header above 768px,
// a broken desktop shell (sidebar not exactly 264px at the left edge, content not offset by it), a sidebar that is
// clipped or does not open/close properly on mobile, and any <select> option (or option CSS rule) under 4.5:1 contrast or with
// its text colour equal to its background. Everything else is listed as a warning for review.
//
// Admin pages: ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD are used when both are set; otherwise a STUBBED admin session is
// used (layout, overflow and console checks only, empty data). Passwords are never printed.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { selectContrastAudit } from './helpers/selectContrast.js';
import { textContrastAudit } from './helpers/themeContrast.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(here, 'screenshots', 'ui');
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const BASE = 'http://localhost:5173';
const BREAKPOINT = 768; // keep in sync with src/utils/layout.js
const SIDEBAR = 264;

const WIDTHS = (process.env.UI_WIDTHS || '1280,768,390').split(',').map(Number);
const THEMES = (process.env.UI_THEMES || 'light,dark').split(',');
const heightFor = (w) => (w <= 480 ? 844 : 900);

const GUEST = ['/', '/login', '/signup', '/forgot-password', '/verify-email', '/features', '/about', '/career-paths', '/courses', '/previous-questions', '/company-prep/tcs', '/admin/login', '/no-such-page'];
const STUDENT = ['/dashboard', '/roadmap', '/practice', '/my-submissions', '/resume-analyzer', '/resume-practice', '/assessment', '/assessment-results', '/courses', '/career-paths', '/previous-questions', '/company-prep/tcs', '/profile', '/settings', '/placements'];
const ADMIN = ['/admin/dashboard', '/admin/question-papers', '/admin/question-bank', '/admin/assessments', '/admin/content', '/admin/companies', '/admin/students', '/admin/analytics', '/admin/settings'];

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]+/g, '_'));
const email = `p3-test-ui-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(12).toString('base64url')}`;
const useRealAdmin = Boolean(process.env.ADMIN_TEST_EMAIL && process.env.ADMIN_TEST_PASSWORD);

let selectsChecked = 0;
let optionsChecked = 0;
const issues = []; // { severity, role, route, width, theme, kind, detail }
let currentTheme = 'light';
const visits = [];
let studentState;

function note(severity, role, route, width, kind, detail) {
  issues.push({ severity, role, route, width, theme: currentTheme, kind, detail: String(detail).slice(0, 300) });
}

// ---- measured inside the page -------------------------------------------------------------------------------------
function measure({ breakpoint }) {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const out = { vw, scrollW: Math.max(doc.scrollWidth, document.body.scrollWidth), clientW: doc.clientWidth };
  const describe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  };

  out.mobileTopbars = [...document.querySelectorAll('[data-testid="mobile-topbar"], .mobile-topbar, .mobile-dashboard-header')].filter(visible).length;
  const side = document.querySelector('.app-sidebar');
  if (side) {
    const r = side.getBoundingClientRect();
    out.sidebar = { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), visible: visible(side) };
  }
  const main = document.querySelector('.dashboard-main');
  if (main) out.mainLeft = Math.round(main.getBoundingClientRect().left);

  // elements that stick out past the right edge of the viewport (and are not inside a scroll container)
  const sticking = [];
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (sticking.length >= 6) break;
    if (el.closest('.app-sidebar')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1 || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && r.left >= vw) continue; // off-canvas by design
    if (el.closest('[aria-hidden="true"]') || cs.pointerEvents === 'none') continue;
    if (inScroller(el)) continue;
    sticking.push(`${describe(el)} right=${Math.round(r.right)}`);
  }
  out.sticking = sticking;

  out.brokenImages = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && visible(i)).map((i) => i.src.slice(0, 80));

  // text that is clipped without an ellipsis
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (clipped.length >= 5) break;
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 3 && cs.textOverflow !== 'ellipsis' && visible(el) && !el.closest('.app-sidebar')) {
      clipped.push(describe(el));
    }
  }
  out.clippedText = clipped;

  out.lowContrast = []; // text contrast is audited for both themes by textContrastAudit (e2e/helpers/themeContrast.js)

  out.placeholderText = (document.body.innerText.match(/Top 12%|2,840|1,420|367 |Nagappa|Mallikarjun|Prashant Chinnanagoudar|Tech Corporation|Verified Drive|TCS TCS|Offline practice|Application simulated|resilient fallback/g) || []).slice(0, 4);
  out.bodyTextLength = document.body.innerText.trim().length;
  out.hasAlertOrMain = Boolean(document.querySelector('main, [role="alert"], form, h1'));
  return out;
}

// ---- one page visit ----------------------------------------------------------------------------------------------
async function visit(page, role, route, width) {
  try {
    await visitInner(page, role, route, width);
  } catch (err) {
    note('fatal', role, route, width, 'visit-failed', String(err.message).split('\n')[0]);
  }
}

async function visitInner(page, role, route, width) {
  const consoleErrors = [];
  const apiNotes = [];
  const onConsole = (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location().url || '';
    const text = m.text();
    if (/accounts\.google\.com|GSI_LOGGER/.test(loc + text)) { note('external', role, route, width, 'google', 'Google sign-in refused this origin (configure Google Cloud)'); return; }
    if (/Failed to load resource/.test(text) && /\/api\//.test(loc)) { apiNotes.push(`${text.replace('Failed to load resource: ', '')} ${new URL(loc).pathname}`); return; }
    consoleErrors.push(text);
  };
  const onPageError = (e) => consoleErrors.push(`pageerror: ${e.message}`);
  const onFailed = (r) => { if (!/accounts\.google\.com|fonts\.(googleapis|gstatic)/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED') apiNotes.push(`request failed ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`); };
  const onResponse = (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 500) consoleErrors.push(`API ${r.status()} ${u.pathname}`); else if (u.pathname.startsWith('/api/') && r.status() >= 400) apiNotes.push(`API ${r.status()} ${u.pathname}`); };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);

  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(900); // entrance animations
  // sections that fade in when scrolled into view: walk down the page once, then let every fade finish, so colours are measured at rest
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); }
    window.scrollTo(0, document.documentElement.scrollHeight); // the very bottom too
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1600);
  const m = await page.evaluate(measure, { breakpoint: BREAKPOINT });
  const themeOnDcl = await page.evaluate(() => window.__themeAtDCL);
  const themeNow = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const text = await page.evaluate(textContrastAudit);
  const selects = await page.evaluate(selectContrastAudit); // every <select> option must be readable (>= 4.5:1)
  for (const v of selects.violations) note('fatal', role, route, width, 'select-contrast', v);
  selectsChecked += selects.selects;
  optionsChecked += selects.options;

  const file = path.join(OUT, currentTheme, role, slug(route), `${width}.jpg`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 70 });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('requestfailed', onFailed);
  page.off('response', onResponse);

  const F = (kind, detail) => note('fatal', role, route, width, kind, detail);
  const W = (kind, detail) => note('warn', role, route, width, kind, detail);

  if (themeOnDcl !== currentTheme) F('theme-flash', `data-theme was "${themeOnDcl}" at DOMContentLoaded, expected "${currentTheme}"`);
  if (themeNow !== currentTheme) F('theme-not-applied', `data-theme is "${themeNow}", expected "${currentTheme}"`);
  for (const v of text.violations.slice(0, 8)) F('text-contrast', v);
  if (text.skipped) W('contrast-unjudged', `${text.skipped} text element(s) sit on a gradient or image and were not measured (e.g. ${text.skippedSamples.slice(0, 3).join(' | ')})`);
  if (m.scrollW > m.clientW + 1) F('horizontal-scroll', `scrollWidth ${m.scrollW} > clientWidth ${m.clientW}; offenders: ${m.sticking.join(' | ') || 'n/a'}`);
  else if (m.sticking.length) W('overflow-right', m.sticking.join(' | '));
  for (const e of [...new Set(consoleErrors)].slice(0, 4)) F('console-error', e);
  if (width > BREAKPOINT && m.mobileTopbars > 0) F('mobile-header-on-desktop', `${m.mobileTopbars} mobile header(s) visible at ${width}px`);

  const hasShell = Boolean(m.sidebar);
  if (hasShell && width > BREAKPOINT) {
    const s = m.sidebar;
    if (!(s.left === 0 && s.width === SIDEBAR && s.visible)) F('desktop-sidebar', `expected fixed ${SIDEBAR}px sidebar at x=0, got left=${s.left} width=${s.width}`);
    if (s.bottom < heightFor(width) - 1) F('desktop-sidebar-clipped', `sidebar spans y=${s.top}..${s.bottom}`);
    if (m.mainLeft !== SIDEBAR) F('desktop-gutter', `content starts at x=${m.mainLeft}, expected ${SIDEBAR} (white gutter or overlap)`);
  }
  if (hasShell && width <= BREAKPOINT) {
    if (m.mobileTopbars !== 1) F('mobile-header-missing', `expected 1 top bar, found ${m.mobileTopbars}`);
    if (m.mainLeft !== 0) F('mobile-margin', `content has left offset ${m.mainLeft}px at ${width}px`);
    if (m.sidebar.visible && m.sidebar.right > 0) F('mobile-sidebar-open-by-default', 'sidebar visible while closed');
  }
  if (m.brokenImages.length) W('broken-image', m.brokenImages.join(' | '));
  if (m.clippedText.length) W('clipped-text', m.clippedText.join(' | '));
  if (m.lowContrast.length) W('low-contrast', m.lowContrast.join(' | '));
  if (m.placeholderText.length) W('placeholder-data', `fake or repeated text visible: ${[...new Set(m.placeholderText)].join(', ')}`);
  if (m.bodyTextLength < 30) W('blank-page', `only ${m.bodyTextLength} characters of text`);
  for (const n of [...new Set(apiNotes)].slice(0, 4)) note('info', role, route, width, 'api-status', n);
  visits.push({ role, route, width, hasShell });
}

// ---- mobile drawer behaviour -------------------------------------------------------------------------------------------
async function drawerChecks(page, role, route, width) {
  try {
    await drawerChecksInner(page, role, route, width);
  } catch (err) {
    note('fatal', role, route, width, 'drawer', String(err.message).split('\n')[0]);
  }
}

async function drawerChecksInner(page, role, route, width) {
  const F = (kind, detail) => note('fatal', role, route, width, kind, detail);
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const toggle = page.getByRole('button', { name: /Open navigation menu/ });
  const sidebar = page.locator('.app-sidebar');
  const box = async () => sidebar.boundingBox();
  const bannerHeight = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--banner-height')) || 0);
  const isOpen = async () => { const b = await box(); const v = await sidebar.isVisible(); return v && b && b.x >= -1 && b.x + b.width <= width + 1; };

  if (await isOpen()) F('drawer', 'sidebar visible before opening');
  await toggle.click();
  await page.waitForTimeout(450);
  if (!(await isOpen())) F('drawer', 'sidebar did not open');
  else {
    const b = await box();
    if (b.x < -1 || b.width > width * 0.9 + 1 || b.height < heightFor(width) - (await bannerHeight()) - 2) F('drawer-clipped', `sidebar box x=${Math.round(b.x)} w=${Math.round(b.width)} h=${Math.round(b.height)}`);
    await page.screenshot({ path: path.join(OUT, currentTheme, role, `drawer-open-${width}.jpg`), type: 'jpeg', quality: 70 });
  }
  await expect(page.getByTestId('sidebar-backdrop')).toBeVisible();
  await page.mouse.click(width - 8, 300); // a point on the backdrop, outside the drawer
  await page.waitForTimeout(450);
  if (await isOpen()) F('drawer', 'backdrop click did not close the sidebar');

  await page.getByRole('button', { name: /Open navigation menu/ }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  if (await isOpen()) F('drawer', 'Escape did not close the sidebar');

  await page.getByRole('button', { name: /Open navigation menu/ }).click();
  await page.waitForTimeout(400);
  await sidebar.locator('a[href]').nth(1).click();
  await page.waitForTimeout(900);
  if (await isOpen()) F('drawer', 'route change did not close the sidebar');
}

// the saved theme is what the no-flash script reads; __themeAtDCL records what <html> said when the DOM was parsed
async function themed(context, theme) {
  await context.addInitScript((value) => {
    try { localStorage.setItem('skillsense-theme', value); } catch { /* blocked */ }
    document.addEventListener('DOMContentLoaded', () => { window.__themeAtDCL = document.documentElement.getAttribute('data-theme'); });
  }, theme);
}

// ---- setup / teardown ----------------------------------------------------------------------------------------------------
test.use({ headless: true, launchOptions: { slowMo: 0 }, actionTimeout: 15000, navigationTimeout: 30000 }); // never hang: Playwright's defaults are unlimited // the audit is long; no artificial delay between actions
test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test.beforeAll(async ({ browser }) => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: 'UI Audit Student', email, password } });
  expect(res.status(), 'registering the audit student').toBe(201);
  await ctx.close(); // each width signs in on its own: refresh cookies rotate, so one saved cookie cannot be replayed by three contexts
});

test.afterAll(() => {
  let cleanup;
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  const fatal = issues.filter((i) => i.severity === 'fatal');
  const warn = issues.filter((i) => i.severity === 'warn');
  const info = issues.filter((i) => i.severity === 'info');
  const external = [...new Map(issues.filter((i) => i.severity === 'external').map((i) => [i.kind + i.detail, i])).values()];
  const group = (list) => {
    const byKey = new Map();
    for (const i of list) {
      const k = `${i.kind} | ${i.theme} | ${i.role} ${i.route} | ${i.detail}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(i.width);
    }
    return [...byKey.entries()].map(([k, w]) => `- ${k}  [${w.join(', ')}px]`);
  };
  const md = [
    '# UI audit', '',
    `Select contrast: ${selectsChecked} selects and ${optionsChecked} options checked against 4.5:1 (violations are listed as fatal).`, '',
    `Visits: ${visits.length} (${THEMES.join(' + ')} themes at ${WIDTHS.join(', ')}px). Admin: ${useRealAdmin ? 'real admin account' : 'STUBBED admin session (layout checks only)'}.`,
    `Fatal: ${fatal.length}   Warnings: ${warn.length}   API-status notes: ${info.length}   External: ${external.length}`, '',
    '## Fatal', ...(group(fatal).length ? group(fatal) : ['- none']), '',
    '## Warnings', ...(group(warn).length ? group(warn) : ['- none']), '',
    '## API status notes (expected 4xx such as "no assessment yet")', ...(group(info).length ? group(info) : ['- none']), '',
    '## External', ...(external.length ? external.map((i) => `- ${i.detail}`) : ['- none']), '',
    `Cleanup: ${cleanup}`,
  ];
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ visits: visits.length, fatal, warn, info, external }, null, 1));
  console.log(`\n${md.slice(0, 4).join('\n')}\nFull report: e2e/screenshots/ui/report.md\n`);
});

test('UI audit: every route at every width in both themes', async ({ browser }) => {
  for (const theme of THEMES) for (const width of WIDTHS) {
    currentTheme = theme;
    const viewport = { width, height: heightFor(width) };

    const guest = await browser.newContext({ viewport });
    await themed(guest, theme);
    const gp = await guest.newPage();
    for (const route of GUEST) await visit(gp, 'guest', route, width);
    await guest.close();

    const student = await browser.newContext({ viewport });
    await themed(student, theme);
    const signedIn = await student.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
    expect(signedIn.status(), 'signing the audit student in').toBe(200);
    await student.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
    const sp = await student.newPage();
    for (const route of STUDENT) await visit(sp, 'student', route, width);
    if (width <= BREAKPOINT) await drawerChecks(sp, 'student', '/dashboard', width);
    await student.close();

    const admin = await browser.newContext({ viewport });
    await themed(admin, theme);
    const ap = await admin.newPage();
    if (useRealAdmin) {
      await ap.goto(`${BASE}/admin/login`);
      await ap.locator('input[type="email"]').fill(process.env.ADMIN_TEST_EMAIL);
      await ap.locator('input[type="password"]').evaluate((el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, process.env.ADMIN_TEST_PASSWORD);
      await ap.getByRole('button', { name: /Access Admin/ }).click();
      await ap.waitForURL('**/admin/dashboard', { timeout: 30000 });
    } else {
      await admin.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
      const adminUser = { id: 'usr-admin-stub', name: 'Audit Admin', email: 'audit-admin@example.com', role: 'admin', email_verified: true, has_password: true, auth_provider: 'password' };
      await admin.route('**/api/auth/refresh', (r) => r.fulfill({ json: { access_token: 'stub', token_type: 'bearer', user: adminUser } }));
      await admin.route('**/api/auth/me', (r) => r.fulfill({ json: adminUser }));
      await admin.route(/\/api\/(?!auth\/)/, (r) => {
        const p = new URL(r.request().url()).pathname;
        const zeros = { total_students: 0, question_papers_count: 0, extracted_questions_count: 0, active_assessments_count: 0, verified_companies_count: 0, repeated_patterns_count: 0, managed_papers_count: 0, registered_students_count: 0, average_readiness_score: 0, active_placement_drives: 0 };
        r.fulfill({ json: /dashboard|analytics/.test(p) ? zeros : [] });
      });
    }
    for (const route of ADMIN) await visit(ap, 'admin', route, width);
    if (width <= BREAKPOINT) await drawerChecks(ap, 'admin', '/admin/dashboard', width);
    await admin.close();
  }

  const fatal = issues.filter((i) => i.severity === 'fatal');
  const sample = fatal.slice(0, 12).map((i) => `${i.kind} ${i.role} ${i.route} @${i.width}: ${i.detail}`);
  expect(fatal.length, `fatal UI issues:\n${sample.join('\n')}`).toBe(0);
});
