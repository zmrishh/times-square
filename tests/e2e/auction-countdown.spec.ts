import { test, expect } from '@playwright/test';

test('countdown persists on refresh and fits desktop and mobile with How it works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const first = await (await page.request.get('/api/public')).json();
  expect(first.auction.closed).toBe(false);
  await page.goto('/');
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.locator('.auction-caption')).toHaveText('Highest bidder on each billboard stays forever.');
  await expect(page.locator('[data-welcome-overlay]')).toHaveCount(0, { timeout: 20000 });
  const before = await page.getByRole('timer').textContent();
  await expect.poll(() => page.getByRole('timer').textContent()).not.toBe(before);
  await page.screenshot({ path: 'artifacts/auction-desktop.png' });
  await page.reload();
  const second = await (await page.request.get('/api/public')).json();
  expect(second.auction.endsAt).toBe(first.auction.endsAt);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.scene-footer').getByRole('button', { name: 'How it works' }).click();
    await expect(page.getByRole('heading', { name: 'Win your place forever' })).toBeVisible();
    const banner = await page.locator('.auction-countdown').boundingBox();
    const drawer = await page.getByRole('dialog').boundingBox();
    expect(banner!.x).toBeGreaterThanOrEqual(0);
    expect(banner!.x + banner!.width).toBeLessThanOrEqual(width);
    expect(drawer!.y).toBeGreaterThanOrEqual(banner!.y + banner!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/auction-mobile-${width}.png` });
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('an open page switches to closed at zero and disables bidding', async ({ page }) => {
  const snapshot = await (await page.request.get('/api/public')).json();
  const now = Date.now();
  snapshot.auction = { startsAt: new Date(now - 7 * 86400000 + 3000).toISOString(),
    endsAt: new Date(now + 3000).toISOString(), serverNow: new Date(now).toISOString(), closed: false };
  await page.route('**/api/public', route => route.fulfill({ json: snapshot }));
  await page.goto('/?billboard=tsq-072');
  await expect(page.locator('.auction-countdown')).toHaveAttribute('data-closed', 'true', { timeout: 30000 });
  await expect(page.getByRole('button', { name: /Bidding closed|Permanent winner/, exact: true })).toBeDisabled();
  await expect(page.locator('.auction-time')).toHaveText('Winners stay forever');
  await expect(page.getByText('Next minimum ranking', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/auction-closed.png' });
});
