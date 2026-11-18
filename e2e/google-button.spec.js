// Google sign-in button on Login and Register: present, below the form with an "or" divider, and what Google answers on click.
//   npx playwright test -c e2e/playwright.config.js google-button
// Never logs in to Google and never prints the client ID. If Google refuses the client, the exact error is reported
// and the page must show a visible "Continue with Google" fallback, not a blank gap.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(here, 'screenshots', 'google');
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const redact = (t) => t.replace(/\d{6,}-[\w-]+\.apps\.googleusercontent\.com/g, '<client-id>');

for (const route of ['/login', '/signup']) {
  test(`Google button on ${route}`, async ({ page, context }) => {
    const gsi = [];
    page.on('console', (m) => { if (/GSI_LOGGER|origin/i.test(m.text())) gsi.push(redact(m.text())); });
    const googleHttp = [];
    page.on('response', (r) => { if (r.url().includes('accounts.google.com/gsi') && r.status() >= 400) googleHttp.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

    await page.goto(route);
    const name = route.slice(1);
    const realFrame = page.locator('iframe[src*="accounts.google.com/gsi/button"]');
    const fallback = page.getByTestId('google-unavailable');
    // either Google's own button (iframe with a real size) or our visible fallback; never a blank gap
    await expect.poll(async () => {
      const box = await realFrame.first().boundingBox().catch(() => null);
      return (box && box.width > 0) || (await fallback.count()) > 0;
    }, { message: 'a Google button of some kind must be visible', timeout: 25000 }).toBe(true);

    const form = await page.locator('form').boundingBox();
    const usingGoogleButton = (await fallback.count()) === 0;
    const target = usingGoogleButton ? await realFrame.first().boundingBox() : await fallback.boundingBox();
    expect(target.y, 'button sits below the form').toBeGreaterThan(form.y + form.height);
    await expect(page.getByText('or', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, `${name}-button.png`) });
    console.log(`  ${route}: ${usingGoogleButton ? 'official Google button visible' : 'Google refused to draw its button; visible fallback shown'}`);

    if (usingGoogleButton) {
      const popupPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
      await realFrame.contentFrame().locator('div[role="button"]').first().click();
      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        await popup.waitForTimeout(2500);
        const text = (await popup.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
        console.log(`  ${route}: popup ${new URL(popup.url()).origin} :: ${redact(text)}`);
        await popup.screenshot({ path: path.join(SHOTS, `${name}-google-popup.png`) }).catch(() => {});
        await popup.close().catch(() => {});
      } else {
        console.log(`  ${route}: click opened no popup`);
      }
    } else {
      await fallback.getByRole('button').click();
      await expect(page.getByRole('alert').filter({ hasText: /isn't available/i })).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `${name}-fallback-explained.png`) });
      console.log(`  ${route}: Google said -> ${gsi.join(' | ') || '(no console message)'} ${googleHttp.join(' ')}`);
    }
  });
}
