// P14: demo data on the admin analytics, the CSV exports, the daily challenge with a streak, and "My submissions", in a real (headed) Chrome
// against the real app and real Atlas, in both themes.
//   npx playwright test -c e2e/playwright.config.js p14-improvements
// 1. seeds the demo students with backend/scripts/seed_demo_data.py --yes (and removes ONLY them again at the end with --reset)
// 2. admin Analytics: cards, readiness distribution, weakest skills, activity chart, both themes at 1280 and 390px, both CSV downloads
//    (the files are read and checked for the header, demo rows and the absence of password / token data)
// 3. a throw-away student: the Daily Challenge card on the dashboard, the Practice Arena chip, a wrong then a correct submission of the daily
//    problem (real online judge), the streak going from 0 to 1, the profile badges
// 4. My submissions: filters by verdict / language / difficulty, opening the submitted code, and another student getting a 404 for it
// Admin: ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD when both are set. Otherwise the browser session is stubbed AND the analytics / export responses
// are the REAL ones, computed by the real backend code on the real database (e2e/helpers/p14_admin_payloads.py); the report says so.
// Passwords are generated here and never printed. Screenshots: e2e/screenshots/p14/.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p14');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const BASE = 'http://localhost:5173';
const stamp = Date.now();
const mk = (tag) => ({ email: `p3-test-p14${tag}-${stamp}@example.com`, password: `Aa1-${crypto.randomBytes(9).toString('base64url')}` });
const A = mk('a');
const B = mk('b');
const realAdmin = Boolean(process.env.ADMIN_TEST_EMAIL && process.env.ADMIN_TEST_PASSWORD);

const results = [];
const consoleLog = [];
const NOISE = /google|gsi|accounts\.google|Failed to load resource|React Router Future Flag|net::ERR/i;
let browser;
let payloads = null;

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 300);
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleLog.push(`error: ${m.text().slice(0, 160)}`); });
  p.on('pageerror', (e) => consoleLog.push(`pageerror: ${e.message.slice(0, 160)}`));
};

const py = (args, cwd = root) => execFileSync(PY, args, { cwd, maxBuffer: 64 * 1024 * 1024 }).toString();
const backend = path.join(root, 'backend');

async function newContext(theme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 480 ? 844 : 900 } });
  await ctx.addInitScript((value) => {
    try { if (!sessionStorage.getItem('__p14_seeded')) { localStorage.setItem('skillsense-theme', value); sessionStorage.setItem('__p14_seeded', '1'); } } catch { /* blocked */ }
  }, theme);
  return ctx;
}

async function apiLogin(ctx, who) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, { data: who });
  expect(res.status(), 'signing in').toBe(200);
  return (await res.json()).access_token;
}

async function studentContext(theme, width, who = A) {
  const ctx = await newContext(theme, width);
  const token = await apiLogin(ctx, who);
  await ctx.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
  return { ctx, token };
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
    await ctx.route('**/api/admin/analytics', (r) => r.fulfill({ json: payloads.analytics }));
    await ctx.route('**/api/admin/students', (r) => r.fulfill({ json: payloads.students }));
    const csv = (body, name) => (r) => r.fulfill({ status: 200, body, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'access-control-expose-headers': 'content-disposition' } });
    await ctx.route('**/api/admin/students/export.csv', csv(payloads.students_csv, 'students.csv'));
    await ctx.route('**/api/admin/assessment-results/export.csv', csv(payloads.results_csv, 'assessment-results.csv'));
  }
  return { ctx, page };
}

const shot = (page, name, full = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
}

