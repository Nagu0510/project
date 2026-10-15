// P9 admin proof, in a real (headed) Chrome against the real app and real Atlas.
//   set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD, then:  npx playwright test -c e2e/playwright.config.js p9-admin
// It REFUSES to run without a real admin account (no stubbed session): the run stops with a clear message instead.
// Steps: log in as admin; open every admin page (no console errors, no 5xx); upload a small text paper and a scanned image paper
// (OCR); approve one question and see it in a student's previous questions; create (with a rejected invalid attempt first) and
// deactivate a test question and a test placement; as a student see the bell notifications and mark all read; a student gets 403 on
// an admin page. Screenshots: e2e/screenshots/p9/. Every test record and the test student are deleted afterwards; real data is untouched.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p9');
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const adminEmail = process.env.ADMIN_TEST_EMAIL;
const adminPassword = process.env.ADMIN_TEST_PASSWORD;
const stamp = Date.now();
const startedAt = new Date().toISOString();
const studentEmail = `p3-test-p9a-${stamp}@example.com`;
const studentPassword = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const QUESTION_ID = `p9-test-${stamp}`;
const COMPANY = `P9 Test Corp ${stamp}`;

const PAPER = [
  '1. Describe how a bloom filter reduces disk lookups in a distributed key value store.',
  '2. Explain why a skip list gives logarithmic search time without rebalancing like a tree.',
  '3. Compare write ahead logging with shadow paging for crash recovery in a database engine.',
].join('\n') + '\n';

let admin;      // admin page
let student;    // student page
let adminToken = '';
let studentToken = '';
const created = { papers: [], placements: [], questions: [] };
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
    for (const [name, p] of [['admin', admin], ['student', student]]) {
      try { if (p) await p.screenshot({ path: path.join(SHOTS, `admin-${id}-${name}-FAILED.png`), fullPage: true }); } catch { /* page may be gone */ }
    }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `admin-${name}.png`), fullPage: true });

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// The app's labels are plain <label> elements next to the input, not linked with htmlFor: find a field through its wrapper.
const field = (page, label) => page.locator('.form-control', { hasText: label }).locator('input, select, textarea').first();

const call = async (page, token, method, url, data) => {
  const res = await page.request.fetch(url, { method, headers: { Authorization: token }, data });
  return { status: res.status(), body: await res.json().catch(() => null) };
};

function watch(page, tokenSetter) {
  page.on('console', (m) => { if (m.type() === 'error' && !/google|gsi|accounts\.google|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { const h = r.headers().authorization; if (h && new URL(r.url()).pathname.startsWith('/api/')) tokenSetter(h); });
  page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 500) serverErrors.push(`${r.status()} ${u.pathname}`); });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  if (!adminEmail || !adminPassword) {
    throw new Error('STOPPED: ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD are not set. This proof needs a real admin account; it does not stub one. Set both and run again.');
  }
  admin = await (await browser.newContext({ acceptDownloads: true })).newPage();
  student = await (await browser.newContext()).newPage();
  watch(admin, (h) => { adminToken = h; });
  watch(student, (h) => { studentToken = h; });
});

