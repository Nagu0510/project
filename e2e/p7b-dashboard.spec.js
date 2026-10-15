// P7b: readiness, dashboards, report and exports, in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p7b-dashboard
// (a) a new student sees zeros and first-step buttons; (b) after one assessment, one Accepted coding submission and one resume
// upload the dashboard numbers change and match the API; (c) the report PDF downloads and is a PDF; (d) admin pages, only if
// ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD are set. Screenshots: e2e/screenshots/p7b/. The test student is deleted at the end.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p7b');
const FIXTURES = path.join(root, 'backend', 'tests', 'fixtures');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-p7b-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const adminConfigured = Boolean(process.env.ADMIN_TEST_EMAIL && process.env.ADMIN_TEST_PASSWORD);

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
    entry.note = String(err.message).split('\n')[0].slice(0, 260);
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

// open the dashboard and capture the exact JSON the page received
async function openDashboard() {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === '/api/student/dashboard' && r.ok(), { timeout: 30000 }),
    page.goto('/dashboard'),
  ]);
  const api = await resp.json();
  await expect(page.getByTestId('readiness-score')).toBeVisible({ timeout: 20000 });
  return api;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ acceptDownloads: true });
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
  console.log(`  Admin account configured (ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD): ${adminConfigured ? 'yes' : 'NO, admin steps were skipped'}`);
  console.log(`  5xx responses from /api: ${serverErrors.length ? serverErrors.join(', ') : 'none'}`);
  console.log(`  App console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('readiness, dashboards, report and exports work end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P7b Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', '(a) A new student sees zeros and first-step buttons', async () => {
    const api = await openDashboard();
    expect(api.has_data).toBe(false);
    expect(api.career_readiness).toBe(0);
    expect(api.score_history).toEqual([]);
    await expect(page.getByTestId('readiness-score')).toHaveText('0%');
    const steps = page.getByTestId('first-steps');
    await expect(steps).toBeVisible();
    for (const label of ['Take your first assessment', 'Upload your resume', 'Solve your first problem']) await expect(steps.getByRole('link', { name: label })).toBeVisible();
    const values = await page.getByTestId('readiness-part').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
    expect(values).toEqual(['0', '0', '0', '0', '0']);
    await expect(page.getByTestId('score-history')).toContainText('will appear here');
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-error')).toHaveCount(0);
    await shot('01-new-student-dashboard');
  });

  await step('03', '(a) The profile of a new student shows no invented name, numbers or progress', async () => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-stats')).toBeVisible({ timeout: 20000 });
    const stats = await page.getByTestId('profile-stats').innerText();
    expect(stats.replace(/\s+/g, ' ')).toMatch(/career readiness 0% roadmap progress 0% assessments 0/i); // labels are upper-cased by CSS
    const body = await page.locator('main').innerText();
    for (const fake of ['Nagappa', 'Cleared', '87%', '74%', 'Strong Foundations']) expect(body).not.toContain(fake);
    await expect(page.getByText('Take an assessment to see your strengths.')).toBeVisible();
    await shot('02-new-student-profile');
  });

  await step('04', 'Take one assessment (C, Easy)', async () => {
    await page.goto('/assessment');
    await page.locator('select:has(option[value="Deep Learning & AI"])').selectOption('C');
    await page.getByRole('button', { name: 'Easy', exact: true }).click();
    const card = page.locator('h3', { hasText: /^C \(Easy\)$/ }).locator('xpath=ancestor::div[.//button[contains(., "Start Assessment")]][1]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.getByRole('button', { name: /Start Assessment/ }).click();
    await expect(page.getByText('Question 1 of 8')).toBeVisible({ timeout: 20000 });
    for (let i = 0; i < 8; i += 1) {
      await page.getByTestId('assessment-option').nth(i % 4).click();
      if (i < 7) await page.getByRole('button', { name: /Next Question/ }).click();
    }
    await page.getByRole('button', { name: /Submit Assessment/ }).click();
    await page.waitForURL('**/assessment-results', { timeout: 30000 });
  });

  await step('05', 'One Accepted coding submission (sum of two numbers, Python)', async () => {
    await page.goto('/practice?problem=sum-two-numbers');
    await expect(page.getByRole('heading', { name: 'Sum of Two Numbers' })).toBeVisible({ timeout: 30000 });
    await page.getByLabel('Code editor').fill('import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n');
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'Accepted', { timeout: 120000 });
  });

  await step('06', 'One resume upload', async () => {
    await page.goto('/resume-analyzer');
    await expect(page.getByTestId('resume-role')).toHaveValue('Backend Developer', { timeout: 15000 });
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
    await expect(page.getByTestId('report')).toBeVisible({ timeout: 90000 });
  });

  let after;
  await step('07', '(b) The dashboard numbers changed and match the API', async () => {
    after = await openDashboard();
    expect(after.has_data).toBe(true);
    expect(after.assessments_completed).toBe(1);
    expect(after.problems_solved).toBe(1);
    expect(after.resume_score).toBeGreaterThan(0);
    expect(after.career_readiness).toBeGreaterThan(0);
    expect(after.score_history.map((h) => h.kind).sort()).toEqual(['assessment', 'resume']);
    await expect(page.getByTestId('readiness-score')).toHaveText(`${after.career_readiness}%`);
    const dom = await page.getByTestId('readiness-part').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-key'), Number(e.getAttribute('data-value'))])));
    for (const p of after.readiness_parts) expect(dom[p.key], `part ${p.key}`).toBe(p.value);
    const parts = Object.fromEntries(after.readiness_parts.map((p) => [p.key, p]));
    expect(parts.assessments.has_data && parts.coding.value === 100 && parts.resume.value === after.resume_score).toBe(true);
    expect(await page.getByTestId('score-history').locator('svg').getAttribute('data-points')).toBe('2');
    await expect(page.getByTestId('first-steps')).toHaveCount(0); // every first step is done
    await expect(page.getByTestId('next-course')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('next-practice-set')).toBeVisible();
    await shot('03-dashboard-after-activity');
    return `readiness ${after.career_readiness}% (${after.readiness_parts.map((p) => `${p.key} ${p.value}`).join(', ')}); streak ${after.streak_days}`;
  });

  await step('08', 'The profile shows the same numbers', async () => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-stats')).toContainText(`${after.career_readiness}%`, { timeout: 20000 });
    await shot('04-profile-after-activity');
  });

  await step('09', '(c) Download the report PDF from the dashboard and confirm it is a PDF', async () => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('download-report')).toBeVisible({ timeout: 20000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByTestId('download-report').click()]);
    expect(download.suggestedFilename()).toBe('skillsense-career-report.pdf');
    const file = path.join(SHOTS, 'career-report.pdf');
    await download.saveAs(file);
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.subarray(-8).toString('latin1')).toContain('%%EOF');
    expect(bytes.length).toBeGreaterThan(2000);
    await shot('05-after-report-download');
    return `${bytes.length} bytes, saved as e2e/screenshots/p7b/career-report.pdf`;
  });

  await step('10', '(d) Admin dashboard, analytics, students and CSV export (needs ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD)', async () => {
    if (!adminConfigured) return 'SKIPPED: ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD are not set in this environment';
    const adminContext = await page.context().browser().newContext({ acceptDownloads: true });
    const ap = await adminContext.newPage();
    try {
      await ap.goto('/admin/login');
      await ap.locator('input[type="email"]').fill(process.env.ADMIN_TEST_EMAIL);
      await setSecret(ap.locator('input[type="password"]'), process.env.ADMIN_TEST_PASSWORD);
      await ap.getByRole('button', { name: /Access Admin/ }).click();
      await ap.waitForURL('**/admin/dashboard', { timeout: 30000 });
      await expect(ap.getByText('Registered Students')).toBeVisible({ timeout: 20000 });
      await ap.screenshot({ path: path.join(SHOTS, '06-admin-dashboard.png'), fullPage: true });
      await ap.goto('/admin/analytics');
      await expect(ap.getByText(/Average readiness of assessed students|No student has taken an assessment yet/)).toBeVisible({ timeout: 20000 });
      await ap.screenshot({ path: path.join(SHOTS, '07-admin-analytics.png'), fullPage: true });
      await ap.goto('/admin/students');
      await expect(ap.getByTestId('student-count')).toBeVisible({ timeout: 20000 });
      await ap.getByLabel('Search students').fill(email);
      await expect(ap.getByTestId('student-count')).toContainText('Showing 1 of');
      await expect(ap.getByTestId('student-attempts')).toHaveText('2'); // one assessment + one coding submission
      await ap.screenshot({ path: path.join(SHOTS, '08-admin-students.png'), fullPage: true });
      const [download] = await Promise.all([ap.waitForEvent('download', { timeout: 60000 }), ap.getByTestId('export-csv').click()]);
      const csvFile = path.join(SHOTS, 'students-export.csv');
      await download.saveAs(csvFile);
      const csv = fs.readFileSync(csvFile, 'utf8');
      expect(csv.replace(/^﻿/, '').split('\n')[0]).toContain('Name,Email,Career path,Readiness %');
      expect(csv).toContain(email);
      return 'dashboard, analytics, students and CSV export checked';
    } finally {
      await adminContext.close();
    }
  });

  await step('11', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
