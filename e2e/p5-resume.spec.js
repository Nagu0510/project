// P5: the resume analyzer in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p5-resume
// New test student -> empty state -> upload a text PDF, a JPG (OCR) and a DOCX (drag and drop) -> score page ->
// job-description match -> edit the extracted text and re-score -> history. Screenshots: e2e/screenshots/p5/.
// The test student (and their analyses) is deleted at the end. Passwords are generated here and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p5');
const FIXTURES = path.join(root, 'backend', 'tests', 'fixtures');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const email = `p3-test-p5-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;
const JD = 'We are hiring an engineer with Python, FastAPI, Kubernetes, Terraform and PostgreSQL. Docker is a plus.';

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
const score = async () => Number(await page.getByTestId('ats-score').getAttribute('data-score'));

async function setSecret(locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function waitForNewReport(previousHeadline) {
  await expect(page.getByTestId('progress')).toBeHidden({ timeout: 120000 });
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 10000 });
  if (previousHeadline !== undefined) await expect(page.getByTestId('headline')).toBeVisible();
}

// A real drag and drop: build a File in the page from the fixture's bytes and fire a drop event on the dropzone.
async function dropFile(name, mime) {
  const base64 = fs.readFileSync(path.join(FIXTURES, name)).toString('base64');
  await page.getByTestId('dropzone').evaluate((zone, { name, mime, base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type: mime }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { name, mime, base64 });
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

test('the resume analyzer works end to end', async () => {
  await step('01', 'Register a new test student', async () => {
    await page.goto('/signup');
    await page.locator('input[type="text"]').first().fill('P5 Test Student');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await setSecret(pw.nth(0), password);
    await setSecret(pw.nth(1), password);
    await page.getByRole('button', { name: /Create Free Account/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  });

  await step('02', 'Before any upload: empty state, no sample report, honest labels', async () => {
    await page.goto('/resume-analyzer');
    await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('report')).toHaveCount(0);
    const body = await page.locator('main').innerText();
    for (const fake of ['87%', '84', 'TCS (Tata', 'Verified Strengths', 'ATS Verified']) expect(body, `no sample text "${fake}"`).not.toContain(fake);
    await expect(page.getByText('ATS-style score (estimate)').first()).toBeVisible();
    await shot('01-empty-state');
  });

  await step('03', 'Target role is pre-filled from the student career interest and listed from the API', async () => {
    await expect(page.getByTestId('resume-role')).toHaveValue('Backend Developer');
    const options = await page.getByTestId('resume-role').locator('option').allTextContents();
    expect(options.length).toBe(10); // "Choose a role..." + the 9 career paths
    return `${options.length - 1} roles`;
  });

  await step('04', 'An unsupported file type is refused with a clear message', async () => {
    await page.getByTestId('resume-file-input').setInputFiles({ name: 'resume.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') });
    await expect(page.getByTestId('resume-error')).toContainText('not supported');
  });

  let textPdfScore = 0;
  await step('05', 'Text PDF: score page with breakdown, ranked fixes and skill evidence', async () => {
    await page.getByTestId('resume-role').selectOption({ label: 'Backend Developer' });
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
    await waitForNewReport();
    textPdfScore = await score();
    expect(textPdfScore).toBeGreaterThan(40);
    await expect(page.getByText('ATS-style score (estimate)').first()).toBeVisible();
    for (const key of ['keywords', 'evidence', 'contact', 'sections', 'impact', 'bullets', 'readability', 'formatting', 'education']) await expect(page.getByTestId(`category-${key}`)).toBeVisible();
    const fixes = await page.getByTestId('fix').count();
    expect(fixes).toBeGreaterThanOrEqual(1);
    expect(fixes).toBeLessThanOrEqual(8);
    const chips = await page.getByTestId('skill-chip').evaluateAll((els) => els.map((e) => e.getAttribute('data-evidence')));
    expect(chips.length).toBeGreaterThan(5);
    expect(chips).toContain('demonstrated');
    await expect(page.getByTestId('ocr-notice')).toHaveCount(0); // a text PDF needs no OCR
    await shot('02-text-pdf-score');
    return `score ${textPdfScore}, ${fixes} fixes, ${chips.length} skills`;
  });

  await step('06', 'JPG photo: image preview, OCR confidence and the review warning', async () => {
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_photo.jpg'));
    await expect(page.getByTestId('file-preview').getByRole('img')).toBeVisible({ timeout: 10000 });
    await waitForNewReport();
    const notice = page.getByTestId('ocr-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('OCR confidence');
    await expect(notice).toContainText('OCR text can contain mistakes, please review');
    const text = await page.getByTestId('resume-text').inputValue().catch(() => '');
    expect(await page.getByTestId('text-editor').innerText()).toContain('Edit extracted text and re-score');
    expect(text.toLowerCase()).toContain('python');
    await shot('03-jpg-ocr');
    return (await notice.innerText()).split('\n')[0] + `; score ${await score()}`;
  });

  await step('07', 'DOCX by drag and drop; comparison with the previous analysis', async () => {
    await dropFile('resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await waitForNewReport();
    await expect(page.getByTestId('comparison')).toContainText('previous analysis');
    expect(await score()).toBeGreaterThan(40);
    await shot('04-docx-dropped');
  });

  await step('08', 'Job description: matched and missing keywords with a match percentage', async () => {
    await page.getByRole('button', { name: /Match a job description/ }).click();
    await page.getByTestId('resume-jd').fill(JD);
    await page.getByTestId('resume-file-input').setInputFiles(path.join(FIXTURES, 'resume_text.pdf'));
    await waitForNewReport();
    const jd = page.getByTestId('jd-match');
    await expect(jd).toBeVisible();
    await expect(jd).toContainText('Job description match: 67%');
    await expect(jd).toContainText('Kubernetes');
    await expect(jd).toContainText('Terraform');
    await shot('05-job-description');
  });

  await step('09', 'Edit the extracted text and re-score without uploading again', async () => {
    await page.getByRole('button', { name: /Edit extracted text and re-score/ }).click();
    const box = page.getByTestId('resume-text');
    await expect(box).toBeVisible();
    const before = await score();
    const original = await box.inputValue();
    expect(original).toContain('Languages: Python, Java, C, SQL');
    await box.fill(original.replace('Languages: Python, Java, C, SQL', 'Languages: Python, Java, C, SQL, Kubernetes, Terraform'));
    await page.getByTestId('rescore').click();
    await expect(page.getByTestId('progress')).toBeHidden({ timeout: 60000 });
    const jd = page.getByTestId('jd-match');
    await expect(jd).toContainText('Job description match: 100%', { timeout: 15000 });
    expect(await score()).toBeGreaterThanOrEqual(before);
    await shot('06-edited-and-rescored');
    return `JD match 67% -> 100%, score ${before} -> ${await score()}`;
  });

  await step('10', 'History chart lists the analyses', async () => {
    const label = await page.getByTestId('history').getByRole('img').getAttribute('aria-label');
    const values = label.split(': ')[1].split(', ');
    expect(values.length).toBeGreaterThanOrEqual(5);
    await shot('07-history');
    return label;
  });

  await step('11', 'No 5xx from /api and no app console errors', async () => {
    expect(serverErrors, serverErrors.join(', ')).toEqual([]);
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([]);
  });

  expect(results.filter((r) => r.status === 'FAIL'), 'failed steps').toEqual([]);
});
