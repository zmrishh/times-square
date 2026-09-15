import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PAPER_TEST_ORIGIN || 'http://localhost:3001';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = [];
try {
  await mkdir('artifacts/media', { recursive: true });
  const placements = process.env.PAPER_DEMO_SLOT
    ? [[process.env.PAPER_DEMO_SLOT, 1366], [process.env.PAPER_DEMO_SLOT, 390]]
    : [['tsq-026', 1366], ['tsq-009', 390], ['tsq-006', 1366], ['tsq-044', 390], ['tsq-007', 1366]];
  for (const [id, width] of placements) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      // Track detached Three.js video elements as well as panel previews.
      window.demoVideoElements = [];
      const create = document.createElement.bind(document);
      document.createElement = function (...args) {
        const element = create(...args);
        if (element instanceof HTMLVideoElement) window.demoVideoElements.push(element);
        return element;
      };
    });
    await page.goto(`${origin}/?billboard=${id}`);
    await expect(page.getByRole('button', { name: 'Claim this billboard' })).toBeEnabled();
    await expect(page.getByText('VIDEO DEMO · AVAILABLE TO BUY')).toBeVisible();
    const video = page.locator('video').first();
    await expect.poll(() => video.evaluate(v => v.currentTime), { timeout: 20000 }).toBeGreaterThan(3);
    const playback = await video.evaluate(v => ({ source: v.currentSrc, time: v.currentTime, duration: v.duration, muted: v.muted, looping: v.loop, error: v.error?.message || null }));
    expect(playback.muted).toBe(true);
    expect(playback.looping).toBe(true);
    expect(playback.error).toBeNull();
    await page.screenshot({ path: `artifacts/media/demo-${id}-${width}.png` });
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    const scenePlayback = () => page.evaluate(source => window.demoVideoElements
      .filter(v => !v.isConnected && v.currentSrc === source && !v.paused)
      .map(v => ({ time: v.currentTime, loop: v.loop, muted: v.muted, error: v.error?.message || null })), playback.source);
    await expect.poll(async () => (await scenePlayback()).some(v => v.time > 6 && v.loop && !v.error), { timeout: 30000 }).toBe(true);
    await page.screenshot({ path: `artifacts/media/demo-scene-${id}-${width}.png` });
    expect(errors).toEqual([]);
    evidence.push({ id, width, playback, scenePlayback: await scenePlayback(), errors });
    await page.close();
  }
  await writeFile('artifacts/media/demo-playback.json', JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
