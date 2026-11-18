// Auth proof in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js auth-fix
// Registers a generated student, logs out/in, checks session survival, wrong-password message, the Google button,
// and that no step produced a 5xx or an app console error. Screenshots: e2e/screenshots/auth-fix/. The test
// student is deleted at the end. Passwords are generated here, set without echoing, and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'auth-fix');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-authfix-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const redact = (t) => t.replace(/\d{6,}-[\w-]+\.apps\.googleusercontent\.com/g, '<client-id>');

let page;
const results = [];
const consoleErrors = [];
const serverErrors = [];
const apiCalls = [];

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 220);
    try { await page.screenshot({ path: path.join(SHOTS, `${id}-FAILED.png`) }); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const logout = async () => {
  await page.locator('button[title="Log Out"], button:has-text("Log Out")').first().click();
  await page.waitForURL('**/login', { timeout: 15000 });
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  // Google's own script logs about its iframe/origin; only the app's errors count here
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(redact(m.text())); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    apiCalls.push(`${r.request().method()} ${u.pathname} ${r.status()}`);
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${u.pathname}`);
  });
});

test.afterAll(async () => {
  let cleanup = '';
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  console.log(`\n  Cleanup: ${cleanup}`);
  console.log(`  API calls: ${apiCalls.length}; 5xx responses: ${serverErrors.length ? serverErrors.join(', ') : 'none'}`);
  console.log(`  App console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('auth works end to end', async () => {
  await step('01', 'Register opens clean (no stale error banner)', async () => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.locator('[style*="error-bg"]')).toHaveCount(0);
    await shot('01-register-clean');
  });

  await step('02', 'Register a new student', async () => {
    await page.locator('input[type="text"]').first().fill('Auth Fix Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await shot('02-register-filled');
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await shot('02-registered-dashboard');
  });

  await step('03', 'Log out', async () => {
    await logout();
    await shot('03-logged-out');
  });

  await step('04', 'Wrong password shows a friendly message (not HTTP Error)', async () => {
    await page.locator('input[type="email"]').fill(email);
    await setSecret(page.locator('input[type="password"]'), 'Wrong-pass-1');
    await page.getByRole('button', { name: /Sign In/ }).click();
    const banner = page.getByText('Invalid email or password');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/HTTP Error/)).toHaveCount(0);
    await shot('04-wrong-password');
    return 'banner: "Invalid email or password"';
  });

  await step('05', 'Error banner clears on the next attempt and on page change', async () => {
    await setSecret(page.locator('input[type="password"]'), password);
    await page.getByRole('button', { name: /Sign In/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await logout();
    await expect(page.getByText('Invalid email or password')).toHaveCount(0); // gone after the successful attempt + new visit
    // fail once more, then move to Register: it must open without that error
    await page.locator('input[type="email"]').fill(email);
    await setSecret(page.locator('input[type="password"]'), 'Wrong-pass-2');
    await page.getByRole('button', { name: /Sign In/ }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 15000 });
    await page.getByRole('link', { name: 'Get started free' }).first().click();
    await page.waitForURL('**/signup');
    await expect(page.getByText('Invalid email or password')).toHaveCount(0);
    await shot('05-register-after-login-error');
  });

  await step('06', 'Log in with the right password', async () => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await setSecret(page.locator('input[type="password"]'), password);
    await page.getByRole('button', { name: /Sign In/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await shot('06-logged-in');
  });

  await step('07', 'Refresh: the session survives', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    await expect(page.locator('button:has-text("Log Out"), button[title="Log Out"]').first()).toBeVisible({ timeout: 15000 });
    await shot('07-after-refresh');
  });

  await step('08', 'Log out again', async () => {
    await logout();
    await shot('08-logged-out-again');
  });

  await step('09', 'Admin login', async () => {
    if (!process.env.ADMIN_TEST_EMAIL || !process.env.ADMIN_TEST_PASSWORD) return 'SKIPPED: ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD are not set';
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(process.env.ADMIN_TEST_EMAIL);
    await setSecret(page.locator('input[type="password"]'), process.env.ADMIN_TEST_PASSWORD);
    await page.getByRole('button', { name: /Sign In|Log In|Login/i }).click();
    await page.waitForURL('**/admin/**', { timeout: 30000 });
    await shot('09-admin-dashboard');
    await logout();
  });

  await step('10', 'Google button: click it and report what Google shows', async () => {
    await page.goto('/login');
    const realFrame = page.locator('iframe[src*="accounts.google.com/gsi/button"]');
    const fallback = page.getByTestId('google-unavailable');
    await expect.poll(async () => {
      const box = await realFrame.first().boundingBox().catch(() => null);
      return (box && box.width > 0) || (await fallback.count()) > 0;
    }, { timeout: 25000 }).toBe(true);
    await shot('10-google-button');
    if ((await fallback.count()) > 0) {
      await fallback.getByRole('button').click();
      const text = (await page.getByRole('alert').innerText()).replace(/\s+/g, ' ');
      await shot('10-google-fallback-explained');
      return redact(`Google refused to draw its button; app fallback shown: "${text.slice(0, 200)}"`);
    }
    const popup = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await realFrame.first().click();
    const win = await popup;
    if (!win) return 'official Google button shown; click opened no popup';
    await win.waitForLoadState('domcontentloaded').catch(() => {});
    const where = `${new URL(win.url()).hostname}${new URL(win.url()).pathname}`;
    const body = redact((await win.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160));
    await win.screenshot({ path: path.join(SHOTS, '10-google-popup.png') }).catch(() => {});
    await win.close();
    return `official Google button; popup opened at ${where}: "${body}"`;
  });

  await step('11', 'No 5xx responses from /api during the run', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
  });

  await step('12', 'No app console errors', async () => {
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
