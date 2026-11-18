// P9 student side, in a real (headed) Chrome against the real app and real Atlas. It needs NO admin account:
//   npx playwright test -c e2e/playwright.config.js p9-student
// A new test student: the bell shows a real notification and "read all" works; the profile saves CGPA / graduation year (and refuses
// bad values); placements show no fake match; the email-notification setting is saved on the server (default off); the one-click
// unsubscribe link switches it off once and then refuses to be used again. Screenshots: e2e/screenshots/p9/. The student is deleted.
// (The admin proof is p9-admin.spec.js, which needs ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD.)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p9');
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-p9s-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;

let page;
let bearer = '';
const results = [];
const consoleErrors = [];
const serverErrors = [];

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 260);
    try { await page.screenshot({ path: path.join(SHOTS, `student-${id}-FAILED.png`), fullPage: true }); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `student-${name}.png`), fullPage: true });

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// The app's labels are plain <label> elements next to the input, not linked with htmlFor: find a field through its wrapper.
const field = (page, label) => page.locator('.form-control', { hasText: label }).locator('input, select, textarea').first();

const api = async (method, url, data) => {
  const res = await page.request.fetch(url, { method, headers: { Authorization: bearer }, data });
  return { status: res.status(), body: await res.json().catch(() => null) };
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { const h = r.headers().authorization; if (h && new URL(r.url()).pathname.startsWith('/api/')) bearer = h; });
  page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 500) serverErrors.push(`${r.status()} ${u.pathname}`); });
});

