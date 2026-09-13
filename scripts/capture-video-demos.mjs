import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PAPER_TEST_ORIGIN || 'http://localhost:3001';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = [];
try {
  await mkdir('artifacts/media', { recursive: true });
  for (const [id, width] of [['tsq-026', 1366], ['tsq-009', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${origin}/?billboard=${id}`);
    await expect(page.getByRole('button', { name: 'Claim this billboard' })).toBeEnabled();
    const video = page.locator('video').first();
    await expect.poll(() => video.evaluate(v => v.currentTime), { timeout: 20000 }).toBeGreaterThan(3);
    evidence.push({ id, width, playback: await video.evaluate(v => ({ source: v.currentSrc, time: v.currentTime, muted: v.muted, looping: v.loop, error: v.error?.message || null })) });
    await page.screenshot({ path: `artifacts/media/demo-${id}-${width}.png` });
    await page.close();
  }
  await writeFile('artifacts/media/demo-playback.json', JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
