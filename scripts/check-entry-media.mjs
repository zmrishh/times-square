import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PAPER_TEST_ORIGIN || 'https://newyorkcity-kappa.vercel.app';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const requests = [];
  page.on('response', response => {
    if (/api\/public|api\/assets|\/demo\//.test(response.url())) requests.push({ at: Date.now(), url: response.url(), status: response.status() });
  });
  await page.addInitScript(() => {
    window.entryVideos = [];
    window.entryImages = [];
    const create = document.createElement.bind(document);
    document.createElement = function (...args) {
      const element = create(...args);
      if (element instanceof HTMLVideoElement) window.entryVideos.push(element);
      return element;
    };
    const ImageClass = window.Image;
    window.Image = function (...args) {
      const image = new ImageClass(...args);
      window.entryImages.push(image);
      return image;
    };
  });
  const started = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await mkdir('artifacts/media', { recursive: true });
  const samples = [];
  for (const seconds of [3, 8, 15]) {
    await page.waitForTimeout(Math.max(0, started + seconds * 1000 - Date.now()));
    samples.push(await page.evaluate(() => ({
      at: performance.now(),
      loading: !!document.querySelector('.scene-loading'),
      videos: window.entryVideos.filter(v => v.currentSrc).map(v => ({ src: v.currentSrc, time: v.currentTime, ready: v.readyState, paused: v.paused })),
      images: window.entryImages.map(i => ({ src: i.src, loaded: i.complete && i.naturalWidth > 0 })),
    })));
    await page.screenshot({ path: `artifacts/media/entry-${seconds}s.png` });
  }
  const report = { base, samples, requests: requests.map(r => ({ ...r, at: r.at - started })) };
  await writeFile('artifacts/media/entry-diagnosis.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
