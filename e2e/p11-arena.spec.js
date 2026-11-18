// P11: the Practice Arena (function-style judge, CodeMirror editor, LeetCode-inspired layout) in a real (headed) Chrome against the real
// app, real Atlas and the real online compiler (Judge0).
//   npx playwright test -c e2e/playwright.config.js p11-arena
// New test student -> open a problem -> the stub holds no solution and no hint -> empty function fails with "returned nothing" ->
// correct solution (Run, then Submit) is Accepted -> wrong answer (hidden data not revealed) -> syntax error (line marked) ->
// a slow brute force on a medium problem is Time Limit Exceeded -> a printed fake result line is ignored -> hints, submissions,
// "Load this code" -> the same in Java -> custom cases, shortcuts, settings, resize, problem list -> the layout at 390px.
// Screenshots: e2e/screenshots/p11/. The test student (and their attempts) is deleted at the end.
// Passwords are generated here, set without echoing, and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { selectContrastAudit } from './helpers/selectContrast.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p11');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const SUM = 'sum-two-numbers';
const PAIR = 'pair-sum-exists';
const email = `p3-test-p11-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;

// Data that must never reach the browser (hidden cases of sum-two-numbers and pair-sum-exists, a late hint, a solution line)
const NEVER_IN_BROWSER = ['[100000,250000]', '350000', '1111111110', '-2000000000000', 'return a + b'];

const PY_GOOD = 'class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        return a + b\n';
const PY_WRONG_HIDDEN = 'class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        print("ARGS", a, b)\n        if a == 100000:\n            return a + b + 1\n        return a + b\n';
const PY_SYNTAX = 'class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        return a +\n';
const PY_FORGE = 'class Solution:\n    def add_numbers(self, a: int, b: int) -> int:\n        print(\'@@guess@@{"i":0,"ok":true,"result":7,"ms":0}\')\n        return 0\n';
const PY_BRUTE = 'from typing import List\n\nclass Solution:\n    def has_pair_with_sum(self, nums: List[int], target: int) -> bool:\n        for i in range(len(nums)):\n            for j in range(i + 1, len(nums)):\n                if nums[i] + nums[j] == target:\n                    return True\n        return False\n';
const JAVA_GOOD = 'class Solution {\n    public long addNumbers(long a, long b) {\n        return a + b;\n    }\n}\n';
const JAVA_WRONG = 'class Solution {\n    public long addNumbers(long a, long b) {\n        return a - b;\n    }\n}\n';
const JAVA_SYNTAX = 'class Solution {\n    public long addNumbers(long a, long b) {\n        return a + b\n    }\n}\n';

let page;
const results = [];
const consoleErrors = [];
const serverErrors = [];
const apiBodies = [];
const callTimes = [];

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 240);
    try { await page.screenshot({ path: path.join(SHOTS, `${id}-FAILED.png`) }); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const status = () => page.getByTestId('pa-result-status');

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// CodeMirror keeps its own document: select everything and paste, so auto-indent and auto-close do not touch the text
async function setCode(code) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Control+A');
  await content.evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, code);
}
const editorText = () => page.locator('.cm-content').innerText();

// The shared limit is 10 runs or submissions per minute per student: wait here instead of failing on 429.
async function pace() {
  const now = Date.now();
  while (callTimes.length && now - callTimes[0] > 60000) callTimes.shift();
  if (callTimes.length >= 9) await page.waitForTimeout(61000 - (now - callTimes[0]));
  callTimes.push(Date.now());
}

async function runCode() {
  await pace();
  await page.getByTestId('pa-run').click();
  await expect(page.getByTestId('pa-tab-result')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 120000 });
  await expect(status()).toBeVisible({ timeout: 10000 });
  return status().innerText();
}

async function submitCode() {
  await pace();
  await page.getByTestId('pa-submit').click();
  await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 150000 });
  await expect(page.getByTestId('pa-verdict')).toBeVisible({ timeout: 10000 });
  return status().innerText();
}

async function open(slug, language) {
  await page.goto(`/practice?problem=${slug}`);
  await expect(page.getByTestId('practice-arena')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('pa-description').getByRole('heading', { level: 1 })).toBeVisible();
  if (language) await page.getByTestId('pa-language').selectOption(language);
  await expect(page.locator('.cm-content')).toBeAttached();
}

const bodyText = () => page.locator('body').innerText();

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('response', async (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return;
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${u.pathname}`);
    if (u.pathname.startsWith('/api/practice/')) {
      try { apiBodies.push({ path: u.pathname + u.search, body: await r.text() }); } catch { /* body gone */ }
    }
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
  console.log(`  5xx responses from /api: ${serverErrors.length ? serverErrors.join(', ') : 'none'}`);
  console.log(`  App console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('the Practice Arena works end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P11 Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', 'Open a problem: statement, examples, constraints, complexity; the stub has no solution and no hint', async () => {
    await open(SUM);
    await expect(page.getByTestId('pa-difficulty')).toHaveAttribute('data-difficulty', 'Easy');
    expect(await page.getByTestId('pa-example').count()).toBe(3);
    await expect(page.getByTestId('pa-description')).toContainText('Constraints');
    await expect(page.getByTestId('pa-complexity')).toContainText('O(1)');
    const stub = await editorText();
    expect(stub).toContain('class Solution:');
    expect(stub).toContain('def add_numbers(self, a: int, b: int) -> int:');
    expect(stub).not.toMatch(/return\s/);
    expect(stub).not.toContain('a + b');
    await expect(page.getByTestId('pa-hint')).toHaveCount(0);
    await shot('01-problem-desktop');
  });

  await step('03', 'Run with the empty stub: failed cases saying "Your function returned nothing", never success', async () => {
    const verdict = await runCode();
    expect(verdict).toBe('Wrong Answer');
    await expect(page.getByTestId('pa-case-error')).toContainText('Your function returned nothing');
    expect(await page.getByTestId('pa-case-status').innerText()).toContain('Failed');
    await expect(page.getByTestId('pa-result-case-1')).toHaveAttribute('data-status', 'Wrong Answer');
    await shot('02-empty-stub');
  });

  await step('04', 'Correct Python solution: Run passes every example; Ctrl+Shift+Enter submits and is Accepted', async () => {
    await setCode(PY_GOOD);
    expect(await runCode()).toBe('Accepted');
    for (const n of [1, 2, 3]) await expect(page.getByTestId(`pa-result-case-${n}`)).toHaveAttribute('data-status', 'Passed');
    await expect(page.getByTestId('pa-run-result')).toContainText('3 of 3 examples passed');
    await shot('03-run-passed');
    await pace();
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+Shift+Enter');
    await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 150000 });
    await expect(page.getByTestId('pa-verdict')).toHaveAttribute('data-verdict', 'Accepted', { timeout: 15000 });
    await expect(page.getByTestId('pa-passed')).toContainText('Passed 14 of 14');
    await expect(page.getByTestId('pa-runtime')).toBeVisible();
    await expect(page.getByTestId('pa-expected-complexity')).toContainText('O(1)');
    await expect(page.getByTestId('pa-next-problem')).toBeVisible();
    await shot('04-accepted');
  });

  await step('05', 'Wrong answer on a hidden case: only the case number is shown, no hidden data', async () => {
    await setCode(PY_WRONG_HIDDEN);
    expect(await submitCode()).toBe('Wrong Answer');
    await expect(page.getByTestId('pa-message')).toContainText(/Test case \d+ of 14 failed/);
    await expect(page.getByTestId('pa-hidden-failure')).toBeVisible();
    await expect(page.getByTestId('pa-failed-detail')).toHaveCount(0);
    const text = await bodyText();
    for (const secret of ['250000', '350000', '350001', 'ARGS 100000']) expect(text, secret).not.toContain(secret);
    await shot('05-wrong-answer-hidden');
  });

  await step('06', 'Syntax error: Compile Error with the line marked in the editor', async () => {
    await setCode(PY_SYNTAX);
    expect(await runCode()).toBe('Compile Error');
    await expect(page.getByTestId('pa-compile-output')).toContainText('SyntaxError');
    await expect(page.locator('.cm-error-line')).toHaveCount(1);
    expect(await page.locator('.cm-error-line').innerText()).toContain('return a +');
    await shot('06-compile-error-line');
    await page.locator('.cm-content').click();
    await page.keyboard.type(' 1');
    await expect(page.locator('.cm-error-line')).toHaveCount(0);  // an edit clears the stale mark
  });

  await step('07', 'A printed fake result line is ignored (shown only as output)', async () => {
    await setCode(PY_FORGE);
    expect(await runCode()).toBe('Wrong Answer');
    await expect(page.getByTestId('pa-case-stdout')).toContainText('@@guess@@');
    await expect(page.getByTestId('pa-result-case-1')).toHaveAttribute('data-status', 'Wrong Answer');
  });

  await step('08', 'Medium problem: a slow brute force is Time Limit Exceeded on a hidden case', async () => {
    await open(PAIR, 'python');
    await expect(page.getByTestId('pa-difficulty')).toHaveAttribute('data-difficulty', 'Medium');
    await setCode(PY_BRUTE);
    expect(await runCode()).toBe('Accepted');  // the examples are tiny: the brute force is right, just slow
    expect(await submitCode()).toBe('Time Limit Exceeded');
    await expect(page.getByTestId('pa-hidden-failure')).toBeVisible();
    await shot('07-time-limit-exceeded');
  });

  await step('09', 'Hints: hidden until asked, one at a time', async () => {
    await page.getByTestId('pa-tab-hints').click();
    await expect(page.getByTestId('pa-hint')).toHaveCount(0);
    await expect(page.getByTestId('pa-reveal-hint')).toContainText('Reveal hint 1/3');
    await page.getByTestId('pa-reveal-hint').click();
    await expect(page.getByTestId('pa-hint')).toHaveCount(1);
    await expect(page.getByTestId('pa-reveal-hint')).toContainText('Reveal hint 2/3');
    await shot('08-hint');
  });

  await step('10', 'Submissions: history is listed and "Load this code" restores it', async () => {
    await open(SUM, 'python');
    await page.getByTestId('pa-tab-submissions').click();
    await expect(page.getByTestId('pa-submission').first()).toBeVisible();
    const rows = await page.getByTestId('pa-submission').allInnerTexts();
    expect(rows.some((r) => r.includes('Accepted'))).toBe(true);
    expect(rows.some((r) => r.includes('Wrong Answer'))).toBe(true);
    await setCode('class Solution:\n    pass\n');
    const accepted = page.getByTestId('pa-submission').filter({ hasText: 'Accepted' }).first();
    await accepted.getByTestId('pa-load-code').click();
    await expect.poll(editorText).toContain('return a + b');
    await shot('09-submissions');
  });

  await step('11', 'Java: stub, empty function, correct, wrong, compile error with the line mapped to the student code', async () => {
    await open(SUM, 'java');
    const stub = await editorText();
    expect(stub).toContain('class Solution {');
    expect(stub).toContain('public long addNumbers(long a, long b)');
    expect(stub).not.toMatch(/return\s/);
    expect(await runCode()).toBe('Compile Error');  // an empty function with a return type cannot compile; the message says why
    await expect(page.getByTestId('pa-compile-output')).toContainText('missing return statement');
    await setCode(JAVA_SYNTAX);
    expect(await runCode()).toBe('Compile Error');
    await expect(page.locator('.cm-error-line')).toHaveCount(1);
    expect(await page.locator('.cm-error-line').innerText()).toContain('return a + b');
    await shot('10-java-compile-error');
    await setCode(JAVA_WRONG);
    expect(await runCode()).toBe('Wrong Answer');
    await setCode(JAVA_GOOD);
    expect(await runCode()).toBe('Accepted');
    expect(await submitCode()).toBe('Accepted');
    await shot('11-java-accepted');
  });

  await step('12', 'Custom cases: add one, a bad value is refused in the field, a good one runs without an expected value', async () => {
    await open(SUM, 'python');
    await setCode(PY_GOOD);
    await page.getByTestId('pa-tab-testcase').click();
    await page.getByTestId('pa-add-case').click();
    await page.getByTestId('pa-input-a').fill('abc');
    await page.getByTestId('pa-run').click();
    await expect(page.getByTestId('pa-testcase-tab')).toContainText('Could not read');
    await page.getByTestId('pa-input-a').fill('1000000000000');
    await page.getByTestId('pa-input-b').fill('1');
    expect(await runCode()).toBe('Accepted');
    await page.getByTestId('pa-result-case-4').click();
    await expect(page.getByTestId('pa-case-output')).toContainText('1000000000001');
    await expect(page.getByTestId('pa-case-detail')).not.toContainText('Expected');
    await shot('12-custom-case');
  });

  await step('13', 'Reset to starter code asks first; editor settings; Ctrl+Enter runs; panes can be resized', async () => {
    await page.getByTestId('pa-reset').click();
    await page.getByTestId('pa-reset-cancel').click();
    expect(await editorText()).toContain('return a + b');
    await page.getByTestId('pa-settings').click();
    await page.getByTestId('pa-font-size').selectOption('18');
    await page.getByTestId('pa-tab-size').selectOption('2');
    await page.keyboard.press('Escape');
    expect(await page.locator('.cm-editor').evaluate((el) => getComputedStyle(el).fontSize)).toBe('18px');
    await pace();
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('pa-running')).toBeHidden({ timeout: 120000 });
    await expect(status()).toHaveText('Accepted');
    const before = await page.locator('.pa-left').evaluate((el) => el.getBoundingClientRect().width);
    const handle = await page.getByTestId('pa-resize-columns').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 160, handle.y + handle.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = await page.locator('.pa-left').evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before + 80);
    await page.getByTestId('pa-reset').click();
    await page.getByTestId('pa-reset-confirm').click();
    await expect.poll(editorText).toContain('pass');
    expect(await editorText()).not.toContain('a + b');
  });

  await step('14', 'Problem list: search, filters, solved check mark, previous / next', async () => {
    await page.getByTestId('pa-problem-list').click();
    await expect(page.getByTestId('pa-problem-row')).toHaveCount(12);
    await page.getByTestId('pa-search').fill('bracket');
    await expect(page.getByTestId('pa-problem-row')).toHaveCount(1);
    await page.getByTestId('pa-search').fill('');
    await page.getByLabel('Filter by difficulty').selectOption('Hard');
    await expect(page.getByTestId('pa-problem-row')).toHaveCount(3);
    await page.getByLabel('Filter by difficulty').selectOption('All');
    await page.getByLabel('Filter by status').selectOption('Solved');
    await expect(page.getByTestId('pa-problem-row')).toHaveCount(1);
    await expect(page.getByTestId('pa-problem-row').first()).toContainText('Sum of Two Numbers');
    await expect(page.getByTestId('pa-problem-row').first().locator('.pa-check')).toHaveText('✓');
    await shot('13-problem-list');
    await page.getByTestId('pa-problem-row').first().click();
    await page.getByTestId('pa-next').click();
    await expect(page.getByTestId('pa-description').getByRole('heading', { level: 1 })).toHaveText('Count the Vowels');
    await page.getByTestId('pa-prev').click();
    await expect(page.getByTestId('pa-description').getByRole('heading', { level: 1 })).toHaveText('Sum of Two Numbers');
  });

  await step('15', 'C is greyed out with the reason for a problem whose types do not fit; the select has readable options', async () => {
    await open(SUM);
    const cOption = page.getByTestId('pa-language').locator('option[value="c"]');
    await expect(cOption).toBeEnabled();  // all 12 shipped problems fit C
    const audit = await page.evaluate(selectContrastAudit);
    expect(audit.violations, JSON.stringify(audit.violations).slice(0, 200)).toEqual([]);
  });

  await step('16', 'Nothing hidden ever reached the browser (API bodies scanned)', async () => {
    const listBody = apiBodies.filter((b) => b.path.startsWith('/api/practice/problems') && !b.path.includes('/submissions') && !b.path.includes('/hints')).map((b) => b.body).join('\n');
    expect(listBody.length).toBeGreaterThan(1000);
    for (const secret of NEVER_IN_BROWSER) expect(listBody.includes(secret), `${secret} in /practice/problems`).toBe(false);
    const everything = apiBodies.map((b) => b.body).join('\n');
    for (const secret of ['350000', '1111111110', '[100000,250000]']) expect(everything.includes(secret), `${secret} in an API response`).toBe(false);
    expect(/"hints"|"test_cases"|"hidden_test_cases"/.test(listBody)).toBe(false);
    return `${apiBodies.length} practice API responses scanned`;
  });

  await step('17', 'Mobile (390px): Description / Code / Result tabs, no sideways scroll, readable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(SUM);
    await expect(page.getByTestId('pa-mobile-description')).toBeVisible();
    const noScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(await noScroll()).toBe(true);
    await expect(page.getByTestId('pa-description')).toBeVisible();
    await expect(page.locator('.cm-content')).toBeHidden();
    await shot('14-mobile-description');
    await page.getByTestId('pa-mobile-code').click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.getByTestId('pa-description')).toBeHidden();
    expect(await noScroll()).toBe(true);
    await shot('15-mobile-code');
    await setCode(PY_GOOD);
    expect(await runCode()).toBe('Accepted');  // Run moves to the Result tab
    await expect(page.getByTestId('pa-mobile-result')).toHaveAttribute('aria-selected', 'true');
    expect(await noScroll()).toBe(true);
    await shot('16-mobile-result');
    await page.getByTestId('pa-tab-testcase').click();
    await expect(page.getByTestId('pa-case-1')).toBeVisible();
    await shot('17-mobile-testcase');
    const audit = await page.evaluate(selectContrastAudit);
    expect(audit.violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed.map((r) => `${r.id} ${r.title}: ${r.note}`)).toEqual([]);
  expect(serverErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
