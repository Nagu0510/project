// P6: courses, recommendations, the new question bank and resume-driven practice, in a real (headed) Chrome against the real app
// and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p6-learning
// New test student -> Courses (mark a module done) -> Dashboard recommendations and 4-week plan -> take an assessment set ->
// upload a resume -> "Fix this gap with this course" -> "Practice for TCS" -> finish a course and see its notification.
// Screenshots: e2e/screenshots/p6/. The test student is deleted at the end. Passwords are generated here and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p6');
const FIXTURES = path.join(root, 'backend', 'tests', 'fixtures');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-p6-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;

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
    try { await page.screenshot({ path: path.join(SHOTS, `${id}-FAILED.png`), fullPage: true }); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
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

test('courses, recommendations, questions and resume practice work end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P6 Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await expect(page.getByTestId('recommendations')).toBeVisible({ timeout: 20000 });
  });

  await step('02', 'Courses page lists the 13 courses with filters', async () => {
    await page.goto('/courses');
    await expect(page.getByTestId('course-card').first()).toBeVisible({ timeout: 30000 });
    expect(await page.getByTestId('course-card').count()).toBe(13);
    await page.getByLabel('Filter by level').selectOption('Advanced');
    expect(await page.getByTestId('course-card').count()).toBe(1);
    await expect(page.getByTestId('course-card')).toContainText('Deep Learning and AI');
    await page.getByLabel('Filter by level').selectOption('All');
    await shot('01-courses');
  });

  await step('03', 'Open SQL and DBMS, mark a module done, progress survives a reload', async () => {
    await page.getByTestId('course-card').filter({ hasText: 'SQL and DBMS' }).click();
    await expect(page.getByTestId('course-title')).toHaveText('SQL and DBMS');
    expect(await page.getByTestId('module').count()).toBe(8);
    await expect(page.getByText('Where to learn')).toBeVisible();
    const first = page.getByTestId('module-toggle').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('course-progress')).toHaveAttribute('data-percent', '13'); // 1 of 8 modules, rounded
    await page.reload();
    await expect(page.getByTestId('module-toggle').first()).toHaveAttribute('aria-checked', 'true', { timeout: 15000 });
    await shot('02-course-module-done');
  });

  await step('04', 'Dashboard: five recommended courses with reasons and a 4-week plan', async () => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('recommended-course').first()).toBeVisible({ timeout: 20000 });
    expect(await page.getByTestId('recommended-course').count()).toBe(5);
    const reasons = await page.getByTestId('recommendation-reason').allInnerTexts();
    expect(reasons.every((r) => r.trim().length > 5)).toBe(true);
    expect(reasons.join(' ')).toContain('Backend Developer path needs');
    await expect(page.getByTestId('recommended-course').filter({ hasText: 'SQL and DBMS' })).toContainText('Continue where you left off');
    expect(await page.getByTestId('plan-week').count()).toBe(4);
    await expect(page.getByTestId('study-plan')).toContainText('Your 4-week study plan');
    await shot('03-dashboard-recommendations');
    return `${reasons.length} reasons; first: ${reasons[0].slice(0, 60)}`;
  });

  await step('05', 'Assessment: C (Easy) shows code questions and scores', async () => {
    await page.goto('/assessment');
    await page.locator('select:has(option[value="Deep Learning & AI"])').selectOption('C');
    await page.getByRole('button', { name: 'Easy', exact: true }).click();
    const card = page.locator('h3', { hasText: /^C \(Easy\)$/ }).locator('xpath=ancestor::div[.//button[contains(., "Start Assessment")]][1]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.getByRole('button', { name: /Start Assessment/ }).click();
    await expect(page.getByText('Question 1 of 8')).toBeVisible({ timeout: 20000 });
    let sawCode = false;
    for (let i = 0; i < 8; i += 1) {
      if (await page.getByTestId('question-code').count()) sawCode = true;
      if (i === 1) await shot('04-assessment-code-question');
      await page.getByTestId('assessment-option').nth(i % 4).click();
      if (i < 7) await page.getByRole('button', { name: /Next Question/ }).click();
    }
    expect(sawCode, 'a Code Output or Find the Error question shows its snippet').toBe(true);
    await page.getByRole('button', { name: /Submit Assessment/ }).click();
    await page.waitForURL('**/assessment-results', { timeout: 30000 });
    await expect(page.getByText(/Passed|Below the 70% pass mark/)).toBeVisible({ timeout: 15000 });
    await shot('05-assessment-result');
  });

  await step('06', 'Practice mode: company style filter shows "Pattern-inspired practice" tags', async () => {
    await page.goto('/assessment');
    await page.getByTestId('practice-style').selectOption('TCS');
    await page.locator('select:has(option[value="Deep Learning & AI"])').selectOption('Python');
    await page.getByRole('button', { name: /Skill Practice Mode/ }).click();
    await expect(page.getByTestId('pattern-tags')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('pattern-tags')).toContainText('Pattern-inspired practice');
    await expect(page.getByTestId('pattern-tags')).toContainText('TCS-style');
    await expect(page.locator('body')).not.toContainText('real past question');
    await shot('06-practice-pattern-tags');
  });

  let courseLinkTitle = '';
  await step('07', 'Resume: upload, then follow "Fix this gap with this course"', async () => {
    await page.goto('/resume-analyzer');
    await expect(page.getByTestId('resume-role')).toHaveValue('Backend Developer', { timeout: 15000 });
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
    await expect(page.getByTestId('report')).toBeVisible({ timeout: 90000 });
    const link = page.getByTestId('fix-course-link').first();
    await expect(link).toBeVisible();
    courseLinkTitle = (await link.innerText()).replace('Fix this gap with this course:', '').replace('→', '').trim();
    await shot('07-resume-fix-with-course');
    await link.click();
    await page.waitForURL('**/courses/**');
    await expect(page.getByTestId('course-title')).toHaveText(courseLinkTitle);
    await shot('08-fix-course-page');
    return courseLinkTitle;
  });

  await step('08', 'Resume: "Practice for TCS" opens a personal set with prompts and TCS-style questions', async () => {
    await page.goto('/resume-analyzer');
    await expect(page.getByTestId('resume-role')).toHaveValue('Backend Developer', { timeout: 15000 });
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
    await expect(page.getByTestId('report')).toBeVisible({ timeout: 90000 });
    await page.getByTestId('practice-company-select').selectOption('TCS');
    await page.getByTestId('practice-company-button').click();
    await page.waitForURL('**/resume-practice**');
    await expect(page.getByTestId('practice-title')).toHaveText('Practice for TCS');
    await expect(page.getByTestId('practice-question').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('disclaimer')).toContainText('not real past questions');
    const prompts = await page.getByTestId('prompts').innerText();
    expect(prompts).toContain('generated template');
    expect(prompts).toMatch(/You list \w+/);
    const tags = await page.getByTestId('pattern-tags').allInnerTexts();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((t) => t.toLowerCase().includes('tcs-style'))).toBe(true); // badges render upper case
    await page.getByTestId('practice-option').first().click();
    await expect(page.getByTestId('feedback').first()).toBeVisible();
    await expect(page.getByTestId('score')).toBeVisible();
    await shot('09-practice-for-tcs');
    return `${await page.getByTestId('practice-question').count()} questions`;
  });

  await step('09', 'Finishing a course creates a real notification in the bell', async () => {
    await page.goto('/courses/placement-aptitude');
    await expect(page.getByTestId('module').first()).toBeVisible({ timeout: 20000 });
    const toggles = page.getByTestId('module-toggle');
    const n = await toggles.count();
    for (let i = 0; i < n; i += 1) {
      await toggles.nth(i).click();
      await expect(toggles.nth(i)).toHaveAttribute('aria-checked', 'true');
    }
    await expect(page.getByTestId('course-progress')).toHaveAttribute('data-percent', '100');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Notifications' }).first().click();
    await expect(page.getByText('You finished Placement Aptitude')).toBeVisible({ timeout: 15000 });
    await shot('10-notification');
  });

  await step('10', 'No link to a retired practice problem remains on the pages visited', async () => {
    const old = await page.evaluate(async () => {
      const slugs = ['two-sum', 'valid-palindrome', 'fibonacci-number', 'lru-cache'];
      return slugs.filter((s) => document.documentElement.innerHTML.includes(`problem=${s}`));
    });
    expect(old).toEqual([]);
  });

  await step('11', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