// no sideways page scroll; on failure the message names the elements that stick out past the right edge
async function expectNoSidewaysScroll(page, label = '') {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.right <= vw + 1 || el.closest('.app-sidebar')) continue;
      let scroller = false;
      for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = true; break; } }
      if (!scroller && offenders.length < 5) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} right=${Math.round(box.right)}`);
    }
    return { ok: document.documentElement.scrollWidth <= vw, scrollWidth: document.documentElement.scrollWidth, vw, offenders };
  });
  expect(r.ok, `${label} sideways scroll ${r.scrollWidth} > ${r.vw}: ${r.offenders.join(' | ')}`).toBe(true);
}
// change a filter and wait for the page of results that answers it (the list is fetched again on every change)
async function filterBy(page, testId, value) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/practice/submissions?') && r.request().method() === 'GET' && r.ok()),
    page.getByTestId(testId).selectOption(value),
  ]);
  await page.waitForTimeout(150);
}
async function setCode(page, code) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Control+A');
  await content.evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, code);
}
async function submitCode(page) {
  await page.getByTestId('pa-submit').click();
  await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 150000 });
  return (await page.getByTestId('pa-result-status').innerText()).trim();
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  console.log(`  Seeding demo data: ${py(['scripts/seed_demo_data.py', '--yes'], backend).trim().split('\n')[0].slice(0, 200)}`);
  const ctx = await browser.newContext();
  for (const [who, name] of [[A, 'P14 Test Student A'], [B, 'P14 Test Student B']]) {
    const res = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name, email: who.email, password: who.password } });
    expect(res.status(), 'registering a test student').toBe(201);
  }
  await ctx.close();
  if (!realAdmin) {
    const out = py([path.join('e2e', 'helpers', 'p14_admin_payloads.py')]);
    payloads = JSON.parse(out.slice(out.indexOf('{')));
  }
});

test.afterAll(async () => {
  const notes = [];
  try { notes.push(`demo reset: ${py(['scripts/seed_demo_data.py', '--yes', '--reset'], backend).trim()}`); } catch (err) { notes.push(`demo reset FAILED: ${String(err.message).split('\n')[0]}`); }
  for (const who of [A, B]) {
    try { notes.push(`cleanup: ${py([path.join('e2e', 'helpers', 'cleanup_test_user.py'), who.email]).trim()}`); } catch (err) { notes.push(`cleanup FAILED: ${String(err.message).split('\n')[0]}`); }
  }
  console.log(`\n  ${notes.join('\n  ')}`);
  console.log(`  Admin: ${realAdmin ? 'real admin account' : 'STUBBED session, REAL analytics and CSV responses computed by the backend code on the real database'}`);
  console.log(`  Console errors seen: ${consoleLog.length ? [...new Set(consoleLog)].join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
  console.log(`  Screenshots: ${fs.readdirSync(SHOTS).length} files in e2e/screenshots/p14/`);
  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed, `failed steps: ${failed.map((f) => f.id).join(', ')}`).toEqual([]);
});

