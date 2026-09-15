// Isolated provider fixture: no real Google account, email, payment, or hosted data.
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:3003', codes = new Map();
let cancel = false;
const provider = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/auth/v1/authorize') {
    if (url.searchParams.get('provider') !== 'google') return json(400, {});
    const callback = url.searchParams.get('redirect_to');
    if (callback !== `${base}/auth/callback`) return json(400, {});
    const code = randomUUID();
    codes.set(code, url.searchParams.get('code_challenge'));
    res.writeHead(303, { Location: `${callback}?${cancel ? 'error=access_denied' : `code=${code}`}` }); return res.end();
  }
  if (url.pathname === '/auth/v1/token') {
    let input = ''; for await (const chunk of req) input += chunk;
    const body = JSON.parse(input), challenge = codes.get(body.auth_code);
    codes.delete(body.auth_code);
    if (!challenge || createHash('sha256').update(body.code_verifier).digest('base64url') !== challenge)
      return json(400, { msg: 'Invalid verifier' });
    return json(200, { access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: randomUUID(), email: 'owner@example.com', email_confirmed_at: new Date().toISOString(), identities: [{ provider: 'google' }] } });
  }
  json(404, {});
});
await new Promise(resolve => provider.listen(3403, '127.0.0.1', resolve));
const env = { ...process.env, DATABASE_URL: '', PAYMENT_MODE: 'dodo-test', AUTH_MODE: 'supabase', APP_ORIGIN: base,
  PAPER_DATA_DIR: ':memory:', SUPABASE_URL: 'http://127.0.0.1:3403', SUPABASE_SERVICE_ROLE_KEY: 'fixture-key' };
delete env.PAPER_TEST_ORIGIN;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '-p', '3003'],
  { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser;
app.stdout.on('data', b => { logs += b; }); app.stderr.on('data', b => { logs += b; });
try {
  await expect.poll(async () => {
    try { return (await fetch(`${base}/api/health`)).status; } catch { return 0; }
  }, { timeout: 90000, intervals: [1000] }).toBe(200);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  await page.goto('/?billboard=tsq-013');
  await page.getByRole('button', { name: /Claim this billboard|Outbid this brand/ }).click();
  await page.getByLabel('Brand name', { exact: false }).fill('Return exactly here');
  await page.getByLabel('Website', { exact: false }).fill('https://example.com');
  await page.getByLabel('Tagline', { exact: true }).fill('A draft worth coming back to');
  await page.getByLabel('About your brand').fill('An independent studio making thoughtful things.');
  await page.route('**/api/upload', route => route.fulfill({ json: { url: '/demo/iphone-x-trailer.webp', kind: 'image' } }));
  await page.getByLabel('Upload artwork', { exact: true }).setInputFiles('public/demo/iphone-x-trailer.webp');
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page.getByLabel('Email address')).not.toBeAttached();
  // Cancellation must retain the editor destination and its saved draft for retry.
  cancel = true;
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText(/Sign-in was not completed/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('billboard')).toBe('tsq-013');
  cancel = false;
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(`${base}/?billboard=tsq-013&panel=editor`);
  await expect(page.getByLabel('Brand name', { exact: false })).toHaveValue('Return exactly here', { timeout: 30000 });
  expect((await (await context.request.get('/api/me')).json()).account.email).toBe('owner@example.com');
  const draft = await (await context.request.get('/api/draft')).json();
  expect(draft.data.creative.name).toBe('Return exactly here');
  expect(draft.data.slotId).toBe('tsq-013');
  const cookies = await context.cookies();
  expect(cookies.find(c => c.name === 'paper_session').httpOnly).toBe(true);
  expect(cookies.some(c => c.name.startsWith('paper_google_'))).toBe(false);
  // Reproduce opening the profile before the restored session request completes.
  let releaseAccount;
  const accountGate = new Promise(resolve => { releaseAccount = resolve; });
  let accountRequested;
  const accountStarted = new Promise(resolve => { accountRequested = resolve; });
  await page.route('**/api/me', async route => {
    accountRequested();
    await accountGate;
    await route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await accountStarted;
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.getByText('Loading your account…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).not.toBeAttached();
  releaseAccount();
  await expect(page.locator('.account-strip')).toContainText('owner@example.com');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).not.toBeAttached();
  await page.unroute('**/api/me');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.locator('.account-strip')).toContainText('owner@example.com');
  // A failed session lookup must offer retry, not pretend the user signed out.
  await page.route('**/api/me', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Brand name', { exact: false })).toHaveValue('Return exactly here');
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.getByRole('button', { name: 'Retry account' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Continue with Google' })).not.toBeAttached();
  await page.unroute('**/api/me');
  await page.getByRole('button', { name: 'Retry account' }).click();
  await expect(page.locator('.account-strip')).toContainText('owner@example.com');
  // Changes made in another tab must be recognized when this tab regains focus.
  await context.request.post('/api/auth/logout', { headers: { Origin: base }, data: {} });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  const otherStart = await context.request.post('/api/auth/google', { headers: { Origin: base }, data: {} });
  const otherTab = await context.newPage();
  await otherTab.goto((await otherStart.json()).url);
  await expect(otherTab.locator('.account-strip')).toContainText('owner@example.com');
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.account-strip')).toContainText('owner@example.com');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  expect((await (await context.request.get('/api/me')).json()).account).toBeNull();
  await mkdir('artifacts/audit', { recursive: true });
  await page.screenshot({ path: 'artifacts/audit/google-sign-in-return.png' });
  const stranger = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 } });
  const invalid = await stranger.newPage();
  await invalid.goto('/auth/callback?code=invalid&next=https://evil.example');
  await expect(invalid.getByText(/Sign-in was not completed/)).toBeVisible();
  expect(new URL(invalid.url()).origin).toBe(base);
  expect((await (await stranger.request.get('/api/me')).json()).account).toBeNull();
  await expect(invalid.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await invalid.screenshot({ path: 'artifacts/audit/google-sign-in-mobile.png' });
  const denied = await stranger.request.post('/api/auth/google', { headers: { Origin: 'https://evil.example' }, data: {} });
  expect(denied.ok()).toBe(false);
  const checkout = randomUUID();
  const start = await stranger.request.post('/api/auth/google', { headers: { Origin: base }, data: { returnTo: `/?checkout=${checkout}` } });
  await invalid.goto((await start.json()).url);
  await expect(invalid).toHaveURL(`${base}/?checkout=${checkout}`);
  const report = { provider: 'local fixture', passed: ['Google button', 'PKCE session exchange', 'saved draft and billboard restoration',
    'cancel and retry preserve editor', 'HttpOnly session and verifier cleanup', 'invalid callback rejected', 'cross-origin start rejected', 'mobile sign-in', 'checkout return',
    'profile waits for session after reload', 'profile reopens without login', 'failed account lookup recovers', 'cross-tab sign-in and sign-out refresh on focus', 'explicit sign-out'] };
  await writeFile('artifacts/audit/google-sign-in-flow.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await mkdir('artifacts/audit', { recursive: true });
  await writeFile('artifacts/audit/google-sign-in-test-server.log', logs);
  throw error;
} finally {
  await browser?.close();
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else app.kill('SIGTERM');
  provider.close();
}
