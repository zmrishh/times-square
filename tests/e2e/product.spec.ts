import { test, expect, APIRequestContext } from "@playwright/test";
import sharp from "sharp";
const origin = process.env.PAPER_TEST_ORIGIN || "http://localhost:3000";
test.beforeEach(async ({ request }) => {
  const snapshot = await (await request.get("/api/public")).json();
  expect(
    snapshot.mode,
    "Run these payment tests against an isolated simulation server.",
  ).toBe("simulation");
});
async function post(request: APIRequestContext, path: string, data: unknown) {
  const r = await request.post(`/api/${path}`, {
    headers: { Origin: origin },
    data,
  });
  const body = await r.json();
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}
async function login(request: APIRequestContext, email: string) {
  const sent = await post(request, "auth/send", { email });
  expect(sent.localCode).toBeTruthy();
  await post(request, "auth/verify", { email, code: sent.localCode });
}
for (const placement of ["tsq-013", "tsq-072"])
  test(`draft → email → direct payment → second visitor → refund (${placement})`, async ({
    page,
    browser,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const run = Date.now(),
      name = `Atlas Studio ${String(run).slice(-5)}`;
    const operator = await browser.newContext({ baseURL: origin });
    await login(operator.request, "operator@paper.local");
    const observer = await browser.newContext({ baseURL: origin });
    const other = await observer.newPage();
    await other.goto(`/?billboard=${placement}`);
    const unauthorized = await observer.request.get("/api/admin");
    expect(unauthorized.status()).toBe(403);
    await page.goto(`/?billboard=${placement}`);
    await page
      .getByRole("button", { name: /Claim this billboard|Outbid this brand/ })
      .click();
    await page.getByLabel("Brand name", { exact: false }).fill(name);
    await page
      .getByLabel("Website", { exact: false })
      .fill("https://atlas.example");
    await page
      .getByLabel("Tagline", { exact: true })
      .fill("A calmer place for big ideas.");
    await page
      .getByLabel("About your brand")
      .fill(
        "An independent design studio making thoughtful things for the internet.",
      );
    await page
      .getByLabel("Headline", { exact: false })
      .fill("Ideas worth\nlooking up for.");
    if (placement === "tsq-072") {
      await page.getByLabel("Headline", { exact: false }).fill("");
      await page
        .getByRole("button", { name: "Upload artwork", exact: true })
        .click();
      const image = await sharp({
        create: { width: 768, height: 384, channels: 3, background: "#e94b30" },
      })
        .png()
        .toBuffer();
      const uploaded = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/upload") && r.request().method() === "POST",
      );
      await page.getByLabel("Upload artwork", { exact: true }).setInputFiles({
        name: "direct-checkout.png",
        mimeType: "image/png",
        buffer: image,
      });
      expect((await uploaded).ok()).toBeTruthy();
    }
    await page.getByRole("button", { name: "Sign in to continue" }).click();
    await page
      .getByLabel("Email address")
      .fill(`advertiser-${run}@example.com`);
    await page.getByRole("button", { name: "Send sign-in code" }).click();
    const code = await page.locator(".notice b").textContent();
    await page.getByLabel("One-time code").fill(code!);
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await expect(page.getByLabel("Brand name", { exact: false })).toHaveValue(
      name,
    );
    await page
      .getByRole("button", { name: "Continue to payment", exact: true })
      .click();
    await expect(
      page.getByText("Your creative is ready for checkout"),
    ).toBeVisible();
    const me = await (await page.request.get("/api/me")).json();
    const brand = me.brands.find((b: { name: string }) => b.name === name);
    expect(brand).toBeTruthy();
    const tamper = await observer.request.post("/api/creatives", {
      headers: { Origin: origin },
      data: { brandId: brand.id, creative: brand.data },
    });
    expect(tamper.status()).toBe(403);
    expect(brand.status).toBe("approved");
    if (brand.data.image)
      expect((await observer.request.get(brand.data.image)).status()).toBe(404);
    await expect(
      page.getByText("Your creative is ready for checkout"),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(
      page.getByRole("button", { name: "Continue to payment simulation" }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/direct-checkout-${placement}.png`,
    });
    await page
      .getByRole("button", { name: "Continue to payment simulation" })
      .click();
    await expect(
      page.getByRole("button", { name: "Simulate successful payment" }),
    ).toBeVisible();
    const orderId = new URL(page.url()).searchParams.get("checkout")!;
    const before = await (await observer.request.get("/api/public")).json();
    expect(
      before.slots.find((s: { id: string }) => s.id === placement).creative
        ?.name,
    ).not.toBe(name);
    const otherStatus = await observer.request.post("/api/checkout/status", {
      headers: { Origin: origin },
      data: { orderId },
    });
    expect(otherStatus.status()).toBe(403);
    await page
      .getByRole("button", { name: "Simulate successful payment" })
      .click();
    await expect(page.getByText("You’re up in the square.")).toBeVisible();
    if (brand.data.image)
      expect((await observer.request.get(brand.data.image)).status()).toBe(200);
    await expect(other.getByRole("heading", { name, exact: true })).toBeVisible(
      {
        timeout: 15000,
      },
    );
    await page.screenshot({ path: "artifacts/payment-delivered.png" });
    await other.screenshot({ path: "artifacts/second-visitor-takeover.png" });
    const receipt = await page.request.get(`/api/receipt/${orderId}`);
    expect(receipt.ok()).toBeTruthy();
    const after = await (await page.request.get("/api/me")).json();
    const order = after.orders.find((o: { id: string }) => o.id === orderId);
    expect(order.state).toBe("delivered");
    await post(operator.request, "admin/refund", {
      paymentId: order.payment_id,
      reason: "End-to-end simulation refund verification.",
    });
    await post(operator.request, "admin/jobs", {});
    await expect
      .poll(async () => {
        const d = await post(page.request, "checkout/status", { orderId });
        return d.state;
      })
      .toBe("refunded");
    const refreshed = await (await observer.request.get("/api/public")).json();
    expect(
      refreshed.slots.find((s: { id: string }) => s.id === placement).creative
        ?.name,
    ).not.toBe(name);
    expect(JSON.stringify(refreshed)).not.toContain(
      `advertiser-${run}@example.com`,
    );
    await page.screenshot({ path: "artifacts/payment-refunded.png" });
    expect(errors).toEqual([]);
    await operator.close();
    await observer.close();
  });
test("mobile panels, directory fallback, focus and browser navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Get a billboard/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Search directory").fill("crown");
  await page
    .locator(".placement-card")
    .filter({ has: page.getByText("The crown", { exact: true }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "The crown", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Quality and controls" }).click();
  await page.getByRole("button", { name: "Use directory without 3D" }).click();
  await expect(
    page.getByRole("heading", { name: "Around the square" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/mobile-fallback.png" });
});
test("CSRF, unsupported uploads, forged returns and private data", async ({
  request,
  browser,
}) => {
  expect(
    (
      await request.post("/api/auth/send", {
        headers: { Origin: "https://evil.example" },
        data: { email: "test@example.com" },
      })
    ).status(),
  ).toBe(400);
  const svg = await request.post("/api/upload", {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "active.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>',
        ),
      },
    },
  });
  expect(svg.ok()).toBeFalsy();
  const fixture = await sharp({
    create: { width: 768, height: 384, channels: 3, background: "#e94b30" },
  })
    .png()
    .toBuffer();
  const uploaded = await request.post("/api/upload", {
    headers: { Origin: origin },
    multipart: {
      file: { name: "fixture.png", mimeType: "image/png", buffer: fixture },
    },
  });
  expect(uploaded.ok()).toBeTruthy();
  const asset = await uploaded.json();
  const owned = await request.get(asset.url);
  expect(owned.ok()).toBeTruthy();
  expect(owned.headers()["content-type"]).toBe("image/webp");
  const small = await request.get(`${asset.url}?size=256`);
  expect(small.ok()).toBeTruthy();
  const smallMeta = await sharp(await small.body()).metadata();
  expect([smallMeta.width, smallMeta.height]).toEqual([256, 128]);
  expect((await request.get(`${asset.url}?size=999999`)).status()).toBe(400);
  const outsider = await browser.newContext({ baseURL: origin });
  expect((await outsider.request.get(asset.url)).status()).toBe(404);
  expect((await outsider.request.get(`${asset.url}?size=256`)).status()).toBe(
    404,
  );
  await outsider.close();
  await post(request, "draft", { privateNote: "account-owned draft" });
  await login(request, `upload-owner-${Date.now()}@example.com`);
  expect((await request.get(asset.url)).ok()).toBeTruthy();
  await post(request, "auth/logout", {});
  expect((await request.get(asset.url)).status()).toBe(404);
  expect(await (await request.get("/api/draft")).json()).toBeNull();
  expect(
    (
      await request.get("/api/receipt/00000000-0000-4000-8000-000000000001")
    ).status(),
  ).toBe(403);
});
