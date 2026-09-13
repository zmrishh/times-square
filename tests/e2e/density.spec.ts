import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { SLOTS } from "../../src/lib/registry";

test("all 72 real screen meshes can be hovered, selected and deep-linked", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto("/");
  const canvas = page.locator(".scene canvas");
  // A cold development server also compiles the dynamic scene chunk.
  await expect(canvas).toHaveAttribute("data-camera", /.+/, { timeout: 30000 });
  const publicData = await (await page.request.get("/api/public")).json();
  expect(publicData.slots.map((s: { id: string }) => s.id)).toEqual(
    SLOTS.map((s) => s.id),
  );
  for (const s of SLOTS) {
    await page.evaluate((id) => {
      history.pushState({}, "", `/?billboard=${id}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, s.id);
    await expect(page.locator(".drawer-header .eyebrow")).toContainText(
      s.id.toUpperCase(),
    );
    await expect
      .poll(() => canvas.getAttribute("data-camera"))
      .toBe(JSON.stringify(s.camera));
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    const box = (await canvas.boundingBox())!;
    const camera = new THREE.PerspectiveCamera(
      65,
      box.width / box.height,
      0.15,
      420,
    );
    camera.position.set(...s.camera);
    camera.lookAt(...s.look);
    camera.updateMatrixWorld();
    let selected = false;
    for (const segment of s.segments) {
      const p = new THREE.Vector3(...segment.position).project(camera);
      const x = box.x + ((p.x + 1) * box.width) / 2,
        y = box.y + ((1 - p.y) * box.height) / 2;
      if (p.z >= 1 || Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.9) continue;
      await page.mouse.move(x, y);
      await page.waitForTimeout(100);
      const tooltip = page.locator(".billboard-tooltip");
      if (
        !(await tooltip.textContent().catch(() => ""))?.includes(
          s.id.toUpperCase(),
        )
      )
        continue;
      await page.mouse.click(x, y);
      await expect(page.locator(".drawer-header .eyebrow")).toContainText(
        s.id.toUpperCase(),
      );
      await expect(page).toHaveURL(new RegExp(`billboard=${s.id}`));
      selected = true;
      break;
    }
    expect(selected, `${s.id} actual screen was not selectable`).toBe(true);
  }
});

test("expanded map, portrait previews, new wrap and mobile joystick work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Show 3 placements at Seventh Avenue" })
    .click();
  await expect(page.locator(".placement-card")).toHaveCount(3);
  await page
    .locator(".placement-card")
    .filter({ hasText: "North star feature" })
    .click();
  await expect(page).toHaveURL(/tsq-043/);
  await expect(
    page.getByRole("button", {
      name: /Claim this billboard|Outbid this brand/,
    }),
  ).toBeVisible();
  await page.goto("/?billboard=tsq-036");
  await expect(page.locator(".placement-caption")).toContainText("25.6 × 10 m");
  await page
    .getByRole("button", { name: /Claim this billboard|Outbid this brand/ })
    .click();
  await page
    .getByLabel("Brand name", { exact: false })
    .fill("Geometry preview");
  await page
    .getByRole("button", { name: /See it on your actual billboard/ })
    .click();
  await expect(page.getByText("YOUR CREATIVE · LIVE PREVIEW")).toBeVisible();
  await page.screenshot({ path: "artifacts/density/wrap-preview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const intro = page.getByRole("button", { name: "Dismiss introduction" });
  if (await intro.isVisible()) await intro.click();
  const canvas = page.locator(".scene canvas");
  await expect(canvas).toHaveAttribute("data-camera", /.+/);
  const start = JSON.parse((await canvas.getAttribute("data-camera"))!);
  const joystick = page.getByLabel("Movement joystick");
  const b = (await joystick.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.15);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.mouse.up();
  await expect
    .poll(
      async () => JSON.parse((await canvas.getAttribute("data-camera"))!)[2],
    )
    .toBeGreaterThan(start[2] + 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
