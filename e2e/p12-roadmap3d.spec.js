// P12: the 3D pathway ribbon on the Roadmap page, in a real (headed) Chrome against the real app and real Atlas.
//   npx playwright test -c e2e/playwright.config.js p12-roadmap3d
// New test student -> the canvas renders (non-blank) -> every track in the dropdown redraws with ITS milestones (count and titles
// compared with the API) -> clicking a node highlights its card -> five trips Landing / Resume / Dashboard / Roadmap leave no stray
// WebGL context and no "Context Lost" -> context loss is restored, or a Reload button appears -> a browser with WebGL disabled gets the
// 2D timeline with no console error -> reduced motion -> scrolling is not hijacked -> 390px. Screenshots: e2e/screenshots/p12/.
// The test student is deleted at the end. Passwords are generated here and never printed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SHOTS = path.join(here, 'screenshots', 'p12');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const PY = process.platform === 'win32' ? path.join(root, 'backend', '.venv', 'Scripts', 'python.exe') : path.join(root, 'backend', '.venv', 'bin', 'python');
const BASE = 'http://localhost:5173';
const email = `p3-test-p12-${Date.now()}@example.com`;
const password = `Aa1-${crypto.randomBytes(9).toString('base64url')}`;

const TRACKS = ['Backend Developer', 'Frontend Developer', 'Full Stack Developer', 'Python Developer', 'Java Developer', 'Data Analyst', 'Data Scientist', 'AI / Machine Learning Engineer', 'Cloud / DevOps Engineer'];
const slugOf = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const results = [];
const consoleLog = [];
let browser;
let context;
let page;
const roadmaps = {}; // track -> milestones from the API

async function step(id, title, fn) {
  const entry = { id, title, status: 'PASS', note: '' };
  try {
    entry.note = (await fn()) || '';
  } catch (err) {
    entry.status = 'FAIL';
    entry.note = String(err.message).split('\n')[0].slice(0, 260);
    try { await page.screenshot({ path: path.join(SHOTS, `${id}-FAILED.png`) }); } catch { /* page may be gone */ }
  }
  results.push(entry);
  console.log(`  [${entry.status}] ${id}: ${title}${entry.note ? ` - ${entry.note}` : ''}`);
}

const panel = (p = page) => p.getByTestId('roadmap-3d');
const stage = (p = page) => p.getByTestId('roadmap-3d-stage');
const NOISE = /google|gsi|accounts\.google|Failed to load resource|React Router Future Flag/i;

function watch(p, bucket) {
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !NOISE.test(m.text())) bucket.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
  p.on('pageerror', (e) => bucket.push(`pageerror: ${e.message.slice(0, 160)}`));
}

// counts WebGL contexts and context-lost events that happen while the canvas is still on the page (a disposed canvas is already removed)
const COUNT_CONTEXTS = () => {
  window.__gl = { created: 0, canvases: [], unexpectedLost: 0, lost: 0 };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
    const gl = original.call(this, type, ...rest);
    if (gl && /webgl/.test(type) && !this.__counted) {
      this.__counted = true;
      window.__gl.created += 1;
      window.__gl.canvases.push(this);
      this.addEventListener('webglcontextlost', () => { window.__gl.lost += 1; if (this.isConnected) window.__gl.unexpectedLost += 1; });
    }
    return gl;
  };
};

async function register(ctx) {
  const reg = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: 'P12 Test Student', email, password } });
  expect(reg.status(), 'registering the test student').toBe(201);
  await ctx.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
}

async function openRoadmap(p, track, attempt = 1) {
  const waiting = p.waitForResponse((r) => r.url().includes('/student/roadmap') && r.request().method() === 'GET', { timeout: 30000 });
  await p.goto(`${BASE}/roadmap?track=${encodeURIComponent(track)}`);
  const response = await waiting;
  try {
    roadmaps[track] = (await response.json()).milestones || [];
  } catch (err) {
    // Chrome sometimes drops a response body before Playwright reads it ("No resource with given identifier"): load the page once more
    if (attempt >= 3 || !/No resource with given identifier|Protocol error/.test(String(err.message))) throw err;
    return openRoadmap(p, track, attempt + 1);
  }
  await expect(p.locator('[data-testid="milestone-card"]:visible').first()).toBeVisible({ timeout: 30000 }); // the desktop or the phone copy of the card
  return roadmaps[track];
}

