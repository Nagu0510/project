// P7: every native select option list is readable (contrast >= 4.5:1), at 1280px and 390px.
//   npx playwright test -c e2e/playwright.config.js p7-dropdowns
// For each page that has a <select>: the open list is screenshotted (a native popup may not appear in a screenshot, so a
// same-styled in-page listbox is captured too) AND every option's computed colour/background is checked by script.
// Output: e2e/screenshots/p7/  (PNG screenshots, contrast-<width>.json, contrast-report.txt). The test student is deleted.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { selectContrastAudit } from './helpers/selectContrast.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(here, 'screenshots', 'p7');
const BASE = 'http://localhost:5173';
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');

const WIDTHS = [1280, 390];
const GUEST = ['/signup', '/login'];
const STUDENT = ['/practice', '/assessment', '/resume-analyzer', '/resume-practice', '/courses', '/previous-questions', '/career-paths', '/roadmap', '/dashboard', '/profile'];
const ADMIN = ['/admin/question-papers', '/admin/companies', '/admin/students', '/admin/question-bank'];

const email = `p3-test-p7-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(12).toString('base64url')}`;
let studentState;
const report = []; // lines for contrast-report.txt
const allResults = {}; // width -> [{ role, route, ...audit }]
const failures = [];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const slug = (route) => route.replace(/^\//, '').replace(/[/?=&]+/g, '_');

async function audit(page, role, route, width, { after, label } = {}) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  if (after) { await after(); await page.waitForTimeout(500); } // open a tab or a modal first
  route = label ? `${route} [${label}]` : route;
  const r = await page.evaluate(selectContrastAudit);
  (allResults[width] ||= []).push({ role, route, selects: r.selects, options: r.options, rules: r.rules, minRatio: r.minRatio, violations: r.violations, rows: r.rows });
  report.push(`${String(width).padStart(4)}px  ${role.padEnd(7)} ${route.padEnd(22)} selects=${r.selects} options=${r.options} cssRules=${r.rules} min=${r.minRatio ?? '-'}:1  ${r.violations.length ? 'FAIL' : 'ok'}`);
  for (const v of r.violations) { report.push(`        ! ${v}`); failures.push(`${width}px ${route}: ${v}`); }
  return r;
}

