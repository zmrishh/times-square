// Starts authorization only. Does not sign into Google or create an app account.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://newyorkcity-kappa.vercel.app';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  await page.addInitScript(() => sessionStorage.setItem('paper-intro', '1'));
  // Verify the deployed profile UI with a delayed, explicitly mocked session.
  let releaseAccount, accountRequested;
  const gate = new Promise(resolve => { releaseAccount = resolve; });
  const started = new Promise(resolve => { accountRequested = resolve; });
  await page.route('**/api/me', async route => {
    accountRequested();
    await gate;
    await route.fulfill({ json: { account: { id: 'ui-fixture', email: 'profile@example.com', role: 'advertiser' },
      brands: [], orders: [], totals: [], placements: [], analytics: [] } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await started;
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.getByText('Loading your account…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).not.toBeAttached();
  releaseAccount();
  await expect(page.locator('.account-strip')).toContainText('profile@example.com');
  await expect(page.locator('.account-avatar')).toHaveText('P');
  await mkdir('artifacts/audit', { recursive: true });
  await page.screenshot({ path: 'artifacts/audit/profile-live-fixture.png' });
  await page.unroute('**/api/me');
  // Resume the real anonymous session before checking the actual Google redirect.
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible({ timeout: 45000 });
  await expect(page.getByLabel('Email address')).not.toBeAttached();
  await mkdir('artifacts/audit', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/audit/google-sign-in-live-mobile.png' });
  let authorize;
  await page.route(`${base}/api/auth/google`, async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    authorize = new URL((await response.json()).url);
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.waitForURL(url => url.hostname === 'accounts.google.com', { timeout: 45000 });
  expect(authorize.origin).toBe('https://mgbchdkttxrrjywqgybh.supabase.co');
  expect(authorize.searchParams.get('provider')).toBe('google');
  expect(authorize.searchParams.get('redirect_to')).toBe(`${base}/auth/callback`);
  expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).not.toContain('/oauth/error');
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/redirect_uri_mismatch|invalid_client|deleted_client|Error 400|Access blocked/i);
  expect(text).toMatch(/Sign in|Choose an account|Email or phone/i);
  await page.screenshot({ path: 'artifacts/audit/google-provider-live.png' });
  const report = { checkedAt: new Date().toISOString(), site: base, googlePageReached: true,
    providerConfigurationAccepted: true, pkce: true, actualAccountLogin: 'requires user',
    mobileGoogleButton: true, delayedProfileSession: 'passed with mocked account response' };
  await writeFile('artifacts/audit/google-sign-in-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
