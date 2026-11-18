// P4: the coding judge in a real (headed) Chrome against the real app, real Atlas and the real online compiler (Judge0).
//   npx playwright test -c e2e/playwright.config.js p4-judge
// New test student -> open a problem -> run in each of the five languages -> submit a correct solution in each language
// (Accepted) -> submit wrong answers (shown case and hidden case) -> compile error -> provider-down message -> solved badge.
// Screenshots: e2e/screenshots/p4/. The test student (and their attempts) is deleted at the end.
// Passwords are generated here, set without echoing, and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p4');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const SLUG = 'sum-two-numbers';
const email = `p3-test-p4-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;

const SOLUTIONS = {
  python: 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n',
  javascript: "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(String(a + b));\n",
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        long a = sc.nextLong(), b = sc.nextLong();\n        System.out.println(a + b);\n    }\n}\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    long long a, b;\n    scanf("%lld %lld", &a, &b);\n    printf("%lld\\n", a + b);\n    return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    long long a, b;\n    std::cin >> a >> b;\n    std::cout << a + b << std::endl;\n    return 0;\n}\n',
};
const STARTER_MARKERS = { python: 'sys.stdin', javascript: "require('fs')", java: 'public class Main', c: '#include <stdio.h>', cpp: '#include <iostream>' };
const LABELS = { python: 'Python 3', javascript: 'JavaScript', java: 'Java', c: 'C (GCC)', cpp: 'C++' };

let page;
const results = [];
const consoleErrors = [];
const serverErrors = [];

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
const editor = () => page.getByLabel('Code editor');
const runButton = () => page.getByRole('button', { name: /Run Code/ });
const submitButton = () => page.getByRole('button', { name: /^(Submit|Evaluating\.\.\.)$/ });
const verdict = () => page.getByTestId('verdict');

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function chooseLanguage(lang) {
  await page.getByTestId('language-select').selectOption(lang);
  await expect(editor()).toHaveValue(new RegExp(STARTER_MARKERS[lang].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 5000 });
}

async function setCode(code) {
  await editor().fill(code);
}

// The shared limit is 10 runs/submissions per minute per student; if we ever hit it, wait and try once more.
async function clickAndWait(button, doneLocator, busyName) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await button.click();
    await expect(page.getByRole('button', { name: busyName })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: busyName })).toBeHidden({ timeout: 120000 });
    if (!(await page.getByText('Slow down a little').count())) return;
    await page.waitForTimeout(25000);
  }
}

async function submitAndRead() {
  await clickAndWait(submitButton(), verdict(), /Evaluating/);
  await expect(verdict()).toBeVisible({ timeout: 10000 });
  return verdict().getAttribute('data-verdict');
}

async function runAndRead() {
  await clickAndWait(runButton(), null, /Running/);
  return page.locator('main').innerText();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/') && r.status() >= 500) serverErrors.push(`${r.status()} ${u.pathname}`);
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

test('the coding judge works end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P4 Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', 'Practice page: problems come from the API, formats and samples are shown', async () => {
    await page.goto(`/practice?problem=${SLUG}`);
    await expect(page.getByRole('heading', { name: 'Sum of Two Numbers' })).toBeVisible({ timeout: 30000 });
    const options = await page.getByTestId('problem-select').locator('option').allTextContents();
    expect(options.length, 'twelve problems in the selector').toBe(12);
    await expect(page.getByText('Input format.')).toBeVisible();
    await expect(page.getByText('Output format.')).toBeVisible();
    await expect(page.getByText('Constraints', { exact: true })).toBeVisible();
    await expect(page.getByText('Example Cases')).toBeVisible();
    await shot('01-problem-page');
    return `${options.length} problems`;
  });

  await step('03', 'Language selector offers all five languages', async () => {
    const values = await page.getByTestId('language-select').locator('option').evaluateAll((els) => els.map((e) => e.value));
    expect(values.sort()).toEqual(['c', 'cpp', 'java', 'javascript', 'python']);
  });

  for (const lang of ['python', 'javascript', 'java', 'c', 'cpp']) {
    await step(`04-${lang}`, `Run in ${LABELS[lang]}: starter loads, program prints 7 for the sample input`, async () => {
      await chooseLanguage(lang);
      await page.getByRole('button', { name: 'Custom Stdin' }).click();
      await expect(page.getByLabel('Custom input')).toHaveValue('3 4'); // first sample is prefilled
      await setCode(SOLUTIONS[lang]);
      const text = await runAndRead();
      expect(text).toMatch(/Status: Success/);
      expect(text).toMatch(/Standard Output \(stdout\):\s*7\b/);
      await page.getByRole('button', { name: 'Terminal Output' }).click();
      await shot(`02-run-${lang}`);
    });
  }

  for (const lang of ['python', 'javascript', 'java', 'c', 'cpp']) {
    await step(`05-${lang}`, `Submit a correct ${LABELS[lang]} solution: Accepted on all test cases`, async () => {
      await chooseLanguage(lang);
      await setCode(SOLUTIONS[lang]);
      const v = await submitAndRead();
      expect(v).toBe('Accepted');
      await expect(verdict()).toContainText('5/5 test cases passed');
      await shot(`03-accepted-${lang}`);
    });
  }

  await step('06', 'Solved badge shows, and survives a reload (stored in Atlas)', async () => {
    await expect(page.getByTestId('solved-badge')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sum of Two Numbers' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('solved-badge')).toBeVisible({ timeout: 15000 });
    expect(await page.getByTestId('problem-select').locator('option:checked').innerText()).toContain('✓');
    await shot('04-solved-badge');
  });

  await step('07', 'Wrong answer on a shown case: failing case number, input and expected are shown', async () => {
    await chooseLanguage('python');
    await setCode('import sys\na, b = map(int, sys.stdin.read().split())\nprint(a - b)\n');
    expect(await submitAndRead()).toBe('Wrong Answer');
    const failed = page.getByTestId('failed-case');
    await expect(failed).toContainText('Failed on test case 1');
    await expect(failed).toContainText('Input: 3 4');
    await expect(failed).toContainText('Expected: 7');
    await expect(failed).toContainText('Your output: -1');
    await shot('05-wrong-answer-shown-case');
  });

  await step('08', 'Wrong answer on a hidden case: its input and expected output stay hidden', async () => {
    await setCode('import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b if abs(a + b) < 1000000 else 0)\n');
    expect(await submitAndRead()).toBe('Wrong Answer');
    const failed = page.getByTestId('failed-case');
    await expect(failed).toContainText('Failed on test case 5 (hidden)');
    await expect(failed).not.toContainText('4000000000');
    await expect(failed).not.toContainText('2000000000');
    await expect(verdict()).toContainText('4/5 test cases passed');
    await shot('06-wrong-answer-hidden-case');
  });

  await step('09', 'Compile error: verdict and the compiler message', async () => {
    await chooseLanguage('c');
    await setCode('#include <stdio.h>\n\nint main(void) {\n    printf("oops")\n    return 0;\n}\n');
    expect(await submitAndRead()).toBe('Compile Error');
    await expect(verdict()).toContainText(/error|expected/i);
    await shot('07-compile-error');
  });

  await step('10', 'Provider down: "Online compiler is busy", never Wrong Answer', async () => {
    // The browser is told the provider failed (the server's real answer for that case is covered by backend tests).
    await page.route('**/api/practice/code/submit', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'Judge unavailable', passed_count: 0, total_count: 5, stdout: '', stderr: '', compile_output: '', runtime_ms: 0, test_results: [], failed_case: null, message: 'Online compiler is busy, try again in a moment.' }),
    }));
    await chooseLanguage('python');
    await setCode(SOLUTIONS.python);
    await submitButton().click();
    await expect(verdict()).toBeVisible({ timeout: 15000 });
    await expect(verdict()).toHaveAttribute('data-verdict', 'Judge unavailable');
    await expect(verdict()).toContainText('Online compiler is busy');
    await expect(verdict()).not.toContainText('Wrong Answer');
    await shot('08-online-compiler-busy');
    await page.unroute('**/api/practice/code/submit');
  });

  await step('11', 'Unknown problem link shows a clear notice instead of a wrong problem silently', async () => {
    await page.goto('/practice?problem=two-sum');
    await expect(page.getByTestId('unknown-problem')).toBeVisible({ timeout: 30000 });
    await shot('09-unknown-problem');
  });

  await step('12', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
