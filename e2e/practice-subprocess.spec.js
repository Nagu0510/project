// Practice page in SANDBOX_MODE=subprocess (no Docker): Python and JavaScript must run end to end.
//   npx playwright test -c e2e/playwright.config.js practice-subprocess
// Uses a generated test student (random password, never printed) and deletes it afterwards.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'subprocess');
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const email = `p3-test-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(12).toString('base64url')}`;

fs.mkdirSync(SHOTS, { recursive: true });

test.describe.configure({ mode: 'serial' });
let page;
let n = 0;
const shot = async (name) => { n += 1; await page.screenshot({ path: path.join(SHOTS, `${String(n).padStart(2, '0')}-${name}.png`) }); };

const setSecret = (locator, value) => locator.evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

async function run(lang, code) {
  await page.locator('select:has(option[value="javascript"])').selectOption(lang);
  await page.waitForTimeout(300);
  await page.locator('textarea').first().fill(code);
  await page.getByRole('button', { name: /Run Code/ }).click();
  await expect(page.getByRole('button', { name: /Running/ })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /Running/ })).toBeHidden({ timeout: 30000 });
  return page.locator('main').innerText();
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});

test.afterAll(() => {
  const out = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  console.log(`  Cleanup: ${out}`);
});

test('practice page runs Python and JavaScript without Docker', async () => {
  await page.goto('/signup');
  await page.locator('input[type="text"]').first().fill('Subprocess Tester');
  await page.locator('input[type="email"]').fill(email);
  await setSecret(page.locator('input[type="password"]').nth(0), password);
  await setSecret(page.locator('input[type="password"]').nth(1), password);
  await page.getByRole('button', { name: /Create Free Account/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: /Run Code/ })).toBeVisible({ timeout: 30000 });

  let out = await run('python', 'print("hello-python")');
  expect(out).toContain('Status: Success');
  expect(out).toContain('hello-python');
  await shot('python');

  out = await run('javascript', 'console.log("hello-javascript");');
  expect(out).toContain('Status: Success');
  expect(out).toContain('hello-javascript');
  await shot('javascript');

  const started = Date.now();
  out = await run('python', 'while True:\n    pass');
  expect(out).toMatch(/Time limit exceeded/i);
  expect((Date.now() - started) / 1000).toBeLessThan(10);
  await shot('time-limit');
  console.log(`  python + javascript OK; infinite loop stopped after ${((Date.now() - started) / 1000).toFixed(1)}s`);
});
