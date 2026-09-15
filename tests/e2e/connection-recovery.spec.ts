import { test, expect } from "@playwright/test";

test("temporary public-data failure recovers and clears its connection message", async ({ page, request }) => {
  const snapshot = await (await request.get("/api/public")).json();
  let calls = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/public", route => {
    calls++;
    return calls <= 2
      ? route.fulfill({ status: 503, json: { error: "The square is reconnecting. Please try again shortly." } })
      : route.fulfill({ json: snapshot });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Reconnecting to the square. Updates will resume automatically.")).toBeVisible();
  await expect.poll(() => calls, { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  await expect(page.getByText("Reconnecting to the square. Updates will resume automatically.")).not.toBeVisible();
  await expect(page.getByText(/signal timed out/i)).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("a slow public-data request does not accumulate overlapping polling requests", async ({ page, request }) => {
  const snapshot = await (await request.get("/api/public")).json();
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/public", async route => {
    calls++;
    await held;
    await route.fulfill({ json: snapshot });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => calls).toBe(1);
  await page.waitForTimeout(5700);
  expect(calls).toBe(1);
  release();
  await expect(page.locator(".scene-footer")).toContainText("placements");
});