// An open native list may not be captured, so also render the same options as an in-page listbox (same CSS rules apply to its options).
async function shootOpenList(page, selector, name) {
  const select = page.locator(selector).first();
  await select.scrollIntoViewIfNeeded();
  await select.click({ trial: false }).catch(() => {});
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-native-open.png`) });
  await page.keyboard.press('Escape');
  await select.evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.removeAttribute('data-testid');
    clone.setAttribute('data-p7-clone', '1');
    clone.size = Math.min(el.options.length, 7);
    clone.style.height = 'auto';
    clone.style.display = 'block';
    clone.style.marginTop = '8px';
    clone.style.width = el.offsetWidth ? `${Math.max(el.offsetWidth, 200)}px` : '240px';
    el.insertAdjacentElement('afterend', clone);
  });
  const clone = page.locator('[data-p7-clone="1"]');
  await clone.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await select.locator('xpath=ancestor::*[self::div][1]').screenshot({ path: path.join(OUT, `${name}-option-list.png`) }).catch(async () => page.screenshot({ path: path.join(OUT, `${name}-option-list.png`) }));
  await clone.evaluate((el) => el.remove());
}

test.use({ headless: false, launchOptions: { slowMo: 60 }, actionTimeout: 15000, navigationTimeout: 30000 });
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: 'P7 Test Student', email, password } });
  expect(res.status(), 'registering the test student').toBe(201);
  const state = await ctx.storageState();
  state.origins = [{ origin: BASE, localStorage: [{ name: 'skillsense_auth', value: 'true' }] }];
  studentState = state;
  await ctx.close();
});

test.afterAll(() => {
  let cleanup;
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  const header = [
    'Select / option contrast check (WCAG AA, 4.5:1 for normal text). Every option and optgroup of every <select>, plus every CSS rule that styles an option.',
    `Pages: guest ${GUEST.join(' ')} | student ${STUDENT.join(' ')} | admin (stubbed session) ${ADMIN.join(' ')}`, '',
  ];
  const totals = Object.values(allResults).flat().reduce((t, r) => ({ selects: t.selects + r.selects, options: t.options + r.options }), { selects: 0, options: 0 });
  const tail = ['', `Totals: ${totals.selects} selects, ${totals.options} options checked, ${failures.length} violation(s).`, `Cleanup: ${cleanup}`];
  fs.writeFileSync(path.join(OUT, 'contrast-report.txt'), [...header, ...report, ...tail].join('\n'));
  for (const [w, rows] of Object.entries(allResults)) fs.writeFileSync(path.join(OUT, `contrast-${w}.json`), JSON.stringify(rows, null, 1));
  console.log([...header.slice(0, 1), ...report, ...tail].join('\n'));
});

test('every dropdown option list is readable', async ({ browser }) => {
  for (const width of WIDTHS) {
    const viewport = { width, height: width <= 480 ? 844 : 900 };

    const guest = await browser.newContext({ viewport });
    const gp = await guest.newPage();
    for (const route of GUEST) await audit(gp, 'guest', route, width);
    await gp.goto(`${BASE}/signup`);
    await shootOpenList(gp, 'form select', `${width}-signup-career-interest`);
    await guest.close();

    const student = await browser.newContext({ viewport, storageState: studentState });
    const sp = await student.newPage();
    for (const route of STUDENT) await audit(sp, 'student', route, width);
    // dropdowns that only exist after an action
    const openEdit = () => sp.getByRole('button', { name: /Edit Profile/ }).click();
    const r1 = await audit(sp, 'student', '/profile', width, { after: openEdit, label: 'edit profile dialog' });
    expect(r1.selects, 'the edit-profile dialog has a select').toBeGreaterThan(0);

    // The reported bug: the dark editor panel's language list
    await sp.goto(`${BASE}/practice`);
    const language = sp.getByTestId('language-select');
    await expect(language).toBeVisible({ timeout: 30000 });
    const labels = await language.locator('option').allTextContents();
    expect(labels).toEqual(['Python 3', 'Java (class Main)', 'C (GCC)', 'C++ (G++)', 'JavaScript (Node.js)']);
    const probe = await language.evaluate((el) => [...el.options].map((o) => ({ text: o.text, color: getComputedStyle(o).color, background: getComputedStyle(o).backgroundColor })));
    for (const o of probe) expect(o.color, `${o.text} text vs background`).not.toBe(o.background);
    await shootOpenList(sp, '[data-testid="language-select"]', `${width}-practice-language`);

    if (width === WIDTHS[0]) {
      // BEFORE evidence: what the same control looked like without explicit option colours (inherited light text on the popup's white)
      await sp.addStyleTag({ content: 'select option, select optgroup { background-color: transparent !important; color: inherit !important; }' });
      const before = await sp.evaluate(selectContrastAudit);
      const mine = before.rows.filter((r) => r.where.startsWith('language-select') && r.where.includes('option'));
      fs.writeFileSync(path.join(OUT, 'before-fix-practice-language.txt'), [
        'Without explicit option colours (the behaviour before this fix), the practice language options were:',
        ...mine.map((r) => `  ${r.name.padEnd(22)} ${r.color} on ${r.background}  ${r.ratio}:1  ${r.ratio < 4.5 ? 'UNREADABLE' : 'ok'}`),
        `violations: ${before.violations.filter((v) => v.startsWith('language-select')).length}`,
      ].join('\n'));
      expect(before.violations.some((v) => v.startsWith('language-select'))).toBe(true); // the audit really detects the original bug
    }
    await student.close();

    const admin = await browser.newContext({ viewport });
    const ap = await admin.newPage();
    await admin.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
    const adminUser = { id: 'usr-admin-stub', name: 'P7 Admin', email: 'p7-admin@example.com', role: 'admin', email_verified: true, has_password: true, auth_provider: 'password' };
    await admin.route('**/api/auth/refresh', (r) => r.fulfill({ json: { access_token: 'stub', token_type: 'bearer', user: adminUser } }));
    await admin.route('**/api/auth/me', (r) => r.fulfill({ json: adminUser }));
    await admin.route(/\/api\/(?!auth\/)/, (r) => r.fulfill({ status: 200, json: [] }));
    for (const route of ADMIN) await audit(ap, 'admin', route, width);
    const r2 = await audit(ap, 'admin', '/admin/question-papers', width, { after: () => ap.getByRole('button', { name: /Upload/ }).first().click(), label: 'upload tab' });
    expect(r2.selects, 'the upload tab has selects').toBeGreaterThan(0);
    await ap.screenshot({ path: path.join(OUT, `${width}-admin-upload-tab.png`) });

    // date and file inputs: the text and the file button are readable too
    await ap.goto(`${BASE}/admin/companies`);
    await ap.waitForTimeout(1500);
    await ap.getByRole('button', { name: /Create Placement Drive/ }).click();
    await ap.waitForTimeout(600);
    const dateInputs = await ap.evaluate(selectContrastAudit);
    const native = await ap.evaluate(() => {
      const luminance = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)); };
      const out = [];
      for (const el of document.querySelectorAll('input[type="date"]')) {
        const cs = getComputedStyle(el);
        out.push({ type: 'date', color: cs.color, background: cs.backgroundColor, ratio: ratio(cs.color, cs.backgroundColor), colorScheme: cs.colorScheme });
      }
      const file = document.createElement('input');
      file.type = 'file';
      document.body.appendChild(file);
      const btn = getComputedStyle(file, '::file-selector-button');
      out.push({ type: 'file button', color: btn.color, background: btn.backgroundColor, ratio: ratio(btn.color, btn.backgroundColor) });
      file.remove();
      return out;
    });
    await ap.screenshot({ path: path.join(OUT, `${width}-admin-date-input.png`) });
    report.push(`${String(width).padStart(4)}px  admin   native inputs: ${native.map((n) => `${n.type} ${n.color} on ${n.background} = ${n.ratio}:1 (scheme ${n.colorScheme || 'n/a'})`).join(' | ')}`);
    for (const n of native) if (n.ratio < 4.5) failures.push(`${width}px native ${n.type}: ${n.ratio}:1`);
    expect(native.some((n) => n.type === 'date'), 'a date input is on the page').toBe(true);
    void dateInputs;
    await admin.close();
  }
  expect(failures, failures.join('\n')).toEqual([]);
});
