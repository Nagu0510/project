// P13: dark and light mode on every page, in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p13-theme
// Persistence and no-flash, keyboard-only toggle, reduced motion, then full-page screenshots of every route in both themes at 1280 and 390px
// (e2e/screenshots/p13/<role>-<page>-<theme>-<width>.png) plus the UI states: a focused input, a modal, a toast, an error banner, an empty
// state, a table row on hover, the notification drawer, the Practice Arena editor with a verdict, the 3D roadmap switching theme inside the SAME
// renderer, and a resume scan result.
// Student: a throw-away registered account (deleted at the end, password generated here, never printed).
// Admin: ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD when both are set; otherwise a STUBBED admin session (layout and colour checks, fake rows made
// by this test only) and the report says so. No credential is hard-coded or printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p13');
const FIXTURES = path.join(root, 'backend', 'tests', 'fixtures');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const BASE = 'http://localhost:5173';
const email = `p3-test-p13-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const realAdmin = Boolean(process.env.ADMIN_TEST_EMAIL && process.env.ADMIN_TEST_PASSWORD);

const THEMES = ['light', 'dark'];
const WIDTHS = [1280, 390];
const PUBLIC = [['landing', '/'], ['login', '/login'], ['signup', '/signup'], ['forgot-password', '/forgot-password'], ['features', '/features'], ['about', '/about'], ['career-paths', '/career-paths'], ['courses', '/courses'], ['admin-login', '/admin/login'], ['not-found', '/no-such-page']];
const STUDENT = [['dashboard', '/dashboard'], ['roadmap', '/roadmap?track=Backend%20Developer'], ['practice', '/practice'], ['resume-analyzer', '/resume-analyzer'], ['resume-practice', '/resume-practice'], ['assessment', '/assessment'], ['assessment-results', '/assessment-results'], ['courses', '/courses'], ['previous-questions', '/previous-questions'], ['company-prep', '/company-prep/tcs'], ['profile', '/profile'], ['settings', '/settings'], ['placements', '/placements']];
const ADMIN = [['dashboard', '/admin/dashboard'], ['question-papers', '/admin/question-papers'], ['question-bank', '/admin/question-bank'], ['assessments', '/admin/assessments'], ['content', '/admin/content'], ['companies', '/admin/companies'], ['students', '/admin/students'], ['analytics', '/admin/analytics'], ['settings', '/admin/settings']];

const results = [];
const consoleLog = [];
const NOISE = /google|gsi|accounts\.google|Failed to load resource|React Router Future Flag|net::ERR/i;
let browser;

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 280);
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleLog.push(`error: ${m.text().slice(0, 160)}`); });
  p.on('pageerror', (e) => consoleLog.push(`pageerror: ${e.message.slice(0, 160)}`));
};

// the saved theme is what the no-flash script reads; __themeAtDCL records what <html> said when the DOM was parsed
async function newContext(theme, width, { colorScheme } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 480 ? 844 : 900 }, ...(colorScheme ? { colorScheme } : {}) });
  if (theme) {
    await ctx.addInitScript((value) => {
      try { if (!sessionStorage.getItem('__p13_seeded')) { localStorage.setItem('skillsense-theme', value); sessionStorage.setItem('__p13_seeded', '1'); } } catch { /* blocked */ }
    }, theme);
  }
  await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { window.__themeAtDCL = document.documentElement.getAttribute('data-theme'); }); });
  return ctx;
}

async function signIn(ctx) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.status(), 'signing the test student in').toBe(200);
  await ctx.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
}

async function adminContext(theme, width) {
  const ctx = await newContext(theme, width);
  const page = await ctx.newPage();
  watch(page);
  if (realAdmin) {
    await page.goto(`${BASE}/admin/login`);
    await page.locator('input[type="email"]').fill(process.env.ADMIN_TEST_EMAIL);
    await page.locator('input[type="password"]').evaluate((el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, process.env.ADMIN_TEST_PASSWORD);
    await page.getByRole('button', { name: /Access Admin/ }).click();
    await page.waitForURL('**/admin/dashboard', { timeout: 30000 });
  } else {
    await ctx.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
    const adminUser = { id: 'usr-admin-stub', name: 'Test Admin', email: 'test-admin@example.com', role: 'admin', email_verified: true, has_password: true, auth_provider: 'password' };
    await ctx.route('**/api/auth/refresh', (r) => r.fulfill({ json: { access_token: 'stub', token_type: 'bearer', user: adminUser } }));
    await ctx.route('**/api/auth/me', (r) => r.fulfill({ json: adminUser }));
    await ctx.route(/\/api\/(?!auth\/)/, (r) => {
      const p = new URL(r.request().url()).pathname;
      if (/admin\/students$/.test(p)) {
        r.fulfill({ json: [1, 2, 3].map((n) => ({ id: `s${n}`, name: `Test Student ${n}`, email: `student${n}@example.com`, current_path: n === 3 ? '' : 'Backend Developer', readiness_score: [92, 74, 31][n - 1], assessments_completed: n, attempts: n * 2, problems_solved: n, problems_attempted: n + 1 })) });
        return;
      }
      const zeros = { total_students: 0, question_papers_count: 0, extracted_questions_count: 0, active_assessments_count: 0, verified_companies_count: 0, repeated_patterns_count: 0, managed_papers_count: 0, registered_students_count: 0, average_readiness_score: 0, active_placement_drives: 0 };
      r.fulfill({ json: /dashboard|analytics/.test(p) ? zeros : [] });
    });
  }
  return { ctx, page };
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900); // entrance animations
  // sections that fade in when scrolled into view: walk down the page once so a full-page screenshot shows them
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, document.documentElement.scrollHeight); // the very bottom too
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

const shotName = (role, name, theme, width) => path.join(SHOTS, `${role}-${name}-${theme}-${width}.png`);
async function shoot(page, role, name, theme, width, full = true) {
  await page.screenshot({ path: shotName(role, name, theme, width), fullPage: full });
}

async function themeOf(page) { return page.evaluate(() => document.documentElement.getAttribute('data-theme')); }

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: 'P13 Test Student', email, password } });
  expect(res.status(), 'registering the test student').toBe(201);
  await ctx.close();
});

test.afterAll(async () => {
  let cleanup = '';
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  console.log(`\n  Cleanup: ${cleanup}`);
  console.log(`  Admin: ${realAdmin ? 'real admin account' : 'STUBBED admin session (ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD not set)'}`);
  console.log(`  Console errors seen: ${consoleLog.length ? [...new Set(consoleLog)].join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
  console.log(`  Screenshots: ${fs.readdirSync(SHOTS).length} files in e2e/screenshots/p13/`);
  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed, `failed steps: ${failed.map((f) => f.id).join(', ')}`).toEqual([]);
});

