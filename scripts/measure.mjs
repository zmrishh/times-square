import { chromium } from "@playwright/test";
import { writeFile, readdir, readFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const report = {
  date: new Date().toISOString(),
  platform: os.platform(),
  cpu: os.cpus()[0]?.model,
  logicalCores: os.cpus().length,
  browser: browser.version(),
  note: "Headless Edge on this Windows host; mobile is viewport emulation, not a physical phone. Development-mode frame samples, no device-wide guarantees.",
  samples: [],
  productionAssets: {},
};
for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const start = Date.now();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.locator(".scene canvas[data-camera]").waitFor();
  const readyMs = Date.now() - start;
  const dismiss = page.getByRole('button', { name: 'Dismiss introduction' });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.waitForTimeout(2000);
  const metrics = await page.evaluate(async () => {
    const canvas = document.querySelector(".scene canvas");
    const gl = canvas.getContext("webgl2");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const frames = [];
    let last = performance.now(),
      start = last;
    await new Promise((resolve) => {
      function tick(now) {
        frames.push(now - last);
        last = now;
        if (now - start < 8000) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    frames.sort((a, b) => a - b);
    return {
      fps:
        Math.round(
          (1000 / (frames.reduce((s, v) => s + v, 0) / frames.length)) * 10,
        ) / 10,
      p95FrameMs:
        Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
      drawCalls: Number(canvas.dataset.renderCalls),
      triangles: Number(canvas.dataset.triangles),
      renderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
      resources: performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes(location.origin))
        .reduce((s, r) => s + r.encodedBodySize, 0),
    };
  });
  report.samples.push({
    viewport,
    readyIncludingNetworkIdleMs: readyMs,
    ...metrics,
  });
  await page.close();
}
async function files(dir) {
  const all = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    all.push(...(f.isDirectory() ? await files(p) : [p]));
  }
  return all;
}
try {
  const assets = (await files(".next/static")).filter((f) =>
    /\.(js|css|woff2)$/.test(f),
  );
  let compressed = 0;
  for (const f of assets) compressed += gzipSync(await readFile(f)).length;
  report.productionAssets = {
    files: assets.length,
    gzipBytes: compressed,
    note: "Conservative sum of all production JS/CSS/fonts, including routes not initially requested. Canvas textures and procedural geometry have no asset transfer.",
  };
} catch {
  report.productionAssets = {
    note: "Run npm run build first for production asset measurement.",
  };
}
await writeFile(process.argv[2] || "artifacts/performance.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
