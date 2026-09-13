import { test, expect } from "@playwright/test";
import { SLOTS, HERO } from "../../src/lib/registry";

test("walking, dragging, pointer lock, safe viewpoints and typing isolation", async ({
  page,
}) => {
  test.setTimeout(200000);
  await page.goto("/");
  const canvas = page.locator(".scene canvas");
  await expect(canvas).toHaveAttribute("data-camera", /.+/);
  await page.getByRole("button", { name: "Dismiss introduction" }).click();
  const camera = async () =>
    JSON.parse((await canvas.getAttribute("data-camera"))!) as number[];
  const start = await camera();
  await page.keyboard.down("w");
  await page.waitForTimeout(1100);
  await page.keyboard.up("w");
  await expect
    .poll(async () => (await camera())[2])
    .toBeGreaterThan(start[2] + 1);
  await page.getByRole("button", { name: "Directory", exact: true }).click();
  await page.waitForTimeout(1100);
  const stopped = await camera();
  await page.getByLabel("Search directory").fill("wasd");
  await page.waitForTimeout(1200);
  expect(await camera()).toEqual(stopped);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect.poll(async () => await camera()).toEqual(HERO.position);
  await page.mouse.move(220, 220);
  await page.mouse.down();
  await page.mouse.move(265, 250, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Walk mode", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.pointerLockElement))
    .toBe(true);
  await expect(page.locator(".reticle")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => !!document.pointerLockElement))
    .toBe(false);
  for (const slot of SLOTS) {
    await page.evaluate((id) => {
      history.pushState({}, "", `/?billboard=${id}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, slot.id);
    await expect.poll(async () => await camera()).toEqual(slot.camera);
    expect(slot.camera[1]).toBe(1.72);
  }
  await page.goto("/?billboard=tsq-012");
  await expect(canvas).toHaveAttribute("data-camera", /.+/);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.keyboard.down("w");
  await page.waitForTimeout(6000);
  await page.keyboard.up("w");
  const pos = await camera();
  expect(pos[2]).toBeGreaterThanOrEqual(-63.2);
  await page.screenshot({ path: "artifacts/collision-view.png" });
});
