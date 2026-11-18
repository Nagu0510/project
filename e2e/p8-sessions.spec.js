// P8: assessment sessions, review, topic bands and the roadmap, in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p8-sessions
// A new test student takes "Python (Easy)", refreshes half way and carries on, submits, reads the review and the topic bands,
// opens the roadmap (priority markers, locked milestones, course links), tries to submit the same session again through the
// API (409), lets a session run out (auto-submit) and sees the message for an expired one. Screenshots: e2e/screenshots/p8/.
// The test student is deleted at the end.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p8');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-p8-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const SET_ID = 'asm-py-easy';
const SET_TITLE = 'Python (Easy)';

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

const moveDeadline = (seconds) => execFileSync(PY, [path.join(here, 'helpers', 'move_session_deadline.py'), email, String(seconds)], { cwd: root }).toString().trim();
const timerSeconds = async () => {
  const [m, s] = (await page.getByTestId('assessment-timer').innerText()).match(/(\d+):(\d+)/).slice(1).map(Number);
  return m * 60 + s;
};

async function openCatalogAndStart() {
  await page.goto('/assessment');
  await page.locator('select:has(option[value="Deep Learning & AI"])').selectOption('Python');
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  const card = page.locator('h3', { hasText: new RegExp(`^${SET_TITLE.replace(/[()]/g, '\\$&')}$`) }).locator('xpath=ancestor::div[.//button[contains(., "Start Assessment")]][1]');
  await expect(card).toBeVisible({ timeout: 20000 });
  const started = page.waitForResponse((r) => /\/assessments\/[^/]+\/start$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  await card.getByRole('button', { name: /Start Assessment/ }).click();
  return (await started).json();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { const h = r.headers().authorization; if (h && new URL(r.url()).pathname.startsWith('/api/')) bearer = h; });
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

test('sessions, review, bands and roadmap work end to end', async () => {
  let session = null;       // the first session: { session_id, ... }
  let result = null;        // its graded result (API JSON)

  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P8 Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', 'Roadmap before any assessment: first milestone open, the rest locked, no priority markers', async () => {
    await page.goto('/roadmap');
    await expect(page.getByText('P8 Test Student')).toBeVisible({ timeout: 20000 }); // signed in again after the page load
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/student/career-path' && r.ok());
    await page.locator('select:has(option[value="Python Developer"])').selectOption('Python Developer');
    await saved; // the path is stored on the server, which progress needs
    await expect(page.locator('[data-testid="milestone-card"]:visible')).toHaveCount(10, { timeout: 30000 });
    await expect(page.locator('[data-testid="milestone-card"]:visible[data-status="not_started"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="milestone-card"]:visible[data-status="locked"]')).toHaveCount(9);
    await expect(page.locator('[data-testid="milestone-card"]:visible[data-priority="true"]')).toHaveCount(0);
    await expect(page.getByTestId('up-next-item')).toHaveCount(1);
    await shot('01-roadmap-new-student');
  });

  await step('03', 'Results page of a new student is an empty state (404), not a made-up baseline', async () => {
    const [resp] = await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === '/api/assessments/result/latest'),
      page.goto('/assessment-results'),
    ]);
    expect(resp.status()).toBe(404);
    await expect(page.getByText('No assessment taken yet')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Take your first assessment' })).toBeVisible();
    await shot('02-results-empty-state');
  });

  await step('04', 'Start Python (Easy): timer counts down, answers 1-3, then a refresh keeps the session and the answers', async () => {
    const started = await openCatalogAndStart();
    expect(started.resumed).toBe(false);
    expect(started.questions).toHaveLength(8);
    expect(started.questions.every((q) => q.correct_option_index === null)).toBe(true); // no answer keys before submit
    session = started;
    await expect(page.getByText('Question 1 of 8')).toBeVisible({ timeout: 20000 });
    const before = await timerSeconds();
    expect(before).toBeGreaterThan(11 * 60 - 20);
    for (let i = 0; i < 3; i += 1) {
      const saved = page.waitForResponse((r) => /\/assessments\/sessions\/[^/]+\/answers$/.test(new URL(r.url()).pathname) && r.ok(), { timeout: 20000 });
      await page.getByTestId('assessment-option').nth(0).click();
      await saved; // the answer is stored on the server before the page is refreshed
      await page.getByRole('button', { name: /Next Question/ }).click();
    }
    await expect(page.getByTestId('answered-count')).toContainText('3/8');
    await shot('03-test-running');

    const resumed = page.waitForResponse((r) => /\/assessments\/[^/]+\/start$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
    await page.reload();
    const again = await (await resumed).json();
    expect(again.resumed).toBe(true);
    expect(again.session_id).toBe(session.session_id);
    expect(again.questions.map((q) => q.id)).toEqual(session.questions.map((q) => q.id)); // same questions, same order
    await expect(page.getByText('Question 4 of 8')).toBeVisible({ timeout: 20000 }); // carries on at the first unanswered one
    await expect(page.getByTestId('answered-count')).toContainText('3/8');
    expect(await timerSeconds()).toBeLessThan(before + 1); // the deadline did not restart
    await shot('04-after-refresh');
    return `session ${again.session_id.slice(0, 12)}…, ${again.answers ? Object.keys(again.answers).length : 0} answers restored`;
  });

  await step('05', 'Answer the rest and submit; the result matches the API', async () => {
    for (let i = 3; i < 8; i += 1) {
      await page.getByTestId('assessment-option').nth(0).click();
      if (i < 7) await page.getByRole('button', { name: /Next Question/ }).click();
    }
    const submitted = page.waitForResponse((r) => /\/assessments\/[^/]+\/submit$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 30000 });
    await page.getByTestId('submit-assessment').click();
    const resp = await submitted;
    expect(resp.status()).toBe(200);
    result = await resp.json();
    await page.waitForURL('**/assessment-results', { timeout: 30000 });
    expect(result.session_id).toBe(session.session_id);
    expect(result.total_questions).toBe(8);
    expect(result.review).toHaveLength(8);
    return `score ${result.overall_score}%, gap topics: ${result.gap_topics.join(', ') || 'none'}`;
  });

  await step('06', 'Results page: score, topic bands, gap list, next steps with a course link, review with explanations', async () => {
    await expect(page.getByTestId('result-title')).toHaveText(SET_TITLE, { timeout: 20000 });
    await expect(page.getByTestId('overall-score')).toHaveText(`${result.overall_score}%`);
    const bands = await page.getByTestId('topic-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-band')));
    expect(bands).toEqual(result.topic_scores.map((t) => (t.score >= 80 ? 'strong' : t.score >= 60 ? 'developing' : 'gap')));
    expect(bands).toEqual(result.topic_scores.map((t) => t.band));
    await expect(page.getByTestId('gap-list')).toBeVisible();
    for (const topic of result.gap_topics) await expect(page.getByTestId('gap-list')).toContainText(topic);
    const courseLink = page.getByTestId('next-steps').locator('a[href^="/courses/"]').first();
    await expect(courseLink).toBeVisible();
    expect(await courseLink.getAttribute('href')).toBe('/courses/python-programming');

    const items = page.getByTestId('review-item');
    await expect(items).toHaveCount(8);
    await expect(page.getByTestId('review-correct')).toHaveCount(8); // every question shows its correct answer
    await expect(page.getByTestId('review').getByText(/Why:/)).toHaveCount(8);
    const wrong = 8 - result.correct_count;
    await page.getByTestId('only-wrong').check();
    await expect(items).toHaveCount(wrong);
    await page.getByTestId('only-wrong').uncheck();
    await expect(items).toHaveCount(8);
    await shot('05-results-top');
    await page.getByTestId('review').scrollIntoViewIfNeeded();
    await shot('06-results-review');
    return `${result.correct_count}/8 correct, ${wrong} wrong in the review`;
  });

  await step('07', 'Submitting the same session again through the API is rejected with 409', async () => {
    expect(bearer).toMatch(/^Bearer /);
    const again = await page.request.post(`/api/assessments/${SET_ID}/submit`, {
      headers: { Authorization: bearer },
      data: { session_id: session.session_id, answers: {} },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).detail).toMatch(/already submitted/i);
    const latest = await (await page.request.get('/api/assessments/result/latest', { headers: { Authorization: bearer } })).json();
    expect(latest.attempt_id).toBe(result.attempt_id); // no second attempt was stored
    return '409 and still one attempt';
  });

  await step('08', 'Roadmap: priority markers, locked milestones, course links; completing milestone 1 unlocks 2 and puts it first', async () => {
    await page.goto('/roadmap');
    await expect(page.locator('[data-testid="milestone-card"]:visible')).toHaveCount(10, { timeout: 30000 });
    const priority = page.locator('[data-testid="milestone-card"]:visible[data-priority="true"]');
    expect(await priority.count()).toBeGreaterThan(0);
    await expect(priority.first()).toContainText('Priority gap');
    await expect(page.locator('[data-testid="milestone-card"]:visible[data-status="locked"]').first()).toContainText('Complete the milestone before it');
    const links = page.locator('[data-testid="milestone-course"]:visible');
    expect(await links.count()).toBeGreaterThan(0);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) expect(href).toMatch(/^\/courses\/[a-z0-9-]+$/);
    await shot('07-roadmap-priority');

    await page.locator('[data-testid="milestone-card"]:visible').nth(0).click();
    await page.getByRole('button', { name: 'Mark as Completed' }).click();
    await expect(page.locator('[data-testid="milestone-card"]:visible[data-status="completed"]')).toHaveCount(1, { timeout: 20000 });
    const first = page.getByTestId('up-next-item').first();
    await expect(first).toContainText('Milestone 2');
    await expect(first).toHaveAttribute('data-priority', 'true'); // the priority gap is first among what is open
    await page.keyboard.press('Escape');
    await shot('08-roadmap-after-completing-1');
  });

  await step('09', 'Roadmap failure shows an error with Try again, and retrying loads it', async () => {
    await page.route('**/api/student/roadmap*', (route) => route.abort());
    await page.goto('/roadmap');
    await expect(page.getByTestId('error-banner').first()).toBeVisible({ timeout: 30000 });
    await shot('09-roadmap-error');
    await page.unroute('**/api/student/roadmap*');
    await page.getByRole('button', { name: /Try again/ }).first().click();
    await expect(page.locator('[data-testid="milestone-card"]:visible')).toHaveCount(10, { timeout: 30000 });
  });

  await step('10', 'A session that runs out is submitted by itself', async () => {
    await openCatalogAndStart();
    await expect(page.getByText('Question 1 of 8')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('assessment-option').nth(1).click();
    moveDeadline(15);
    await page.reload();
    await expect(page.getByTestId('assessment-timer')).toBeVisible({ timeout: 20000 });
    expect(await timerSeconds()).toBeLessThan(16);
    await page.waitForURL('**/assessment-results', { timeout: 60000 });
    await expect(page.getByTestId('overall-score')).toBeVisible({ timeout: 20000 });
    await shot('10-auto-submitted-result');
  });

  await step('11', 'A session that already expired shows a clear message, not a blank page', async () => {
    await openCatalogAndStart();
    await expect(page.getByText('Question 1 of 8')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('assessment-option').nth(1).click();
    moveDeadline(-120); // well past the 30 s grace
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByTestId('submit-assessment').click();
    const problem = page.getByTestId('session-problem');
    await expect(problem).toBeVisible({ timeout: 20000 });
    await expect(problem).toContainText('This session has expired');
    await shot('11-session-expired');
    await problem.getByRole('button', { name: /Back to the catalog/ }).click();
    await expect(page.getByRole('button', { name: 'Easy', exact: true })).toBeVisible();
  });

  await step('12', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
