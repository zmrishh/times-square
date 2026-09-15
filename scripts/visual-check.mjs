import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.locator(".scene canvas").waitFor();
await page.waitForTimeout(3500);
await page.screenshot({ path: "artifacts/desktop-square.png" });
console.log(
  "Scene:",
  await page.locator(".scene").textContent(),
  "Errors:",
  errors,
);
await page.getByRole("button", { name: "Directory", exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "artifacts/desktop-directory.png" });
await page.getByRole("button", { name: "Close panel", exact: true }).click();
await page.goto("http://localhost:3000/?billboard=tsq-007", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "artifacts/desktop-placement.png" });
await page
  .getByRole("button", { name: "Claim this billboard", exact: true })
  .click();
await page.waitForTimeout(500);
await page.screenshot({ path: "artifacts/desktop-editor.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "artifacts/mobile-square.png" });
await page.getByRole("button", { name: /Bid from \$10/ }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "artifacts/mobile-directory.png" });
await page.setViewportSize({ width: 1440, height: 960 });
await page.goto("http://localhost:3000/?billboard=tsq-012", {
  waitUntil: "networkidle",
});
await page.getByRole("button", { name: "Close panel", exact: true }).click();
await page.mouse.move(600, 400);
await page.mouse.down();
await page.mouse.move(600, 585, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(800);
await page.screenshot({ path: "artifacts/north-steps.png" });
await writeFile(
  "artifacts/browser-errors.json",
  JSON.stringify(errors, null, 2),
);
await browser.close();
if (errors.length) process.exitCode = 1;