test.afterAll(async () => {
  let cleanup = '';
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  console.log(`\n  Cleanup: ${cleanup}`);
  console.log(`  5xx responses from /api: ${serverErrors.length ? serverErrors.join(', ') : 'none'}`);
  console.log(`  App console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('the student side of P9 works end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P9 Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', 'The bell is empty for a new student (nothing hard-coded)', async () => {
    await page.getByRole('button', { name: 'Notifications' }).click();
    const drawer = page.getByTestId('notification-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('No notifications yet');
    await expect(page.getByTestId('notification-item')).toHaveCount(0);
    await shot('01-bell-empty');
    await page.keyboard.press('Escape');
  });

  await step('03', 'Completing an assessment puts a real notification in the bell, and Read all works', async () => {
    const started = await api('POST', '/api/assessments/asm-py-easy/start');
    expect(started.status).toBe(200);
    const submitted = await api('POST', '/api/assessments/asm-py-easy/submit', { session_id: started.body.session_id, answers: {} });
    expect(submitted.status).toBe(200);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Notifications' }).click();
    const items = page.getByTestId('notification-item');
    await expect(items).toHaveCount(1, { timeout: 20000 });
    await expect(items.first()).toContainText('Assessment completed: Python (Easy)');
    await expect(items.first()).toHaveAttribute('data-read', 'false');
    await shot('02-bell-with-notification');
    await page.getByTestId('read-all').click();
    await expect(items.first()).toHaveAttribute('data-read', 'true');
    await expect(page.getByTestId('read-all')).toHaveCount(0); // nothing unread any more
    const after = await api('GET', '/api/notifications');
    expect(after.body.every((n) => n.read)).toBe(true);
    await page.keyboard.press('Escape');
  });

  await step('04', 'Profile: CGPA and graduation year are saved, and bad values are refused', async () => {
    await page.goto('/profile');
    await page.getByRole('button', { name: /Edit/i }).first().click();
    await field(page, 'College / Institution').fill('Test Institute');
    await field(page, 'Branch / Department').fill('Computer Science');
    await field(page, 'Current year of study').fill('3rd year');
    await field(page, 'Career Target').selectOption({ index: 1 });
    // the browser's own range check stops 11 and 1999 before anything is sent; the server checks again (below)
    await page.getByTestId('profile-cgpa').fill('11');
    expect(await page.getByTestId('profile-cgpa').evaluate((el) => el.validity.rangeOverflow)).toBe(true);
    await page.getByRole('button', { name: /Save Changes/ }).click();
    await expect(page.getByText(/Profile updated successfully/)).toHaveCount(0);
    await page.getByTestId('profile-cgpa').fill('8.4');
    await page.getByTestId('profile-graduation-year').fill('1999');
    expect(await page.getByTestId('profile-graduation-year').evaluate((el) => el.validity.rangeUnderflow)).toBe(true);
    await page.getByRole('button', { name: /Save Changes/ }).click();
    await expect(page.getByText(/Profile updated successfully/)).toHaveCount(0);
    await page.getByTestId('profile-graduation-year').fill('2027');
    await page.getByRole('button', { name: /Save Changes/ }).click();
    await expect(page.getByText(/Profile updated successfully/)).toBeVisible({ timeout: 20000 });
    const profile = await api('GET', '/api/student/profile');
    expect(profile.body.cgpa).toBe(8.4);
    expect(profile.body.graduation_year).toBe(2027);
    // the server refuses out-of-range values too
    expect((await api('PUT', '/api/student/profile', { ...profile.body, cgpa: 10.5 })).status).toBe(422);
    expect((await api('PUT', '/api/student/profile', { ...profile.body, graduation_year: 2041 })).status).toBe(422);
    await shot('03-profile');
  });

  await step('05', 'Placements show no invented match and say what is missing', async () => {
    await page.goto('/placements');
    await expect(page.getByTestId('eligibility').first()).toBeVisible({ timeout: 20000 });
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/\b\d+% Match\b/); // this student has no assessed skills, so no percentage is shown
    await expect(page.getByText('No match yet').first()).toBeVisible();
    await shot('04-placements');
  });

  await step('06', 'Email notifications default to off and the setting is saved on the server', async () => {
    expect((await api('GET', '/api/auth/me')).body.email_notifications).toBe(false);
    await page.goto('/settings');
    const box = page.getByTestId('email-notifications').first();
    await expect(box).toBeVisible({ timeout: 20000 });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(page.getByText('Email notifications are on.')).toBeVisible();
    expect((await api('GET', '/api/auth/me')).body.email_notifications).toBe(true);
    await page.reload();
    await expect(page.getByTestId('email-notifications').first()).toBeChecked({ timeout: 20000 });
    await shot('05-settings-on');
  });

  await step('07', 'The one-click unsubscribe link turns it off once, and a second use is refused', async () => {
    const token = execFileSync(PY, [path.join(here, 'helpers', 'make_unsub_token.py'), email], { cwd: root }).toString().trim();
    const fresh = await page.context().newPage(); // a logged-out visit: the link needs no login
    await fresh.goto(`/unsubscribe?token=${encodeURIComponent(token)}`);
    await expect(fresh.getByTestId('unsubscribe-result')).toHaveAttribute('data-ok', 'true', { timeout: 20000 });
    await fresh.screenshot({ path: path.join(SHOTS, 'student-06-unsubscribed.png') });
    expect((await api('GET', '/api/auth/me')).body.email_notifications).toBe(false);
    await page.goto('/settings');
    await page.getByTestId('email-notifications').first().check(); // turned on again
    await expect(page.getByText('Email notifications are on.')).toBeVisible();
    await fresh.goto(`/unsubscribe?token=${encodeURIComponent(token)}`);
    await expect(fresh.getByTestId('unsubscribe-result')).toHaveAttribute('data-ok', 'false', { timeout: 20000 });
    expect((await api('GET', '/api/auth/me')).body.email_notifications).toBe(true); // the used link cannot switch it off again
    await fresh.goto('/unsubscribe?token=not-a-real-token-at-all-0123456789');
    await expect(fresh.getByTestId('unsubscribe-result')).toHaveAttribute('data-ok', 'false', { timeout: 20000 });
    await fresh.close();
  });

  await step('08', 'A student gets 403 on the admin API and cannot open an admin page', async () => {
    for (const url of ['/api/admin/students', '/api/admin/content/questions', '/api/admin/extracted-questions']) {
      expect((await api('GET', url)).status, url).toBe(403);
    }
    expect((await api('PUT', '/api/admin/extracted-questions/x/status', { new_status: 'approved' })).status).toBe(403);
    await page.goto('/admin/content');
    await expect(page).not.toHaveURL(/\/admin\/content$/, { timeout: 20000 });
    await shot('07-admin-page-blocked');
  });

  await step('09', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
