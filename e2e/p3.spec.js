// End-to-end check of the code sandbox, run in a real (headed) Chrome.
//   npx playwright test -c e2e/playwright.config.js
// Passwords are generated at run time and never printed, logged or saved. The test student is deleted at the end.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p3');
const API = 'http://127.0.0.1:8000/api';
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(12).toString('base64url')}`; // generated per run, never printed
const CANARY_VALUE = `CANARY-${crypto.randomBytes(8).toString('hex')}`; // a fake secret, to prove nothing readable leaks
const canaryFile = path.join(root, 'backend', '.p3-canary.env');

const results = [];
let page;
let shotNo = 0;
const consoleErrors = [];
const codeRunStatuses = [];

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(name) {
  shotNo += 1;
  const file = `${String(shotNo).padStart(2, '0')}-${name}.png`;
  // bring the editor/output panel into view so the screenshot shows the result, not the page header
  await page.getByRole('button', { name: 'Terminal Output' }).scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => window.scrollBy(0, 260)).catch(() => {});
  await page.waitForTimeout(400);
  const setToastsHidden = (hidden) => page.evaluate((h) => {
    document.querySelectorAll('div').forEach((d) => {
      const cs = getComputedStyle(d);
      if (cs.position === 'fixed' && cs.zIndex === '9999') d.style.visibility = h ? 'hidden' : '';
    });
  }, hidden).catch(() => {});
  await setToastsHidden(true); // toast popups would cover the output panel in the picture
  await page.screenshot({ path: path.join(SHOTS, file) });
  await setToastsHidden(false);
  return `e2e/screenshots/p3/${file}`;
}

// Run one step; a failure is recorded (with a screenshot) and the run continues.
async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', shot: '', note: '' };
  try {
    const out = (await fn()) || {};
    if (out.skipped) entry.status = 'SKIPPED';
    entry.note = out.note || '';
    entry.shot = out.shot || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 220);
    try { entry.shot = await shot(`${id}-FAILED`); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

// Typing a secret through Playwright's fill() could echo it in logs; set it in the page instead.
async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const editor = () => page.locator('textarea').first();
const runButton = () => page.getByRole('button', { name: /Run Code/ });
const languageSelect = () => page.locator('select:has(option[value="javascript"])');
const outputText = async () => (await page.locator('main').innerText());

async function setLanguage(value) {
  await languageSelect().selectOption(value);
  await page.waitForTimeout(300); // the page swaps in that language's starter code
}

async function runCode(code) {
  await editor().fill(code);
  await runButton().click();
  await expect(page.getByRole('button', { name: /Running/ })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /Running/ })).toBeHidden({ timeout: 60000 });
  return outputText();
}

async function openPractice() {
  await page.goto('/practice');
  await expect(runButton()).toBeVisible({ timeout: 30000 });
}

async function uiLogin() {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await setSecret(page.locator('input[type="password"]'), password);
  await page.getByRole('button', { name: /Sign In/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function uiLogout() {
  await page.locator('button[title="Log Out"], button:has-text("Log Out")').first().click();
  await page.waitForURL('**/login', { timeout: 15000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  fs.writeFileSync(canaryFile, `JWT_SECRET_KEY=${CANARY_VALUE}\n`);
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.url().endsWith('/practice/code/run')) codeRunStatuses.push(r.status()); });
});

test.afterAll(async () => {
  fs.rmSync(canaryFile, { force: true });
  let cleanup = '';
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  console.log(`\n  Cleanup: ${cleanup}`);

  const lines = ['| Step | Result | Screenshot |', '|---|---|---|'];
  for (const r of results) lines.push(`| ${r.id}. ${r.title}${r.note ? ` (${r.note})` : ''} | ${r.status} | ${r.shot || '-'} |`);
  lines.push('', `Cleanup: ${cleanup}`);
  fs.writeFileSync(path.join(SHOTS, 'results.md'), lines.join('\n'));
  console.log(`\n${lines.join('\n')}\n`);
});

test('P3 sandbox end-to-end', async () => {
  await step('a', 'Landing page loads with no console errors', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const s = await shot('landing');
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    return { shot: s };
  });

  await step('b', 'Logged out: running code asks for sign-in', async () => {
    await openPractice();
    await expect(page.getByTestId('signin-hint')).toBeVisible();
    await runButton().click();
    await expect(page.getByText(/Unlock Your Personalized Experience|Create a free SkillSense AI account/).first()).toBeVisible({ timeout: 10000 });
    return { shot: await shot('logged-out-run-prompts-login') };
  });

  await step('c', 'Sign up the test student, log out, log in, open practice', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P3 Test Student');
    await page.locator('input[type="email"]').fill(email);
    await setSecret(page.locator('input[type="password"]').nth(0), password);
    await setSecret(page.locator('input[type="password"]').nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await shot('signed-up-dashboard');
    await uiLogout();
    await uiLogin();
    await openPractice();
    await expect(page.getByTestId('signin-hint')).toHaveCount(0);
    return { shot: await shot('logged-in-practice') };
  });

  const programs = {
    python: ['Python', 'print("hello-python")'],
    javascript: ['JavaScript', 'console.log("hello-javascript");'],
    java: ['Java', 'public class Main { public static void main(String[] args) { System.out.println("hello-java"); } }'],
    c: ['C', '#include <stdio.h>\nint main(void){ printf("hello-c\\n"); return 0; }'],
    cpp: ['C++', '#include <iostream>\nint main(){ std::cout << "hello-cpp" << std::endl; return 0; }'],
  };
  for (const [lang, [label, code]] of Object.entries(programs)) {
    await step(`d-${lang}`, `Run a correct ${label} program`, async () => {
      await setLanguage(lang);
      const out = await runCode(code);
      if (/Compiler not installed/i.test(out)) {
        return { skipped: true, note: 'compiler not installed on the server', shot: await shot(`run-${lang}-compiler-missing`) };
      }
      expect(out).toContain('Status: Success');
      expect(out).toContain(`hello-${lang}`);
      return { shot: await shot(`run-${lang}`) };
    });
  }

  await step('e', 'Program that prints env vars and tries to read secret files leaks nothing', async () => {
    await setLanguage('python');
    const canaryPath = canaryFile.replace(/\\/g, '\\\\');
    const out = await runCode([
      'import importlib',
      'o = importlib.import_module("o" + "s")',
      'print("env keys:", sorted(o.environ.keys()))',
      'print("JWT_SECRET_KEY:", o.environ.get("JWT_SECRET_KEY"))',
      `for p in (".env", "../.env", "${canaryPath}"):`,
      '    try:',
      '        print("READ", p, "->", open(p).read()[:200])',
      '    except Exception as e:',
      '        print("cannot read", p, type(e).__name__)',
    ].join('\n'));
    const s = await shot('env-and-file-read');
    expect(out).not.toContain(CANARY_VALUE);
    expect(out).not.toContain('CANARY-');
    expect(out).toContain('cannot read');
    expect(out).toContain('JWT_SECRET_KEY: None');
    return { shot: s };
  });

  await step('f', 'Infinite loop is stopped with a time-limit message; page stays usable', async () => {
    const started = Date.now();
    const out = await runCode('while True:\n    pass');
    const seconds = (Date.now() - started) / 1000;
    const s = await shot('infinite-loop');
    expect(out).toMatch(/Time limit exceeded/i);
    expect(seconds).toBeLessThan(12);
    await expect(runButton()).toBeEnabled();
    await setLanguage('javascript'); // the page still responds
    await setLanguage('python');
    return { note: `stopped after ${seconds.toFixed(1)}s (6s program limit + container start-up)`, shot: s };
  });

  await step('g', 'Program printing 1 MB of text is truncated', async () => {
    const out = await runCode('print("A" * 1048576)');
    const s = await shot('one-megabyte-output');
    expect(out).toContain('[output truncated at 64 KB]');
    expect(out.length).toBeLessThan(200000);
    return { shot: s };
  });

  await step('h', 'Clicking Run 12 times quickly hits the rate limit', async () => {
    codeRunStatuses.length = 0;
    await editor().fill('print(1)');
    let s = '';
    let noticeText = '';
    for (let i = 0; i < 12; i += 1) {
      await runButton().click();
      await expect(page.getByRole('button', { name: /Running/ })).toBeHidden({ timeout: 60000 });
      const notice = page.getByTestId('execution-notice');
      if (await notice.count()) { // stop at the first rejection so the message is what the picture shows
        noticeText = (await notice.first().innerText()).replace(/\s+/g, ' ');
        s = await shot('rate-limited');
        break;
      }
    }
    const ok = codeRunStatuses.filter((c) => c === 200).length;
    const limited = codeRunStatuses.filter((c) => c === 429).length;
    expect(limited, `statuses: ${codeRunStatuses.join(',')}`).toBeGreaterThan(0);
    expect(noticeText).toMatch(/Slow down a little/i);
    return { note: `${ok} runs allowed, then 429: "${noticeText.slice(0, 90)}..."`, shot: s };
  });

  await step('i', 'Loop-forever and file-read sent to the API without a valid token get 401', async () => {
    const expired = execFileSync(PY, [path.join(here, 'helpers', 'make_expired_token.py')], { cwd: root }).toString().trim();
    const bodies = [
      { language: 'python', source_code: 'while True:\n    pass' },
      { language: 'python', source_code: `print(open(${JSON.stringify(canaryFile)}).read())` },
    ];
    const tokens = { missing: null, garbage: 'not.a.token', expired };
    const seen = [];
    for (const [kind, token] of Object.entries(tokens)) {
      for (const body of bodies) {
        const started = Date.now();
        const res = await page.request.post(`${API}/practice/code/run`, {
          data: body,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const text = await res.text();
        expect(res.status(), `${kind} token`).toBe(401);
        expect(text).not.toContain(CANARY_VALUE);
        expect(Date.now() - started).toBeLessThan(3000); // rejected immediately, nothing was executed
        seen.push(`${kind}:${res.status()}`);
      }
    }
    await page.goto('/practice');
    return { note: `6 requests -> ${seen.join(' ')}`, shot: await shot('api-401-no-execution') };
  });

  await step('j', 'Submit a coding problem and show the verdict', async () => {
    await page.waitForTimeout(65000); // let the per-minute rate-limit window reset
    await openPractice();
    await setLanguage('python');
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await expect(page.getByRole('button', { name: /Evaluating/ })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Evaluating/ })).toBeHidden({ timeout: 90000 });
    await shot('submit-test-cases');
    await page.getByRole('button', { name: 'Terminal Output' }).click();
    const out = await outputText();
    const verdict = (out.match(/Status: ([A-Za-z ]+)/) || [])[1] || '';
    const s = await shot('submit-verdict');
    expect(verdict, 'a verdict should be shown').not.toBe('');
    return { note: `verdict: ${verdict.trim()}`, shot: s };
  });

  await step('k', 'Log out, log in again, refresh: the session survives', async () => {
    await uiLogout();
    await uiLogin();
    await openPractice();
    await page.reload();
    await expect(runButton()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('signin-hint')).toHaveCount(0); // still signed in after the reload
    await setLanguage('python');
    const out = await runCode('print("still-signed-in")');
    expect(out).toContain('still-signed-in');
    return { shot: await shot('session-survives-refresh') };
  });

  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed.map((r) => `${r.id}: ${r.note}`), 'failing steps').toEqual([]);
});
