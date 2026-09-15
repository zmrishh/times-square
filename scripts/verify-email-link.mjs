// Runs the real app and SDK against an isolated local email-provider fixture.
// No real email, hosted database, payment, or production credential is used.
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:3003';
const messages = new Map(), codes = new Map();
const provider = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/auth/v1/otp') {
    let input = ''; for await (const chunk of req) input += chunk;
    const body = JSON.parse(input);
    if (body.email === 'quota@example.com') return json(429, { code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' });
    if (body.email === 'blocked@example.com') return json(400, { code: 'email_address_not_authorized', msg: 'Email address not authorized' });
    const token = randomUUID();
    messages.set(body.email, { token, email: body.email, challenge: body.code_challenge, redirect: url.searchParams.get('redirect_to') });
    return json(200, {});
  }
  if (url.pathname === '/auth/v1/verify') {
    const entry = [...messages.values()].find(m => m.token === url.searchParams.get('token'));
    if (!entry) return json(400, { msg: 'Invalid token' });
    const code = randomUUID(); codes.set(code, entry);
    res.writeHead(303, { Location: `${entry.redirect}?code=${code}` }); return res.end();
  }
  if (url.pathname === '/auth/v1/token') {
    let input = ''; for await (const chunk of req) input += chunk;
    const body = JSON.parse(input), entry = codes.get(body.auth_code);
    codes.delete(body.auth_code);
    if (!entry || createHash('sha256').update(body.code_verifier).digest('base64url') !== entry.challenge)
      return json(400, { msg: 'Invalid verifier' });
    return json(200, { access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: randomUUID(), email: entry.email, email_confirmed_at: new Date().toISOString() } });
  }
  json(404, {});
});
await new Promise(resolve => provider.listen(3403, '127.0.0.1', resolve));
const env = { ...process.env, DATABASE_URL: '', PAYMENT_MODE: 'dodo-test', AUTH_MODE: 'supabase', APP_ORIGIN: base,
  PAPER_DATA_DIR: ':memory:', SUPABASE_URL: 'http://127.0.0.1:3403', SUPABASE_SERVICE_ROLE_KEY: 'fixture-key' };
delete env.PAPER_TEST_ORIGIN;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '-p', '3003'],
  { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; app.stdout.on('data', b => { logs += b; }); app.stderr.on('data', b => { logs += b; });
let browser;
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
  // Media upload has separate provider tests; keep this fixture focused on auth.
  await page.route('**/api/upload', route => route.fulfill({ json: { url: '/demo/iphone-x-trailer.webp', kind: 'image' } }));
  await page.getByLabel('Upload artwork', { exact: true }).setInputFiles('public/demo/iphone-x-trailer.webp');
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await page.getByLabel('Email address').fill('owner@example.com');
  await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('newest sign-in link');
  await expect(page.getByLabel('One-time code')).not.toBeAttached();
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  const email = messages.get('owner@example.com');
  const duplicate = await context.request.post('/api/auth/send', { headers: { Origin: base }, data: { email: 'owner@example.com', returnTo: '/?billboard=tsq-013&panel=editor' } });
  expect(duplicate.ok()).toBe(true);
  expect(messages.get('owner@example.com').token).toBe(email.token);
  console.log('Sign-in email requested through the app.');
  expect(email.redirect).toBe(`${base}/auth/callback`);
  const linkTab = await context.newPage();
  await linkTab.goto(`http://127.0.0.1:3403/auth/v1/verify?token=${email.token}`);
  await expect(linkTab).toHaveURL(`${base}/?billboard=tsq-013&panel=editor`);
  await expect(linkTab.getByLabel('Brand name', { exact: false })).toHaveValue('Return exactly here', { timeout: 30000 });
  const me = await (await context.request.get('/api/me')).json();
  expect(me.account.email).toBe('owner@example.com');
  const draft = await (await context.request.get('/api/draft')).json();
  expect(draft.data.creative.name).toBe('Return exactly here');
  expect(draft.data.slotId).toBe('tsq-013');
  console.log('Email callback restored the authenticated editor and saved draft.');
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Brand name', { exact: false })).toHaveValue('Return exactly here');
  console.log('Original tab resumed successfully.');
  const session = (await context.cookies()).find(c => c.name === 'paper_session');
  expect(session.httpOnly).toBe(true);
  expect((await context.cookies()).some(c => c.name.startsWith('paper_auth_'))).toBe(false);
  await mkdir('artifacts/audit', { recursive: true });
  await linkTab.screenshot({ path: 'artifacts/audit/email-link-return.png' });
  const stranger = await browser.newContext({ baseURL: base });
  const invalid = await stranger.newPage();
  await invalid.goto('/auth/callback?code=invalid&next=https://evil.example');
  await expect(invalid.getByText(/This sign-in link expired/)).toBeVisible();
  expect(new URL(invalid.url()).origin).toBe(base);
  expect((await (await stranger.request.get('/api/me')).json()).account).toBeNull();
  await invalid.getByLabel('Email address').fill('blocked@example.com');
  await invalid.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
  await expect(invalid.getByText('Email sign-in is currently limited to the project team. Please contact support.')).toBeVisible();
  await invalid.getByLabel('Email address').fill('quota@example.com');
  await invalid.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
  await expect(invalid.getByText(/Email delivery has reached its hourly limit/)).toBeVisible();
  await expect(invalid.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  const report = { provider: 'local fixture', passed: ['email link UI without code field', 'PKCE exchange through server callback', 'new-tab session', 'saved editor and selected billboard restored', 'original tab resumes', 'HttpOnly session and verifier cleanup', 'invalid callback does not sign in or redirect externally', 'email-provider restriction is explained'] };
  await writeFile('artifacts/audit/email-link-flow.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await mkdir('artifacts/audit', { recursive: true });
  await writeFile('artifacts/audit/email-link-test-server.log', logs);
  throw error;
} finally {
  await browser?.close();
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else app.kill('SIGTERM');
  provider.close();
}
