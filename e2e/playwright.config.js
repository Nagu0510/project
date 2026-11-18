import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Use the installed Google Chrome; fall back to Playwright's bundled Chromium
// (install it once with: npx playwright install chromium) when Chrome is missing.
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const hasChrome = chromePaths.some((p) => fs.existsSync(p));

const backendPython = process.platform === 'win32'
  ? 'backend\\.venv\\Scripts\\python.exe'
  : 'backend/.venv/bin/python';

export default defineConfig({
  testDir: here,
  testMatch: /.*.spec.js$/,
  timeout: 15 * 60 * 1000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: path.join(here, '.results'),
  use: {
    baseURL: 'http://localhost:5173',
    headless: false, // headed, so a person can watch
    ...(hasChrome ? { channel: 'chrome' } : {}),
    viewport: { width: 1440, height: 900 },
    actionTimeout: 45_000, // a selector that matches nothing fails after 45 s instead of hanging for the whole test timeout
    navigationTimeout: 60_000,
    launchOptions: { slowMo: 120 },
  },
  // Both servers are started here, waited for, and stopped when the run ends.
  webServer: [
    {
      command: `${backendPython} -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`,
      cwd: root,
      url: 'http://127.0.0.1:8000/health', // 200 only when MongoDB is connected
      timeout: 120_000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'ignore',
    },
    {
      command: 'npm run dev',
      cwd: root,
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
