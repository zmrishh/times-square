import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PAPER_TEST_ORIGIN || 'http://localhost:3004';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = [];
await mkdir('artifacts/media', { recursive: true });
try {
  for (const [width, slow, reduced] of [[1366, false, false], [390, true, false], [1366, false, true]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600,
      reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.entryVideos = [];
      window.entryImages = [];
      const create = document.createElement.bind(document);
      document.createElement = function (...args) {
        const element = create(...args);
        if (element instanceof HTMLVideoElement) window.entryVideos.push(element);
        return element;
      };
      const NativeImage = window.Image;
      window.Image = function (...args) {
        const image = new NativeImage(...args);
        window.entryImages.push(image);
        return image;
      };
    });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    if (slow) await page.route(/\/(demo\/|api\/assets\/)/, async route => { await gate; await route.continue(); });
    const started = Date.now();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('.scene canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });
    if (slow) {
      await page.waitForTimeout(1000);
      await expect(page.locator('.scene-loading')).toBeVisible();
      await expect(canvas).not.toHaveAttribute('data-media-ready', 'true');
    }
    release();
    await expect(canvas).toHaveAttribute('data-media-ready', 'true', { timeout: 30000 });
    await expect(page.locator('.scene-loading')).toHaveCount(0);
    const readyMs = Date.now() - started;
    const images = await page.evaluate(() => window.entryImages.filter(i => i.complete && i.naturalWidth > 0).map(i => i.src));
    expect(images.length).toBeGreaterThan(0);
    if (!reduced) await expect.poll(() => page.evaluate(() => window.entryVideos.some(v => !v.paused && v.currentTime > 1)), { timeout: 25000 }).toBe(true);
    else expect(await page.evaluate(() => window.entryVideos.length)).toBe(0);
    // Everything above runs without any keyboard, pointer, touch, or scroll input.
    const videos = await page.evaluate(() => window.entryVideos.filter(v => v.currentSrc).map(v => ({ src: v.currentSrc, time: v.currentTime, paused: v.paused })));
    await page.waitForTimeout(reduced ? 500 : 7500);
    await page.screenshot({ path: `artifacts/media/entry-fixed-${width}-${reduced ? 'reduced' : 'normal'}.png` });
    expect(errors).toEqual([]);
    evidence.push({ width, slow, reduced, readyMs, images, videos, errors });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(`${origin}/?billboard=tsq-012`);
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await expect(page.locator('.scene canvas')).toHaveAttribute('data-media-ready', 'true', { timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(600, 585, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/media/red-steps-updated.png' });
  await writeFile('artifacts/media/entry-scene-checks.json', JSON.stringify({ origin, evidence }, null, 2));
  console.log(JSON.stringify({ origin, evidence }, null, 2));
} finally { await browser.close(); }