test.afterAll(async () => {
  const out = [];
  try {
    const args = [path.join(here, 'helpers', 'cleanup_p9_admin.py'), '--since', startedAt];
    if (created.papers.length) args.push('--papers', ...created.papers);
    if (created.placements.length) args.push('--placements', ...created.placements);
    if (created.questions.length) args.push('--question', ...created.questions);
    out.push(execFileSync(PY, args, { cwd: root }).toString().trim());
  } catch (err) {
    out.push(`test-record cleanup FAILED: ${String(err.message).split('\n')[0]}`);
  }
  try {
    out.push(execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), studentEmail], { cwd: root }).toString().trim());
  } catch (err) {
    out.push(`student cleanup FAILED: ${String(err.message).split('\n')[0]}`);
  }
  console.log(`\n  Cleanup: ${out.join(' | ')}`);
  console.log(`  5xx responses from /api: ${serverErrors.length ? serverErrors.join(', ') : 'none'}`);
  console.log(`  App console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('admin hardening, content editor and notifications work end to end', async () => {
  await step('01', 'Register a test student (target company "Other") so papers can notify them', async () => {
    await student.goto('/signup');
    await student.locator('input[type="text"]').first().fill('P9 Admin Test Student');
    await student.locator('input[type="email"]').fill(studentEmail);
    const pw = student.locator('input[type="password"]');
    await setSecret(pw.nth(0), studentPassword);
    await setSecret(pw.nth(1), studentPassword);
    await student.getByRole('button', { name: /Create Free Account/ }).click();
    await student.waitForURL('**/dashboard', { timeout: 30000 });
    const profile = await call(student, studentToken, 'GET', '/api/student/profile');
    const saved = await call(student, studentToken, 'PUT', '/api/student/profile', { ...profile.body, target_companies: ['Other'] });
    expect(saved.status).toBe(200);
  });

  await step('02', 'Log in as admin', async () => {
    await admin.goto('/admin/login');
    await admin.locator('input[type="email"]').fill(adminEmail);
    await setSecret(admin.locator('input[type="password"]'), adminPassword);
    await admin.getByRole('button', { name: /Access Admin/ }).click();
    await admin.waitForURL('**/admin/dashboard', { timeout: 30000 });
  });

  await step('03', 'Every admin page opens with no error banner, console error or 5xx', async () => {
    const pages = ['/admin/dashboard', '/admin/analytics', '/admin/students', '/admin/question-papers', '/admin/companies', '/admin/content', '/admin/question-bank', '/admin/assessments'];
    for (const p of pages) {
      await admin.goto(p);
      await expect(admin.locator('h1').first()).toBeVisible({ timeout: 30000 });
      await admin.waitForLoadState('networkidle');
      await expect(admin.getByTestId('error-banner'), p).toHaveCount(0);
      await shot(admin, `page-${p.replace(/\W+/g, '_')}`);
    }
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
    return `${pages.length} pages`;
  });

  await step('04', 'Upload a small text paper: every question starts as Needs Review', async () => {
    await admin.goto('/admin/question-papers');
    await admin.getByRole('button', { name: /Upload Paper/ }).click();
    await admin.locator('.form-control', { hasText: 'Company' }).first().locator('select').selectOption('Other');
    await admin.getByPlaceholder('e.g. TCS NQT 2025').fill(`P9 Test Exam ${stamp}`);
    await admin.getByTestId('paper-file-input').setInputFiles({ name: 'p9-paper.txt', mimeType: 'text/plain', buffer: Buffer.from(PAPER) });
    const uploaded = admin.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/question-papers/upload'), { timeout: 60000 });
    await admin.getByRole('button', { name: /Upload & Analyze Paper/ }).click();
    const resp = await uploaded;
    expect(resp.status()).toBe(200);
    const paper = await resp.json();
    created.papers.push(paper.id);
    expect(paper.questions_count).toBe(3);
    expect(paper.ocr_used).toBe(false);
    await expect(admin.getByTestId('review-card').first()).toBeVisible({ timeout: 30000 });
    const mine = await call(admin, adminToken, 'GET', `/api/admin/question-papers/${paper.id}/questions`);
    expect(mine.body.map((q) => q.status)).toEqual(['needs_review', 'needs_review', 'needs_review']);
    await shot(admin, 'upload-text-paper');
    return paper.id;
  });

  await step('05', 'Upload a scanned image paper: it is read with OCR and starts as Needs Review', async () => {
    const image = path.join(os.tmpdir(), `p9-scan-${stamp}.png`);
    execFileSync(PY, [path.join(here, 'helpers', 'make_paper_scan.py'), image], { cwd: root });
    await admin.goto('/admin/question-papers');
    await admin.getByRole('button', { name: /Upload Paper/ }).click();
    await admin.locator('.form-control', { hasText: 'Company' }).first().locator('select').selectOption('Other');
    await admin.getByPlaceholder('e.g. TCS NQT 2025').fill(`P9 Test Scan ${stamp}`);
    await admin.getByTestId('paper-file-input').setInputFiles(image);
    const uploaded = admin.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/question-papers/upload'), { timeout: 120000 });
    await admin.getByRole('button', { name: /Upload & Analyze Paper/ }).click();
    const resp = await uploaded;
    const body = await resp.json();
    expect(resp.status(), JSON.stringify(body).slice(0, 200)).toBe(200);
    created.papers.push(body.id);
    expect(body.ocr_used).toBe(true);
    expect(body.source_kind).toBe('png');
    const qs = await call(admin, adminToken, 'GET', `/api/admin/question-papers/${body.id}/questions`);
    expect(qs.body.length).toBeGreaterThan(0);
    expect(new Set(qs.body.map((q) => q.status))).toEqual(new Set(['needs_review']));
    fs.rmSync(image, { force: true });
    await shot(admin, 'upload-scanned-paper');
    return `OCR confidence ${body.ocr_confidence}%, ${body.questions_count} questions`;
  });

  await step('06', 'Approve one question: it appears in the student previous questions and the student is notified', async () => {
    const paperId = created.papers[0];
    const qs = await call(admin, adminToken, 'GET', `/api/admin/question-papers/${paperId}/questions`);
    const target = qs.body[0];
    await admin.goto('/admin/question-papers');
    await admin.getByRole('button', { name: /Review Extracted/ }).click();
    const card = admin.getByTestId('review-card').filter({ hasText: 'bloom filter' }).first();
    await expect(card).toBeVisible({ timeout: 30000 });
    const approved = admin.waitForResponse((r) => r.url().includes(`/extracted-questions/${target.id}/status`) && r.request().method() === 'PUT');
    await card.getByRole('button', { name: 'Approve' }).click();
    expect((await approved).status()).toBe(200);
    const stored = await call(admin, adminToken, 'GET', `/api/admin/question-papers/${paperId}/questions`);
    const first = stored.body.find((q) => q.id === target.id);
    expect(first.status).toBe('approved');
    expect(first.approved_by).toBeTruthy();
    expect(first.approved_at).toBeTruthy();
    expect(stored.body.filter((q) => q.status === 'needs_review')).toHaveLength(2);
    const visible = await call(student, studentToken, 'GET', '/api/previous-questions?company=Other&page_size=100');
    expect(visible.body.map((q) => q.id)).toContain(`pq-${target.id}`);
    expect(visible.body.filter((q) => q.id.startsWith('pq-') && stored.body.some((s) => `pq-${s.id}` === q.id)).length).toBe(1); // the two unreviewed ones are not there
    await shot(admin, 'approved-question');
  });

  await step('07', 'The student bell shows the notifications and Read all works', async () => {
    const done = await call(student, studentToken, 'POST', '/api/assessments/asm-py-easy/start');
    await call(student, studentToken, 'POST', '/api/assessments/asm-py-easy/submit', { session_id: done.body.session_id, answers: {} });
    await student.goto('/dashboard');
    await student.getByRole('button', { name: 'Notifications' }).click();
    const items = student.getByTestId('notification-item');
    await expect(items).toHaveCount(2, { timeout: 20000 });
    await expect(student.getByTestId('notification-drawer')).toContainText('New Other questions are available');
    await expect(student.getByTestId('notification-drawer')).toContainText('Assessment completed');
    await shot(student, 'student-bell');
    await student.getByTestId('read-all').click();
    await expect(items.first()).toHaveAttribute('data-read', 'true');
    await expect(items.nth(1)).toHaveAttribute('data-read', 'true');
    const after = await call(student, studentToken, 'GET', '/api/notifications');
    expect(after.body.every((n) => n.read)).toBe(true);
  });

  await step('08', 'Content editor: an invalid question is refused with clear messages; a valid one is created, then deactivated', async () => {
    await admin.goto('/admin/content');
    await admin.getByTestId('new-question').click();
    await admin.getByTestId('q-id').fill(QUESTION_ID);
    await admin.getByTestId('q-skill-field').selectOption('Python');
    await admin.getByTestId('q-topic-field').selectOption('Python Fundamentals');
    await admin.getByTestId('q-text').fill(`P9 test ${stamp}: which keyword starts a function definition in Python?`);
    await admin.getByTestId('q-option-0').fill('def');
    await admin.getByTestId('q-option-1').fill('func');
    await admin.getByTestId('q-option-2').fill('fn');
    // the fourth option and the explanation are left empty on purpose
    await admin.getByTestId('save-question').click();
    const errors = admin.getByTestId('form-errors');
    await expect(errors).toBeVisible({ timeout: 20000 });
    await expect(errors).toContainText('exactly 4');
    await expect(errors).toContainText('explanation');
    await shot(admin, 'content-editor-errors');

    await admin.getByTestId('q-option-3').fill('lambda only');
    await admin.getByTestId('q-explanation').fill('def introduces a function definition.');
    const create = admin.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/admin/content/questions') && r.request().method() === 'POST');
    await admin.getByTestId('save-question').click();
    expect((await create).status()).toBe(201);
    created.questions.push(QUESTION_ID);
    await admin.locator('#q-search').fill(QUESTION_ID);
    const row = admin.getByTestId('question-row').filter({ hasText: QUESTION_ID });
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row).toHaveAttribute('data-active', 'true');
    await expect(row).toContainText('edited by admin');
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await expect(admin.getByTestId('question-row').filter({ hasText: QUESTION_ID })).toHaveAttribute('data-active', 'false', { timeout: 20000 });
    const practice = await call(student, studentToken, 'GET', '/api/practice/questions?skill=Python');
    expect(practice.body.map((q) => q.id)).not.toContain(QUESTION_ID);
    await shot(admin, 'content-editor-deactivated');
  });

  await step('09', 'Placements: create a test placement, then close it', async () => {
    await admin.goto('/admin/companies');
    await admin.getByRole('button', { name: /Create Placement Drive/ }).click();
    await field(admin, 'Company Name').fill(COMPANY);
    await field(admin, 'Job Role Title').fill('P9 Test Engineer');
    await field(admin, 'Salary Package').fill('Test only');
    await field(admin, 'Location').fill('Nowhere');
    await field(admin, 'Application Deadline').fill('2099-01-31');
    await field(admin, 'Hiring Batch').fill('Test batch');
    await field(admin, 'Required Skills (comma separated)').fill('Python, SQL');
    await admin.getByTestId('placement-min-cgpa').fill('7.5');
    await admin.getByTestId('placement-status').selectOption('published');
    const create = admin.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/api/placements') && r.request().method() === 'POST');
    await admin.getByRole('button', { name: /Publish Placement Drive/ }).click();
    const resp = await create;
    expect(resp.status()).toBe(201);
    const job = await resp.json();
    created.placements.push(job.id);
    expect(job.status).toBe('published');
    const card = admin.locator('.card-static', { hasText: COMPANY });
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.getByRole('button', { name: 'Edit' }).click();
    await admin.getByTestId('placement-status').selectOption('closed');
    const update = admin.waitForResponse((r) => r.url().includes(`/api/placements/${job.id}`) && r.request().method() === 'PUT');
    await admin.getByRole('button', { name: /Update Placement Drive/ }).click();
    expect((await update).status()).toBe(200);
    const closed = await call(admin, adminToken, 'GET', '/api/placements?status_filter=closed');
    expect(closed.body.map((j) => j.id)).toContain(job.id);
    const seen = await call(student, studentToken, 'GET', '/api/placements');
    expect(seen.body.map((j) => j.id)).not.toContain(job.id); // closed: hidden from students
    await shot(admin, 'placement-closed');
  });

  await step('10', 'A student gets 403 on admin pages and the admin API', async () => {
    for (const url of ['/api/admin/students', '/api/admin/content/questions', '/api/admin/extracted-questions']) {
      expect((await call(student, studentToken, 'GET', url)).status, url).toBe(403);
    }
    await student.goto('/admin/content');
    await expect(student).not.toHaveURL(/\/admin\/content$/, { timeout: 20000 });
    await shot(student, 'student-blocked');
  });

  await step('11', 'No 5xx from /api and no app console errors during the whole run', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
