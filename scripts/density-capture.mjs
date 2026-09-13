import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "after";
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
await mkdir(`artifacts/density/${phase}`, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const results = [];
for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, id] of [
    ["opening", ""],
    ["central", "tsq-003"],
    ["steps", "tsq-012"],
  ]) {
    await page.goto(`http://localhost:3000/${id ? `?billboard=${id}` : ""}`, {
      waitUntil: "networkidle",
    });
    await page.locator(".scene canvas[data-camera]").waitFor();
    const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
    if (await dismiss.isVisible()) await dismiss.click();
    const close = page.getByRole("button", {
      name: "Close panel",
      exact: true,
    });
    if (await close.isVisible()) await close.click();
    // Fixed drag puts the northern skyline and steps into one eye-height view.
    if (name === "steps") {
      await page.mouse.move(viewport.width * 0.42, viewport.height * 0.42);
      await page.mouse.down();
      await page.mouse.move(
        viewport.width * 0.42,
        viewport.height * 0.42 + 185,
        { steps: 15 },
      );
      await page.mouse.up();
    }
    await page.mouse.move(viewport.width - 20, viewport.height - 100);
    await page.waitForTimeout(2500);
    const metrics = await page
      .locator(".scene canvas")
      .evaluate((c) => ({ ...c.dataset }));
    await page.screenshot({
      path: `artifacts/density/${phase}/${viewport.width}-${name}.png`,
    });
    results.push({ viewport, name, metrics, errors: [...errors] });
  }
  await page.close();
}
await writeFile(
  `artifacts/density/${phase}/capture.json`,
  JSON.stringify(results, null, 2),
);
await browser.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.errors.length)) process.exitCode = 1;