async function waitReady(p = page) {
  await panel(p).scrollIntoViewIfNeeded();
  await expect(panel(p)).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(stage(p)).toHaveAttribute('data-rendered', 'true');
}

const titlesOf = async (p = page) => (await stage(p).getAttribute('data-titles')).split('|');
const bySortedNumber = (list) => [...list].sort((a, b) => a.number - b.number).map((m) => m.title);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(COUNT_CONTEXTS);
  await register(context);
  page = await context.newPage();
  watch(page, consoleLog);
});

test.afterAll(async () => {
  let cleanup = '';
  try {
    cleanup = execFileSync(PY, [path.join(here, 'helpers', 'cleanup_test_user.py'), email], { cwd: root }).toString().trim();
  } catch (err) {
    cleanup = `cleanup FAILED: ${String(err.message).split('\n')[0]}`;
  }
  console.log(`\n  Cleanup: ${cleanup}`);
  console.log(`  Console warnings/errors seen: ${consoleLog.length ? [...new Set(consoleLog)].join(' | ') : 'none'}`);
  console.log('\n  Step results');
  for (const r of results) console.log(`    ${r.status}  ${r.id}  ${r.title}${r.note ? `  (${r.note})` : ''}`);
});

test('the 3D pathway ribbon works end to end', async () => {
  await step('01', 'The canvas exists, WebGL drew something, labels match the API', async () => {
    const milestones = await openRoadmap(page, 'Backend Developer');
    await waitReady();
    await expect(stage().locator('canvas')).toHaveCount(1);
    await expect(stage()).toHaveAttribute('data-nonblank', 'true');
    expect(Number(await stage().getAttribute('data-frames'))).toBeGreaterThan(3);
    expect(await titlesOf()).toEqual(bySortedNumber(milestones));
    await expect(stage().getByTestId('roadmap-3d-label')).toHaveCount(milestones.length);
    const visible = await stage().locator('.rm3d-label[data-hidden="false"]').count();
    expect(visible, 'at least most labels are on screen').toBeGreaterThanOrEqual(Math.ceil(milestones.length * 0.8));
    // no label is cut off by the panel
    const box = await stage().boundingBox();
    for (const label of await stage().locator('.rm3d-label[data-hidden="false"]').all()) {
      const b = await label.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(b.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    return `${milestones.length} milestones, ${visible} labels shown`;
  });

  await step('02', 'Every track in the dropdown redraws the ribbon with its own milestones (count and titles = API)', async () => {
    const seen = [];
    for (const track of TRACKS) {
      let milestones = roadmaps[track]; // the track that is already open was loaded in step 01
      if ((await page.locator('select').first().inputValue()) !== track) {
        const waiting = page.waitForResponse((r) => r.url().includes('/student/roadmap') && r.url().includes('career_path=') && r.request().method() === 'GET');
        await page.locator('select').first().selectOption(track);
        milestones = (await (await waiting).json()).milestones;
        roadmaps[track] = milestones;
      }
      await expect(stage()).toHaveAttribute('data-career-path', track, { timeout: 15000 });
      await expect(stage()).toHaveAttribute('data-milestones', String(milestones.length));
      expect(await titlesOf(), track).toEqual(bySortedNumber(milestones));
      await expect(stage().getByTestId('roadmap-3d-label')).toHaveCount(milestones.length);
      await expect(page.getByTestId('milestone-card')).toHaveCount(milestones.length * 2); // each card exists once for desktop and once for mobile
      const shown = await stage().locator('.rm3d-label[data-hidden="false"]').count();
      expect(shown).toBeGreaterThan(0);
      await expect(stage()).toHaveAttribute('data-nonblank', 'true');
      await panel().screenshot({ path: path.join(SHOTS, `desktop-${slugOf(track)}.png`) });
      seen.push((await titlesOf()).join('|'));
    }
    expect(new Set(seen).size, 'each track has its own milestone titles').toBe(TRACKS.length);
    await expect(panel()).toHaveAttribute('data-generation', '0'); // one renderer for all nine tracks
    return `${TRACKS.length} tracks, counts ${TRACKS.map((t) => roadmaps[t].length).join('/')}`;
  });

  await step('03', 'Clicking a label or a node highlights its card and shows status, skills, course and practice set', async () => {
    await page.locator('select').first().selectOption('Backend Developer');
    await expect(stage()).toHaveAttribute('data-career-path', 'Backend Developer');
    await waitReady();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const label = stage().locator('.rm3d-label[data-hidden="false"]').nth(2);
    const id = await label.getAttribute('data-id');
    await label.click();
    await expect(page.locator(`[data-milestone-id="${id}"][data-highlighted="true"]`).first()).toBeAttached();
    await expect(page.getByTestId('roadmap-3d-detail')).toHaveAttribute('data-id', id);
    await expect(page.getByTestId('roadmap-3d-detail')).toContainText('Skills:');
    await expect(page.getByTestId('roadmap-3d-detail')).toContainText(/Course:|No course or practice set/);
    await expect(stage()).toHaveAttribute('data-selected', id);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-click-label.png') });
    // click the 3D node itself (picked with a raycast), a different milestone
    await panel().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200); // the page scrolled smoothly to the card: let it settle
    await panel().scrollIntoViewIfNeeded();
    const other = stage().locator('.rm3d-label[data-hidden="false"]').nth(5);
    const otherId = await other.getAttribute('data-id');
    const [nx, ny] = [Number(await other.getAttribute('data-nx')), Number(await other.getAttribute('data-ny'))];
    const box = await stage().boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.click(box.x + nx, box.y + ny);
    await expect(page.getByTestId('roadmap-3d-detail')).toHaveAttribute('data-id', otherId);
    const states = await stage().locator('.rm3d-label').evaluateAll((els) => els.map((e) => e.dataset.state));
    expect(new Set(states).size, 'more than one node colour in use').toBeGreaterThan(1);
    return `selected ${id} then ${otherId} (raycast)`;
  });

  await step('04', 'Scrolling is not hijacked; Ctrl+wheel and the buttons zoom; Reset view works; the labels stay readable', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel().scrollIntoViewIfNeeded();
    const box = await stage().boundingBox();
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY), 'a plain wheel scrolls the page').toBeGreaterThan(before);
    await panel().scrollIntoViewIfNeeded();
    await expect(stage()).toHaveAttribute('data-zoom', '1.00');
    await page.getByTestId('roadmap-3d-zoom-in').click();
    await expect(stage()).toHaveAttribute('data-zoom', '1.25');
    await page.getByTestId('roadmap-3d-zoom-out').click();
    await page.getByTestId('roadmap-3d-zoom-out').click();
    await expect(stage()).toHaveAttribute('data-zoom', '0.80');
    await page.getByTestId('roadmap-3d-reset').click();
    await expect(stage()).toHaveAttribute('data-zoom', '1.00');
    await panel().scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const b2 = await stage().boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect.poll(async () => Number(await stage().getAttribute('data-zoom'))).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await page.getByTestId('roadmap-3d-reset').click();
    // drag to orbit changes the picture
    await page.mouse.move(b2.x + 40, b2.y + b2.height - 40);
    await page.mouse.down();
    await page.mouse.move(b2.x + 200, b2.y + b2.height - 60, { steps: 8 });
    await page.mouse.up();
    // contrast of every label chip text against its chip colour
    const lows = await stage().locator('.rm3d-label').evaluateAll((els) => {
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const rgb = (css) => css.match(/\d+/g).slice(0, 3).map(Number);
      return els.map((el) => { const cs = getComputedStyle(el); const a = lum(rgb(cs.color)); const b = lum(rgb(cs.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }).filter((r) => r < 4.5);
    });
    expect(lows).toEqual([]);
  });

  await step('05', 'Five trips Landing / Resume / Dashboard / Roadmap: no "Context Lost", no stray WebGL contexts', async () => {
    const spa = async (route) => {
      await page.evaluate((r) => { window.history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate')); }, route);
      await page.waitForTimeout(1300);
    };
    const live = () => page.evaluate(() => ({ live: window.__gl.canvases.filter((c) => c.isConnected).length, created: window.__gl.created, unexpectedLost: window.__gl.unexpectedLost, dom: document.querySelectorAll('canvas').length }));
    const rounds = [];
    for (let i = 1; i <= 5; i += 1) {
      for (const route of ['/', '/resume-analyzer', '/dashboard', '/roadmap?track=Backend%20Developer']) await spa(route);
      await waitReady();
      const s = await live();
      rounds.push(s);
      expect(s.live, `round ${i}`).toBeLessThanOrEqual(1);
      expect(s.dom, `round ${i}`).toBe(1);
      expect(s.unexpectedLost, `round ${i}`).toBe(0);
    }
    expect(consoleLog.filter((l) => /context lost|THREE\./i.test(l))).toEqual([]);
    return `contexts created ${rounds[0].created} to ${rounds[4].created}, alive ${rounds.map((r) => r.live).join('/')}`;
  });

  await step('06', 'Landing page: the 3D core renders, with all skill badges, and leaves nothing behind', async () => {
    await page.goto(`${BASE}/`);
    const core = page.getByTestId('core-3d');
    await core.scrollIntoViewIfNeeded();
    await expect(core).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await expect(page.locator('.core-badge')).toHaveCount(9);
    await expect(page.getByTestId('core-3d-stage')).toHaveAttribute('data-rendered', 'true');
    await page.screenshot({ path: path.join(SHOTS, 'landing-core.png') });
    expect(consoleLog.filter((l) => /context lost|THREE\./i.test(l))).toEqual([]);
  });

  await step('07', 'Context lost: "Restoring 3D view..." then the ribbon comes back; if it does not, "Reload 3D view" appears', async () => {
    await openRoadmap(page, 'Data Analyst');
    await waitReady();
    const framesBefore = Number(await stage().getAttribute('data-frames'));
    await page.evaluate(() => { const c = window.__gl.canvases.find((x) => x.isConnected); window.__lose = c.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await expect(panel()).toHaveAttribute('data-state', 'restoring');
    await expect(page.getByTestId('three-lost')).toContainText('Restoring 3D view...');
    await page.evaluate(() => window.__lose.restoreContext());
    await expect(panel()).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
    await expect.poll(async () => Number(await stage().getAttribute('data-frames'))).toBeGreaterThan(framesBefore);
    await expect(stage().getByTestId('roadmap-3d-label')).toHaveCount(roadmaps['Data Analyst'].length);
    // lost for good: the Reload button shows up after 3 seconds
    await page.evaluate(() => { const c = window.__gl.canvases.find((x) => x.isConnected); c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(); });
    await expect(panel()).toHaveAttribute('data-state', 'restoring');
    await expect(page.getByTestId('three-reload')).toBeHidden();
    await expect(page.getByTestId('three-reload')).toBeVisible({ timeout: 6000 });
    await expect(panel()).toHaveAttribute('data-state', 'lost');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-context-lost.png') });
    await page.getByTestId('three-reload').click();
    await expect(panel()).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
    await expect(panel()).toHaveAttribute('data-generation', '1');
    await expect(stage()).toHaveAttribute('data-nonblank', 'true');
    expect(await page.evaluate(() => window.__gl.canvases.filter((c) => c.isConnected).length)).toBe(1);
  });

  await step('08', 'Hidden tab and off-screen panel pause the render loop', async () => {
    await panel().scrollIntoViewIfNeeded();
    await expect.poll(async () => Number(await stage().getAttribute('data-frames'))).toBeGreaterThan(0);
    const running1 = Number(await stage().getAttribute('data-frames'));
    await page.waitForTimeout(700);
    expect(Number(await stage().getAttribute('data-frames'))).toBeGreaterThan(running1);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    const parked = Number(await stage().getAttribute('data-frames'));
    await page.waitForTimeout(900);
    expect(Number(await stage().getAttribute('data-frames')), 'nothing is drawn while the panel is off screen').toBeLessThanOrEqual(parked + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await step('09', 'Milestone count and labels per track at 1280px were already compared; reduced motion keeps a static camera', async () => {
    const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await register2(reduced);
    const p = await reduced.newPage();
    const bucket = [];
    watch(p, bucket);
    await openRoadmap(p, 'Backend Developer');
    await waitReady(p);
    const f1 = Number(await stage(p).getAttribute('data-frames'));
    await p.waitForTimeout(1500);
    const f2 = Number(await stage(p).getAttribute('data-frames'));
    expect(f2 - f1, 'nothing animates, so nothing is redrawn').toBeLessThanOrEqual(2);
    await expect(stage(p).getByTestId('roadmap-3d-label').first()).toBeVisible();
    await p.screenshot({ path: path.join(SHOTS, 'desktop-reduced-motion.png') });
    expect(bucket).toEqual([]);
    await reduced.close();
  });

  await step('10', 'No WebGL (browser started with 3D disabled): a clean 2D timeline, same milestones, no console error', async () => {
    const noGl = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-3d-apis', '--disable-gpu', '--disable-webgl'] }).catch(() => chromium.launch({ headless: false, args: ['--disable-3d-apis', '--disable-gpu'] }));
    try {
      const ctx = await noGl.newContext({ viewport: { width: 1280, height: 900 } });
      await register2(ctx);
      const p = await ctx.newPage();
      const bucket = [];
      watch(p, bucket);
      const supported = await (async () => { await p.goto(`${BASE}/login`); return p.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'))); })();
      expect(supported, 'WebGL really is off in this browser').toBe(false);
      for (const track of ['Backend Developer', 'Full Stack Developer', 'Cloud / DevOps Engineer']) {
        const milestones = await openRoadmap(p, track);
        await panel(p).scrollIntoViewIfNeeded();
        await expect(panel(p)).toHaveAttribute('data-state', 'fallback');
        await expect(p.getByTestId('roadmap-2d')).toBeVisible();
        await expect(p.getByTestId('roadmap-2d-item')).toHaveCount(milestones.length);
        expect(await p.getByTestId('roadmap-2d-item').locator('button').evaluateAll((els) => els.map((e) => e.dataset.title))).toEqual(bySortedNumber(milestones));
        await expect(p.locator('canvas')).toHaveCount(0);
        await panel(p).screenshot({ path: path.join(SHOTS, `fallback-${slugOf(track)}.png`) });
      }
      const item = p.getByTestId('roadmap-2d-item').nth(1).locator('button');
      await item.click();
      await expect(p.locator('[data-highlighted="true"]').first()).toBeAttached();
      await expect(p.getByTestId('roadmap-3d-detail')).toBeVisible();
      // landing page too
      await p.goto(`${BASE}/`);
      await expect(p.getByTestId('core-2d')).toBeVisible({ timeout: 15000 });
      expect(bucket, 'no console error or warning').toEqual([]);
      await ctx.close();
    } finally {
      await noGl.close();
    }
  });

  await step('11', 'Phone (390px): vertical ribbon, big touch targets, no sideways scroll; every track at 390px', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const track of TRACKS) {
      const milestones = await openRoadmap(page, track);
      await waitReady();
      await expect(stage()).toHaveAttribute('data-orientation', 'vertical');
      await expect(stage()).toHaveAttribute('data-milestones', String(milestones.length));
      expect(await titlesOf()).toEqual(bySortedNumber(milestones));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${track}: no horizontal scroll`).toBe(true);
      const tooSmall = await stage().locator('.rm3d-controls button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width < 44 || e.getBoundingClientRect().height < 44).length);
      expect(tooSmall).toBe(0);
      const height = (await panel().boundingBox()).height;
      expect(height).toBeGreaterThan(450);
      await panel().screenshot({ path: path.join(SHOTS, `mobile-${slugOf(track)}.png`) });
    }
    // a label tap works on a touch-sized label
    const label = stage().locator('.rm3d-label[data-hidden="false"]').nth(1);
    const lb = await label.boundingBox();
    expect(lb.height).toBeGreaterThanOrEqual(30);
    await label.click();
    await expect(page.getByTestId('roadmap-3d-detail')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'mobile-click-label.png') });
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  const failed = results.filter((r) => r.status === 'FAIL');
  expect(failed.map((r) => `${r.id} ${r.title}: ${r.note}`)).toEqual([]);
  expect(consoleLog, 'no console warning or error on the roadmap, landing, resume and dashboard pages').toEqual([]);
});

// a second browser context for the same student (the cookie of the first one is not reused: this logs in again)
async function register2(ctx) {
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(login.status(), 'signing the test student in').toBe(200);
  await ctx.addInitScript(() => localStorage.setItem('skillsense_auth', 'true'));
}
