import { test, expect } from '@playwright/test';

test('hosted sign-in offers Google and invalid callbacks return to the form', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/public')).json();
  test.skip(snapshot.mode === 'simulation', 'Hosted Google interface only.');
  const response = await request.get('/auth/callback?code=invalid&next=https://example.org', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const destination = new URL(response.headers().location);
  expect(destination.origin).toBe(new URL(test.info().project.use.baseURL!).origin);
  expect(destination.searchParams.get('signin')).toBe('retry');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?signin=retry');
  await expect(page.getByText(/Sign-in was not completed/)).toBeVisible();
  await expect(page.getByLabel('Email address')).not.toBeAttached();
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible();
  await expect(page.getByLabel('One-time code')).not.toBeAttached();
  await page.screenshot({ path: 'artifacts/audit/google-sign-in-live-mobile.png' });
});

for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  test(`introduction close icon is centered and dismisses (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const close = page.getByRole('button', { name: 'Dismiss introduction' });
    await expect(close).toBeVisible({ timeout: 45000 });
    const button = (await close.boundingBox())!, icon = (await close.locator('svg').boundingBox())!;
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2)).toBeLessThan(1);
    expect(Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2)).toBeLessThan(1);
    await page.locator('.intro-card').screenshot({ path: `artifacts/audit/intro-close-${viewport.width}.png` });
    await close.click();
    await expect(page.locator('.intro-card')).not.toBeAttached();
    expect(await page.evaluate(() => sessionStorage.getItem('paper-intro'))).toBe('1');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Your account' })).toBeVisible();
    await expect(page.locator('.intro-card')).not.toBeAttached();
  });
}

test('email code sign-in preserves the draft and rejects a reused code', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/public')).json();
  test.skip(snapshot.mode !== 'simulation', 'Local authentication fixture only; never send test emails in production.');
  const base = test.info().project.use.baseURL!;
  const saved = await page.request.post('/api/draft', { headers: { Origin: base }, data: { name: 'Preserved sign-in draft' } });
  expect(saved.ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Your account' }).click();
  const email = `auth-${Date.now()}@example.com`;
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByRole('status')).toContainText('six-digit sign-in code');
  const code = (await page.locator('.notice b').textContent())!;
  await page.getByLabel('One-time code').fill(code);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page.getByLabel('One-time code')).not.toBeAttached();
  const me = await (await page.request.get('/api/me')).json();
  expect(me.account.email).toBe(email);
  expect((await (await page.request.get('/api/draft')).json()).data.name).toBe('Preserved sign-in draft');
  const replay = await page.request.post('/api/auth/verify', { headers: { Origin: base }, data: { email, code } });
  expect(replay.ok()).toBe(false);
});
