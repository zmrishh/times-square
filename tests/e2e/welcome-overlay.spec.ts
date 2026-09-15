import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    welcomeAudit: { started: number; removed: number; appearances: number; samples: { at: number; opacity: number }[] };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.welcomeAudit = { started: 0, removed: 0, appearances: 0, samples: [] };
    let previous: Element | null = null;
    new MutationObserver(() => {
      const overlay = document.querySelector("[data-welcome-overlay]");
      if (overlay && !previous) {
        window.welcomeAudit.appearances++;
        const record = () => {
          // Animation events can be delivered late while WebGL initializes.
          // Measure against the compositor timeline, not event dispatch time.
          const elapsed = Number(overlay.getAnimations()[0]?.currentTime || 0);
          window.welcomeAudit.started = performance.now() - elapsed;
          for (const delay of [400, 1500, 5500, 6500]) {
            setTimeout(() => window.welcomeAudit.samples.push({
              at: performance.now() - window.welcomeAudit.started,
              opacity: Number(getComputedStyle(overlay).opacity),
            }), Math.max(0, delay - elapsed));
          }
        };
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) record();
        else overlay.addEventListener("animationstart", record, { once: true });
      }
      if (!overlay && previous) window.welcomeAudit.removed = performance.now();
      previous = overlay;
    }).observe(document, { childList: true, subtree: true });
  });
});

test("welcome fades, permits city interaction, and runs once despite rerenders", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const overlay = page.locator("[data-welcome-overlay]");
  await expect(overlay).toBeAttached({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Dismiss introduction" })).not.toBeVisible();
  const canvas = page.locator(".scene canvas");
  // Camera telemetry is intentionally excluded from production bundles.
  // The local run checks movement; both environments check real hit testing.
  if (["localhost", "127.0.0.1"].includes(new URL(page.url()).hostname)) {
    await expect(canvas).toHaveAttribute("data-camera", /.+/);
    const start = await canvas.getAttribute("data-camera");
    await page.keyboard.down("w");
    await expect.poll(() => canvas.getAttribute("data-camera")).not.toBe(start);
    await page.keyboard.up("w");
  }
  // A real click reaches the canvas at the center of the welcome lettering.
  const canvasHit = await page.evaluate(() => {
    const rect = document.querySelector("[data-welcome-overlay]")!.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return { x, y, tag: document.elementFromPoint(x, y)?.tagName };
  });
  expect(canvasHit.tag).toBe("CANVAS");
  await page.mouse.move(canvasHit.x, canvasHit.y);
  await page.mouse.down();
  await page.mouse.move(canvasHit.x + 30, canvasHit.y, { steps: 3 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: "artifacts/media/welcome-desktop.png" });
  await expect(overlay).not.toBeAttached({ timeout: 10000 });
  const audit = await page.evaluate(() => window.welcomeAudit);
  await test.info().attach("welcome-timing", { body: JSON.stringify(audit), contentType: "application/json" });
  expect(audit.appearances).toBe(1);
  expect(audit.removed - audit.started).toBeGreaterThanOrEqual(6800);
  expect(audit.removed - audit.started).toBeLessThan(8500);
  expect(audit.samples).toHaveLength(4);
  expect(audit.samples[0].opacity).toBeGreaterThan(0.15);
  expect(audit.samples[0].opacity).toBeLessThan(0.8);
  expect(audit.samples[1].opacity).toBe(1);
  expect(audit.samples[2].opacity).toBe(1);
  expect(audit.samples[3].opacity).toBeGreaterThan(0.1);
  expect(audit.samples[3].opacity).toBeLessThan(0.85);
  await page.getByRole("button", { name: "Quality and controls", exact: true }).click();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(overlay).not.toBeAttached();
  expect(await page.evaluate(() => window.welcomeAudit.appearances)).toBe(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(overlay).toBeAttached({ timeout: 30000 });
});

test("reduced motion stays static, fits mobile and landscape, then removes itself", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const overlay = page.locator("[data-welcome-overlay]");
  await expect(overlay).toBeAttached({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const style = await overlay.evaluate(element => ({
    opacity: getComputedStyle(element).opacity,
    animation: getComputedStyle(element).animationName,
    color: getComputedStyle(element).color,
  }));
  expect(style).toEqual({ opacity: "1", animation: "none", color: "rgb(255, 182, 64)" });
  for (const [width, height, name] of [[320, 740, "mobile"], [844, 390, "landscape"]] as const) {
    await page.setViewportSize({ width, height });
    for (const text of ["Welcome to", "Times", "Square"]) {
      const bounds = await overlay.getByText(text, { exact: true }).evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      expect(bounds.left).toBeGreaterThan(8);
      expect(bounds.right).toBeLessThan(width - 8);
      expect(bounds.top).toBeGreaterThan(0);
      expect(bounds.bottom).toBeLessThan(height);
    }
    await page.screenshot({ path: `artifacts/media/welcome-${name}.png` });
  }
  await expect(overlay).not.toBeAttached({ timeout: 10000 });
  const audit = await page.evaluate(() => window.welcomeAudit);
  expect(audit.samples.every(sample => sample.opacity === 1)).toBe(true);
  expect(audit.removed - audit.started).toBeGreaterThanOrEqual(6800);
});
