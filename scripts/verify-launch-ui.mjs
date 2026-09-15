import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.PAPER_TEST_ORIGIN || 'http://localhost:3004';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('artifacts/launch', { recursive: true });
const checks = [];
try {
  if (process.env.PAPER_CAPTURE_SOCIAL === '1') {
    const page = await browser.newPage({ viewport: { width: 1200, height: 748 }, reducedMotion: 'reduce' });
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('.scene canvas')).toHaveAttribute('data-media-ready', 'true', { timeout: 45000 });
    await page.addStyleTag({ content: '.paper-app > :not(.scene) { visibility: hidden !important; }' });
    await page.waitForTimeout(1500);
    await mkdir('public/social', { recursive: true });
    await page.locator('.scene canvas').screenshot({ path: 'public/social/city-preview.png' });
    await page.close();
  }
  for (const width of [1366, 820, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await expect(page.locator('.header-offer p')).toHaveText('Your brand on a virtual Times Square billboard. From $10.');
    await expect(page.locator('.header-offer p')).toBeVisible();
    await expect(page.locator('.scene canvas')).toHaveAttribute('data-media-ready', 'true', { timeout: 45000 });
    await expect(page.locator('.intro-card')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `artifacts/launch/offer-${width}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    const offer = await page.locator('.header-offer p').boundingBox();
    expect(offer.x).toBeGreaterThanOrEqual(0);
    expect(offer.x + offer.width).toBeLessThanOrEqual(width + 1);
    await page.locator('.scene-footer').getByRole('button', { name: 'How it works', exact: true }).click();
    for (const heading of ['Choose a billboard', 'Add your artwork', 'Pay', 'Stay until outbid'])
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.locator('.drawer-body').textContent()).not.toMatch(/editable launch|admin preset|reconcil/i);
    await page.screenshot({ path: `artifacts/launch/how-${width}.png` });
    await page.getByRole('button', { name: 'Read the detailed rules & privacy policy' }).click();
    await expect(page.getByRole('heading', { name: 'Reservations, payment errors & refunds' })).toBeVisible();
    const text = await page.locator('.drawer-body').textContent();
    expect(text).not.toMatch(/live charging remains disabled|editable launch|admin preset/i);
    expect(text).toContain(origin.startsWith('http://localhost') ? 'Checkout does not charge real money.' : 'Live payments are enabled.');
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    await page.locator('.header-cta').click();
    await expect(page.getByRole('heading', { name: 'Around the square' })).toBeVisible();
    expect(errors).toEqual([]);
    checks.push({ width, overflow, errors });
    await page.close();
  }
  const page = await browser.newPage();
  const metadata = [];
  for (const path of ['/', '/?billboard=tsq-007']) {
    const response = await page.request.get(`${origin}${path}`, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
    expect(response.status()).toBe(200);
    const html = await response.text();
    const head = html.slice(0, html.indexOf('</head>'));
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) expect(head).toContain(`"${tag}"`);
    expect(head).toContain('summary_large_image');
    const image = head.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(image).toMatch(/^https?:\/\//);
    const imageResponse = await page.request.get(image);
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toMatch(/^image\//);
    metadata.push({ path, image, tagsInHead: true });
  }
  await writeFile('artifacts/launch/ui-verification.json', JSON.stringify({ origin, checks, metadata }, null, 2));
  console.log(JSON.stringify({ origin, checks, metadata }, null, 2));
} finally { await browser.close(); }