test('dark and light mode work everywhere', async () => {
  // ---------------------------------------------------------------------------------------------------- persistence
  await step('01', 'Default follows the OS (System); no saved value is needed', async () => {
    for (const scheme of ['light', 'dark']) {
      const ctx = await newContext(null, 1280, { colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`);
      expect(await themeOf(page)).toBe(scheme);
      expect(await page.evaluate(() => window.__themeAtDCL)).toBe(scheme); // already set when the DOM was parsed: no flash
      await ctx.close();
    }
    return 'light and dark OS settings both honoured';
  });

  await step('02', 'Choose Dark in Settings: it survives a reload (no flash) and shows in a new tab', async () => {
    const ctx = await newContext(null, 1280, { colorScheme: 'light' });
    await signIn(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`);
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByTestId('theme-option-dark').click();
    expect(await themeOf(page)).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('skillsense-theme'))).toBe('dark');
    await page.reload();
    expect(await page.evaluate(() => window.__themeAtDCL), 'dark at DOMContentLoaded after reload').toBe('dark');
    const other = await ctx.newPage();
    await other.goto(`${BASE}/login`);
    expect(await other.evaluate(() => window.__themeAtDCL), 'dark in a new tab').toBe('dark');
    // the OS setting is ignored while a manual choice is saved
    await other.emulateMedia({ colorScheme: 'light' });
    await other.waitForTimeout(400);
    expect(await themeOf(other)).toBe('dark');
    // back to System: the OS wins, and a later OS change is followed live
    await page.goto(`${BASE}/settings`);
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByTestId('theme-option-system').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => themeOf(page)).toBe('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => themeOf(page)).toBe('light');
    await ctx.close();
    return 'persisted, no flash, new tab, System follows the OS live';
  });

  await step('03', 'Another tab changing the theme updates this tab (storage event)', async () => {
    const ctx = await newContext('light', 1280);
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await a.goto(`${BASE}/login`);
    await b.goto(`${BASE}/login`);
    await b.evaluate(() => localStorage.setItem('skillsense-theme', 'dark')); // the browser tells the OTHER tab (a) through a storage event
    await expect.poll(() => themeOf(a), { timeout: 5000 }).toBe('dark');
    await ctx.close();
    return 'tab A followed the change made in tab B';
  });

  await step('04', 'The toggle works with the keyboard only and has a screen-reader name', async () => {
    const ctx = await newContext('light', 1280);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    const toggle = page.getByTestId('theme-toggle').first();
    await expect(toggle).toHaveAttribute('aria-label', 'Theme: Light. Click to switch to Dark');
    await toggle.focus();
    await expect(toggle).toBeFocused();
    const ring = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
    expect(ring, 'a visible focus ring').not.toMatch(/^none/);
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-label', 'Theme: Dark. Click to switch to System');
    expect(await themeOf(page)).toBe('dark');
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-label', 'Theme: System. Click to switch to Light');
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-label', 'Theme: Light. Click to switch to Dark');
    expect(await themeOf(page)).toBe('light');
    await ctx.close();
    return 'Enter and Space cycle Light, Dark, System';
  });

  await step('05', 'prefers-reduced-motion removes the colour transition; normal motion fades colours', async () => {
    const ctx = await newContext('light', 1280);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('theme-toggle').first().click();
    const during = await page.evaluate(() => ({ switching: document.documentElement.classList.contains('theme-switching'), body: getComputedStyle(document.body).transitionDuration }));
    expect(during.switching, 'the fade class is on <html> while switching').toBe(true);
    expect(during.body).toContain('0.2s');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.documentElement.classList.contains('theme-switching'))).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('theme-toggle').first().click();
    const reduced = await page.evaluate(() => getComputedStyle(document.body).transitionDuration);
    expect(parseFloat(reduced), `reduced motion duration ${reduced}`).toBeLessThan(0.001);
    await ctx.close();
    return `no-preference 0.2s, reduce ${reduced}`;
  });

  await step('06', 'Print stays light', async () => {
    const ctx = await newContext('dark', 1280);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500); // the body colour fades for 200 ms when the media changes
    const colours = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }));
    expect(colours.bg).toBe('rgb(255, 255, 255)');
    await ctx.close();
    return `print: ${colours.bg} on ${colours.fg}`;
  });

  // ---------------------------------------------------------------------------------------------------- screenshots
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      await step(`07-${theme}-${width}`, `Public pages, ${theme}, ${width}px`, async () => {
        const ctx = await newContext(theme, width);
        const page = await ctx.newPage();
        watch(page);
        for (const [name, route] of PUBLIC) {
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
          await settle(page);
          expect(await themeOf(page), `${route} theme`).toBe(theme);
          await shoot(page, 'public', name, theme, width);
        }
        await ctx.close();
        return `${PUBLIC.length} pages`;
      });

      await step(`08-${theme}-${width}`, `Student pages, ${theme}, ${width}px`, async () => {
        const ctx = await newContext(theme, width);
        await signIn(ctx);
        const page = await ctx.newPage();
        watch(page);
        for (const [name, route] of STUDENT) {
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
          await settle(page);
          await shoot(page, 'student', name, theme, width);
        }
        await ctx.close();
        return `${STUDENT.length} pages`;
      });

      await step(`09-${theme}-${width}`, `Admin pages, ${theme}, ${width}px`, async () => {
        const { ctx, page } = await adminContext(theme, width);
        for (const [name, route] of ADMIN) {
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
          await settle(page);
          await shoot(page, 'admin', name, theme, width);
        }
        await ctx.close();
        return `${ADMIN.length} pages${realAdmin ? '' : ' (stubbed session)'}`;
      });
    }
  }

  // ---------------------------------------------------------------------------------------------------- UI states
  for (const theme of THEMES) {
    await step(`10-${theme}`, `UI states, ${theme}`, async () => {
      const ctx = await newContext(theme, 1280);
      await signIn(ctx);
      const page = await ctx.newPage();
      watch(page);
      const notes = [];

      // focused input
      await page.goto(`${BASE}/login`);
      await settle(page);
      await page.locator('input[type="email"]').focus();
      await shoot(page, 'state', 'focused-input', theme, 1280, false);

      // toast + save
      await page.goto(`${BASE}/settings`);
      await settle(page);
      await page.getByRole('button', { name: /Save Preferences/ }).click();
      await page.waitForTimeout(500);
      await shoot(page, 'state', 'toast', theme, 1280, false);

      // appearance section with its preview card
      await page.getByRole('button', { name: 'Appearance' }).click();
      await page.waitForTimeout(300);
      await shoot(page, 'state', 'appearance', theme, 1280, false);

      // notification drawer
      await page.goto(`${BASE}/dashboard`);
      await settle(page);
      await page.getByRole('button', { name: 'Notifications' }).first().click();
      await page.waitForTimeout(500);
      await shoot(page, 'state', 'notification-drawer', theme, 1280, false);
      await page.keyboard.press('Escape');

      // empty state
      await page.goto(`${BASE}/resume-analyzer`);
      await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 30000 });
      await shoot(page, 'state', 'empty-state', theme, 1280, false);

      // error banner: the courses request fails
      await page.route('**/api/courses**', (r) => r.fulfill({ status: 500, json: { detail: 'forced failure for the screenshot' } }));
      await page.goto(`${BASE}/courses`);
      await settle(page);
      await shoot(page, 'state', 'error-banner', theme, 1280, false);
      await page.unroute('**/api/courses**');

      // Practice Arena: modal, drawer, editor and a verdict
      await page.goto(`${BASE}/practice`);
      await expect(page.getByTestId('pa-run')).toBeVisible({ timeout: 30000 });
      await settle(page);
      await shoot(page, 'state', 'practice-editor', theme, 1280, false);
      await page.getByTestId('pa-problem-list').click();
      await page.waitForTimeout(500);
      await shoot(page, 'state', 'practice-problem-drawer', theme, 1280, false);
      await page.keyboard.press('Escape');
      await page.getByTestId('pa-reset').click();
      await page.waitForTimeout(400);
      await shoot(page, 'state', 'modal', theme, 1280, false);
      await page.getByTestId('pa-reset-cancel').click();
      await page.getByTestId('pa-run').click();
      await expect(page.getByTestId('pa-tab-result')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 120000 });
      notes.push(`verdict: ${(await page.getByTestId('pa-result-status').innerText().catch(() => 'none')).slice(0, 40)}`);
      await shoot(page, 'state', 'practice-verdict', theme, 1280, false);

      await ctx.close();
      return notes.join('; ');
    });

    await step(`11-${theme}`, `Admin table hover, ${theme}`, async () => {
      const { ctx, page } = await adminContext(theme, 1280);
      await page.goto(`${BASE}/admin/students`);
      await settle(page);
      const row = page.locator('tbody tr').first();
      if (await row.count()) { await row.hover(); await page.waitForTimeout(300); }
      await shoot(page, 'state', 'table-hover', theme, 1280, false);
      await ctx.close();
      return realAdmin ? 'real data' : 'stubbed rows';
    });

    await step(`12-${theme}`, `Resume scan result, ${theme}`, async () => {
      const ctx = await newContext(theme, 1280);
      await signIn(ctx);
      const page = await ctx.newPage();
      watch(page);
      await page.goto(`${BASE}/resume-analyzer`);
      await expect(page.getByTestId('resume-file-input')).toBeAttached({ timeout: 30000 });
      await page.getByTestId('resume-role').selectOption({ label: 'Backend Developer' });
      await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
      await expect(page.getByTestId('report')).toBeVisible({ timeout: 120000 });
      await settle(page);
      await shoot(page, 'state', 'resume-result', theme, 1280);
      await ctx.close();
      return 'report drawn';
    });
  }

  // ---------------------------------------------------------------------------------------------------- 3D in place
  await step('13', '3D roadmap and landing core change theme inside the SAME renderer (no new WebGL context)', async () => {
    const ctx = await newContext('light', 1280);
    await ctx.addInitScript(() => {
      window.__gl = { created: 0 };
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
        const gl = original.call(this, type, ...rest);
        if (gl && /webgl/.test(type) && !this.__counted) { this.__counted = true; window.__gl.created += 1; }
        return gl;
      };
    });
    await signIn(ctx);
    const page = await ctx.newPage();
    watch(page);
    await page.goto(`${BASE}/roadmap?track=Backend%20Developer`);
    const panel = page.getByTestId('roadmap-3d');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    const stage = page.getByTestId('roadmap-3d-stage');
    await expect(stage).toHaveAttribute('data-theme', 'light');
    await expect(stage.getByTestId('roadmap-3d-label').first()).toBeAttached({ timeout: 30000 });
    await page.evaluate(() => { document.querySelector('[data-testid="roadmap-3d-stage"] canvas').__marker = 'same-canvas'; });
    const before = Number(await stage.getAttribute('data-frames'));
    await panel.screenshot({ path: shotName('state', 'roadmap-3d', 'light', 1280) });
    const labelBg = () => page.evaluate(() => getComputedStyle(document.querySelector('.rm3d-label[data-state="completed"], .rm3d-label')).backgroundColor);
    const lightChip = await labelBg();
    const contextsBefore = await page.evaluate(() => window.__gl.created); // dev StrictMode may have built and disposed one before this point
    await page.getByTestId('theme-toggle').first().click(); // light -> dark
    await expect(stage).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });
    await page.waitForTimeout(800);
    await panel.screenshot({ path: shotName('state', 'roadmap-3d', 'dark', 1280) });
    const darkChip = await labelBg();
    const same = await page.evaluate(() => document.querySelector('[data-testid="roadmap-3d-stage"] canvas').__marker);
    const contexts = await page.evaluate(() => window.__gl.created);
    const after = Number(await stage.getAttribute('data-frames'));
    expect(same, 'the canvas element is the same node').toBe('same-canvas');
    expect(contexts, 'WebGL contexts created by the theme switch').toBe(contextsBefore);
    expect(after).toBeGreaterThan(before);
    expect(lightChip).not.toBe(darkChip);
    await expect(panel).toHaveAttribute('data-generation', '0');
    // landing core
    await page.goto(`${BASE}/`);
    const core = page.getByTestId('core-3d');
    await expect(core).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await ctx.close();
    return `${contexts} contexts before and after the switch, same canvas, frames ${before} -> ${after}, chip ${lightChip} -> ${darkChip}`;
  });

  await step('14', 'Dark 3D ribbon on a phone-sized screen', async () => {
    const ctx = await newContext('dark', 390);
    await signIn(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/roadmap?track=Backend%20Developer`);
    const panel = page.getByTestId('roadmap-3d');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await page.waitForTimeout(800);
    await panel.screenshot({ path: shotName('state', 'roadmap-3d', 'dark', 390) });
    await ctx.close();
    return 'ok';
  });
});
