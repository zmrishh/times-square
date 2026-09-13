import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';

const origin = 'https://newyorkcity-kappa.vercel.app';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = { origin, checks: [], errors: [], network: [], financialActions: 0 };
try {
  await mkdir('artifacts/media', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('requestfailed', request => evidence.network.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }));
  page.on('response', async response => {
    if (/\/api\/upload|\/upload\/resumable/.test(response.url())) {
      const entry = { method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() };
      evidence.network.push(entry); console.log(JSON.stringify(entry));
      if (response.status() >= 400) {
        const body = await response.json().catch(() => ({}));
        const message = String(body.message || body.error || body.code || '').replace(/https?:\/\/\S+|eyJ[A-Za-z0-9_.-]+/g, '[redacted]').slice(0, 250);
        evidence.network.push({ status: response.status(), message });
        console.log(JSON.stringify({ status: response.status(), message }));
      }
    }
  });
  const before = await (await context.request.get(`${origin}/api/public`)).json();
  evidence.paymentMode = before.mode;
  expect(before.slots).toHaveLength(72);
  for (const [id, width] of [['tsq-026', 1366], ['tsq-009', 390]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/?billboard=${id}`);
    await expect(page.getByRole('button', { name: 'Claim this billboard' })).toBeEnabled();
    await expect.poll(() => page.locator('video').first().evaluate(v => v.currentTime), { timeout: 30000 }).toBeGreaterThan(3);
    await page.screenshot({ path: `artifacts/media/live-demo-${id}-${width}.png` });
    evidence.checks.push(`${id}: real looping demo, available claim action, ${width}px`);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: 'Claim this billboard' }).click();
  await page.getByRole('button', { name: 'Looping video', exact: true }).click();
  await expect(page.getByText(/50 MB/)).toBeVisible();
  const completion = page.waitForResponse(r => r.url().endsWith('/api/upload/complete') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByLabel('Upload video', { exact: true }).setInputFiles('artifacts/large-video-fixture.mp4');
  const response = await completion, media = await response.json();
  expect(response.ok(), JSON.stringify(media)).toBeTruthy();
  expect(media.kind).toBe('video');
  const redirected = await context.request.get(origin + media.url, { maxRedirects: 0 });
  expect(redirected.status()).toBe(307);
  expect(new URL(redirected.headers().location).protocol).toBe('https:');
  const playback = await page.evaluate(async url => {
    const response = await fetch(url, { headers: { Range: 'bytes=0-99' } });
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  }, media.url);
  expect(playback.status).toBe(206);
  expect(playback.bytes).toBe(100);
  const stranger = await browser.newContext();
  expect((await stranger.request.get(origin + media.url)).status()).toBe(404);
  expect((await stranger.request.get(origin + media.poster)).status()).toBe(404);
  await stranger.close();
  await expect.poll(() => page.locator('video').first().evaluate(v => v.currentTime), { timeout: 30000 }).toBeGreaterThan(1);
  await page.screenshot({ path: 'artifacts/media/live-large-video-editor.png' });
  evidence.uploadBytes = (await stat('artifacts/large-video-fixture.mp4')).size;
  evidence.assetId = media.url.split('/').at(-1);
  evidence.checks.push('Real hosted Supabase resumable upload, server validation, signed HTTPS playback, 206 byte range, anonymous private access boundary');
  const after = await (await context.request.get(`${origin}/api/public`)).json();
  expect(after.slots.map(s => [s.id, s.brandId, s.total])).toEqual(before.slots.map(s => [s.id, s.brandId, s.total]));
  evidence.checks.push('All 72 slot identities, owners and ranking totals unchanged; no checkout or payment attempted');
  expect(evidence.errors).toEqual([]);
} catch (error) {
  evidence.failure = error.message.split('\nCall log:')[0].replace(/https?:\/\/\S+|eyJ[A-Za-z0-9_.-]+/g, '[redacted]');
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: 'artifacts/media/live-upload-failure.png' }).catch(() => {});
    evidence.feedback = await page.locator('.upload-feedback, [role="alert"], .toast').allTextContents();
  }
  process.exitCode = 1;
} finally {
  await writeFile('artifacts/media/hosted-video-release.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  await browser.close();
}