test('improvement pack 1 works end to end', async () => {
  const THEMES = ['light', 'dark'];

  // ------------------------------------------------------------------------------------------------ admin analytics, both themes
  for (const theme of THEMES) {
    await step(`01-${theme}`, `Admin Analytics shows the demo data (${theme})`, async () => {
      const { ctx, page } = await adminContext(theme, 1280);
      await page.goto(`${BASE}/admin/analytics`);
      await expect(page.getByTestId('analytics-cards')).toBeVisible({ timeout: 30000 });
      await settle(page);
      const total = Number(await page.getByTestId('card-total-value').innerText());
      expect(total, 'at least the 25 demo students').toBeGreaterThanOrEqual(25);
      if (payloads) {
        expect(total).toBe(payloads.analytics.registered_students_count);
        expect(await page.getByTestId('card-active-value').innerText()).toBe(String(payloads.analytics.active_students_7d));
        expect(await page.getByTestId('card-readiness-value').innerText()).toBe(`${payloads.analytics.average_readiness}%`);
        expect(await page.getByTestId('card-assessments-value').innerText()).toBe(String(payloads.analytics.assessments_taken_count));
      }
      await expect(page.getByTestId('demo-note')).toContainText('demo students');
      await expect(page.getByTestId('chart-distribution')).toBeVisible();
      expect(await page.getByTestId('chart-distribution').locator('[role="img"] > div').count()).toBe(5);
      const weak = await page.getByTestId('weakest-skill').count();
      expect(weak).toBeGreaterThan(0);
      expect(weak).toBeLessThanOrEqual(8);
      await expect(page.getByTestId('chart-activity').locator('svg')).toBeVisible();
      expect(await page.getByTestId('chart-activity').locator('svg circle').count()).toBe(30);
      await shot(page, `admin-analytics-${theme}-1280`);
      await ctx.close();
      return `${total} students, ${weak} weakest skills, 30 activity days`;
    });

    await step(`02-${theme}`, `Admin Analytics at 390px (${theme})`, async () => {
      const { ctx, page } = await adminContext(theme, 390);
      await page.goto(`${BASE}/admin/analytics`);
      await expect(page.getByTestId('analytics-cards')).toBeVisible({ timeout: 30000 });
      await settle(page);
      await expectNoSidewaysScroll(page, page.url());
      await shot(page, `admin-analytics-${theme}-390`);
      await ctx.close();
    });
  }

  await step('03', 'CSV downloads: students and assessment results (header, demo rows, nothing sensitive)', async () => {
    const { ctx, page } = await adminContext('light', 1280);
    await page.goto(`${BASE}/admin/analytics`);
    await expect(page.getByTestId('export-students-csv')).toBeVisible({ timeout: 30000 });
    const notes = [];
    for (const [testId, headerStart, rowText] of [['export-students-csv', 'Name,Email,Career path', 'demo01@example.test'], ['export-results-csv', 'Student,Email,Assessment', '@example.test']]) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
      const file = path.join(SHOTS, `download-${download.suggestedFilename()}`);
      await download.saveAs(file);
      const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      expect(text.split('\n')[0].startsWith(headerStart), `${testId} header`).toBe(true);
      expect(text).toContain(rowText);
      for (const secret of ['$2b$', 'password', 'refresh', 'access_token', 'google_sub']) expect(text.toLowerCase(), `${testId} contains ${secret}`).not.toContain(secret.toLowerCase());
      for (const cell of text.split('\n').slice(1).flatMap((l) => l.split(','))) expect(/^["]?[=+\-@]/.test(cell.trim()) && !/^-?\d/.test(cell.trim()), `unescaped cell ${cell}`).toBe(false);
      notes.push(`${download.suggestedFilename()} ${text.split('\n').length - 1} rows`);
    }
    await shot(page, 'admin-analytics-after-export', false);
    await ctx.close();
    return notes.join(', ');
  });

  // ------------------------------------------------------------------------------------------------ daily challenge, streak, badges
  let dailySlug = '';
  await step('04', 'Dashboard shows the Daily Challenge with streak 0; Solve now opens the problem', async () => {
    const { ctx } = await studentContext('light', 1280);
    const page = await ctx.newPage();
    watch(page);
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByTestId('daily-card')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('daily-title')).toBeVisible();
    expect(await page.getByTestId('daily-streak').first().getAttribute('data-streak')).toBe('0');
    await settle(page);
    await page.getByTestId('daily-card').scrollIntoViewIfNeeded();
    await shot(page, 'daily-card-dashboard-light-1280', false);
    await page.getByTestId('daily-solve').click();
    await page.waitForURL(/\/practice\?problem=/);
    dailySlug = new URL(page.url()).searchParams.get('problem');
    expect(dailySlug).toBeTruthy();
    await expect(page.getByTestId('practice-arena')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('daily-chip')).toBeVisible();
    await settle(page);
    await shot(page, 'daily-chip-arena-light-1280', false);
    await ctx.close();
    return dailySlug;
  });

  await step('05', 'A wrong then a correct submission of the daily problem: streak goes from 0 to 1', async () => {
    const reference = py([path.join('e2e', 'helpers', 'p14_reference.py'), dailySlug]);
    const { ctx } = await studentContext('light', 1280);
    const page = await ctx.newPage();
    watch(page);
    await page.goto(`${BASE}/practice?problem=${encodeURIComponent(dailySlug)}`);
    await expect(page.getByTestId('practice-arena')).toBeVisible({ timeout: 30000 });
    const first = await submitCode(page); // the starter code has no solution
    expect(first).not.toContain('Accepted');
    await setCode(page, reference);
    await page.waitForTimeout(400);
    await expect.poll(async () => (await page.locator('.cm-content').innerText()).includes('class Solution')).toBe(true);
    const second = await submitCode(page);
    expect(second).toContain('Accepted');
    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByTestId('daily-solved')).toBeVisible({ timeout: 30000 });
    expect(await page.getByTestId('daily-streak').first().getAttribute('data-streak')).toBe('1');
    await settle(page);
    await page.getByTestId('daily-card').scrollIntoViewIfNeeded();
    await shot(page, 'daily-card-solved-light-1280', false);
    await ctx.close();
    return `first: ${first.slice(0, 30)}; second: ${second.slice(0, 30)}; streak 1`;
  });

  for (const theme of THEMES) {
    await step(`06-${theme}`, `Daily card, arena chip and profile badges (${theme})`, async () => {
      const { ctx } = await studentContext(theme, 1280);
      const page = await ctx.newPage();
      watch(page);
      await page.goto(`${BASE}/dashboard`);
      await expect(page.getByTestId('daily-solved')).toBeVisible({ timeout: 30000 });
      await settle(page);
      await shot(page, `dashboard-${theme}-1280`);
      await page.goto(`${BASE}/practice?problem=${encodeURIComponent(dailySlug)}`);
      await expect(page.getByTestId('daily-chip')).toBeVisible({ timeout: 30000 });
      await settle(page);
      await shot(page, `arena-${theme}-1280`, false);
      await page.getByTestId('pa-problem-list').click();
      await expect(page.getByTestId('pa-drawer').getByTestId('daily-card')).toBeVisible();
      await shot(page, `arena-problem-list-${theme}-1280`, false);
      await page.keyboard.press('Escape');
      await page.goto(`${BASE}/profile`);
      await expect(page.getByTestId('achievements')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('ach-current')).toHaveText('1');
      await expect(page.getByTestId('ach-best')).toHaveText('1');
      await expect(page.getByTestId('ach-solved')).toHaveText('1');
      await expect(page.getByTestId('badge-streak-7')).toHaveAttribute('data-earned', 'false');
      await expect(page.getByTestId('badge-solved-10')).toHaveAttribute('data-earned', 'false');
      await settle(page);
      await page.getByTestId('achievements').scrollIntoViewIfNeeded();
      await shot(page, `profile-achievements-${theme}-1280`, false);
      await ctx.close();
    });

    await step(`07-${theme}`, `Daily card and profile badges on a phone (${theme}, 390px)`, async () => {
      const { ctx } = await studentContext(theme, 390);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/dashboard`);
      await expect(page.getByTestId('daily-card')).toBeVisible({ timeout: 30000 });
      await expectNoSidewaysScroll(page, page.url());
      await settle(page);
      await page.getByTestId('daily-card').scrollIntoViewIfNeeded();
      await shot(page, `daily-card-${theme}-390`, false);
      await page.goto(`${BASE}/profile`);
      await expect(page.getByTestId('achievements')).toBeVisible({ timeout: 30000 });
      await expectNoSidewaysScroll(page, page.url());
      await page.getByTestId('achievements').scrollIntoViewIfNeeded();
      await shot(page, `profile-achievements-${theme}-390`, false);
      await ctx.close();
    });
  }

  // ------------------------------------------------------------------------------------------------ my submissions
  await step('08', 'My submissions: filters, opening the code, another student gets a 404', async () => {
    const { ctx, token } = await studentContext('light', 1280);
    const page = await ctx.newPage();
    watch(page);
    await page.goto(`${BASE}/my-submissions`);
    await expect(page.getByTestId('submissions-table')).toBeVisible({ timeout: 30000 });
    expect(await page.getByTestId('submission-row').count()).toBe(2);
    await expect(page.getByTestId('submissions-count')).toHaveText('2 submissions');
    // verdict
    await filterBy(page, 'filter-verdict', 'Accepted');
    await expect(page.getByTestId('submission-row')).toHaveCount(1);
    await expect(page.getByTestId('submission-row').first()).toContainText('Accepted');
    await filterBy(page, 'filter-verdict', '');
    await expect(page.getByTestId('submission-row')).toHaveCount(2);
    // language
    await filterBy(page, 'filter-language', 'python');
    await expect(page.getByTestId('submission-row')).toHaveCount(2);
    await filterBy(page, 'filter-language', '');
    // difficulty: the daily problem has one difficulty; the other two give the empty state
    const levels = ['Easy', 'Medium', 'Hard'];
    const counts = {};
    for (const level of levels) {
      await filterBy(page, 'filter-difficulty', level);
      counts[level] = await page.getByTestId('submission-row').count();
    }
    expect(Object.values(counts).sort()).toEqual([0, 0, 2]);
    await page.getByTestId('filter-difficulty').selectOption(levels.find((l) => counts[l] === 0));
    await expect(page.getByText('No submissions match these filters')).toBeVisible();
    await shot(page, 'my-submissions-empty-filter-light-1280', false);
    await page.getByTestId('filter-clear').click();
    await expect(page.getByTestId('submission-row')).toHaveCount(2);
    // open the code of the Accepted one
    await filterBy(page, 'filter-verdict', 'Accepted');
    await expect(page.getByTestId('submission-row')).toHaveCount(1);
    await page.getByTestId('open-submission').click();
    await expect(page.getByTestId('submission-code')).toContainText('class Solution', { timeout: 15000 });
    await expect(page.getByTestId('open-problem')).toBeVisible();
    const text = await page.getByTestId('submission-detail').innerText();
    expect(text.toLowerCase()).not.toContain('hidden');
    await shot(page, 'submission-detail-light-1280', false);
    // ownership: the second student can neither list nor open it
    const list = await (await ctx.request.get(`${BASE}/api/practice/submissions?page_size=50`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const mine = list.items.find((i) => i.verdict === 'Accepted').id;
    const ctxB = await browser.newContext();
    const tokenB = await apiLogin(ctxB, B);
    const other = await ctxB.request.get(`${BASE}/api/practice/submissions/${mine}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(other.status()).toBe(404);
    expect((await (await ctxB.request.get(`${BASE}/api/practice/submissions`, { headers: { Authorization: `Bearer ${tokenB}` } })).json()).total).toBe(0);
    expect((await ctxB.request.get(`${BASE}/api/practice/submissions?page_size=51`, { headers: { Authorization: `Bearer ${tokenB}` } })).status()).toBe(422);
    expect((await ctx.request.get(`${BASE}/api/practice/submissions/${mine}`)).status()).toBe(401);
    await ctxB.close();
    await ctx.close();
    return `counts ${JSON.stringify(counts)}; other student: 404`;
  });

  for (const theme of THEMES) {
    for (const width of [1280, 390]) {
      await step(`09-${theme}-${width}`, `My submissions page and code dialog (${theme}, ${width}px)`, async () => {
        const { ctx } = await studentContext(theme, width);
        const page = await ctx.newPage();
        watch(page);
        await page.goto(`${BASE}/my-submissions`);
        await expect(page.getByTestId('submissions-table')).toBeVisible({ timeout: 30000 });
        await expectNoSidewaysScroll(page, page.url());
        await settle(page);
        await shot(page, `my-submissions-${theme}-${width}`, false);
        await page.getByTestId('open-submission').first().click();
        await expect(page.getByTestId('submission-code')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(400);
        await shot(page, `submission-detail-${theme}-${width}`, false);
        await ctx.close();
      });
    }
  }
});
