// Practice page with the ONLINE compiler (SANDBOX_MODE=online): one run per language, a correct and a wrong submit.
//   npx playwright test -c e2e/playwright.config.js p3b-online
// Needs internet. Generated test student (random password, never printed); deleted at the end.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p3b');
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const email = `p3-test-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(12).toString('base64url')}`;

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

test.describe.configure({ mode: 'serial' });
let page;
let n = 0;
const results = [];

async function shot(name) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.getByRole('button', { name: 'Terminal Output' }).scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => window.scrollBy(0, 260)).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('div').forEach((d) => {
    const cs = getComputedStyle(d);
    if (cs.position === 'fixed' && cs.zIndex === '9999') d.style.visibility = 'hidden';
  })).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, file) });
  return `e2e/screenshots/p3b/${file}`;
}

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', shot: '', note: '' };
  try {
    Object.assign(entry, (await fn()) || {});
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 200);
    entry.shot = await shot(`${id}-FAILED`).catch(() => '');
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const setSecret = (locator, value) => locator.evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

const outputText = () => page.locator('main').innerText();

async function setLanguage(value) {
  await page.locator('select:has(option[value="javascript"])').selectOption(value);
  await page.waitForTimeout(300);
}

async function clickAndWait(button, busyLabel) {
  await button.click();
  await expect(page.getByRole('button', { name: busyLabel })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: busyLabel })).toBeHidden({ timeout: 60000 });
}

const run = async (code, stdin) => {
  await page.locator('textarea').first().fill(code);
  if (stdin !== undefined) {
    await page.getByRole('button', { name: 'Custom Stdin' }).click();
    await page.getByPlaceholder(/custom stdin/i).fill(stdin);
    await page.getByRole('button', { name: 'Terminal Output' }).click();
  }
  await clickAndWait(page.getByRole('button', { name: /Run Code/ }), /Running/);
  return outputText();
};

const submit = async (code) => {
  await page.locator('textarea').first().fill(code);
  await clickAndWait(page.getByRole('button', { name: /^Submit$/ }), /Evaluating/);
  await page.getByRole('button', { name: 'Terminal Output' }).click();
  return outputText();
};

const SUM_PROGRAMS = {
  python: ['Python', 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)'],
  javascript: ['JavaScript', "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);"],
  java: ['Java', 'import java.util.Scanner;\npublic class Main { public static void main(String[] x) { Scanner s = new Scanner(System.in); long a = s.nextLong(), b = s.nextLong(); System.out.println(a + b); } }'],
  c: ['C', '#include <stdio.h>\nint main(void){ long long a, b; scanf("%lld %lld", &a, &b); printf("%lld\\n", a + b); return 0; }'],
  cpp: ['C++', '#include <iostream>\nint main(){ long long a, b; std::cin >> a >> b; std::cout << a + b << std::endl; return 0; }'],
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});

test.afterAll(() => {
  let cleanup;
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  const lines = ['| Step | Result | Screenshot |', '|---|---|---|'];
  for (const r of results) lines.push(`| ${r.id}. ${r.title}${r.note ? ` (${r.note})` : ''} | ${r.status} | ${r.shot || '-'} |`);
  lines.push('', `Cleanup: ${cleanup}`);
  fs.writeFileSync(path.join(SHOTS, 'results.md'), lines.join('\n'));
  console.log(`\n${lines.join('\n')}\n`);
});

test('practice page runs code on the online compiler', async () => {
  await step('login', 'Sign up a test student and open the practice page on Sum of Two Numbers', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P3b Test Student');
    await page.locator('input[type="email"]').fill(email);
    await setSecret(page.locator('input[type="password"]').nth(0), password);
    await setSecret(page.locator('input[type="password"]').nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.goto('/practice?problem=sum-two-numbers');
    await expect(page.getByRole('heading', { name: 'Sum of Two Numbers' })).toBeVisible({ timeout: 30000 });
    return { shot: await shot('practice-sum-two-numbers') };
  });

  for (const [lang, [label, code]] of Object.entries(SUM_PROGRAMS)) {
    await step(`run-${lang}`, `Run a ${label} program that reads stdin (3 4 -> 7)`, async () => {
      await setLanguage(lang);
      const out = await run(code, '3 4');
      expect(out).toContain('Status: Success');
      expect(out).toMatch(/Standard Output[\s\S]*\b7\b/);
      return { shot: await shot(`run-${lang}`) };
    });
  }

  await step('compile-error', 'A C compile error is shown as a compile error', async () => {
    await setLanguage('c');
    const out = await run('int main( { return 0 }');
    expect(out).toContain('Status: Compile Error');
    expect(out).toContain('Compile Output');
    return { shot: await shot('c-compile-error') };
  });

  await step('submit-correct', 'Submit a correct solution -> Accepted', async () => {
    await page.waitForTimeout(60000); // keep clear of the 10 requests/minute budget used above
    await setLanguage('python');
    const out = await submit(SUM_PROGRAMS.python[1]);
    expect(out).toContain('Status: Accepted');
    expect(out).toMatch(/Passed all 4 judged test cases/);
    return { shot: await shot('submit-accepted') };
  });

  await step('submit-wrong', 'Submit a wrong solution -> Wrong Answer with the failing test number', async () => {
    const out = await submit('import sys\na, b = map(int, sys.stdin.read().split())\nprint(a - b)');
    expect(out).toContain('Status: Wrong Answer');
    expect(out).toMatch(/Failed on test case 1/);
    const s = await shot('submit-wrong-answer');
    await page.getByRole('button', { name: /Test Cases/ }).click();
    return { shot: s, note: 'failing test number shown' };
  });

  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed.map((r) => `${r.id}: ${r.note}`), 'failing steps').toEqual([]);
});
