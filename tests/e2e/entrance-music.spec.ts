import { test as base, expect } from "@playwright/test";

const test = base.extend<{ autoplayAllowed: boolean }>({
  autoplayAllowed: [false, { option: true }],
  page: async ({ playwright, baseURL, autoplayAllowed }, providePage) => {
    const browser = await playwright.chromium.launch({
      channel: "msedge",
      args: [`--autoplay-policy=${autoplayAllowed ? "no-user-gesture-required" : "document-user-activation-required"}`],
    });
    try {
      const page = await browser.newPage({ baseURL });
      if (!autoplayAllowed) await page.addInitScript(() => {
        // Make denial deterministic: installed Edge policies can override
        // command-line autoplay flags. Only the policy is simulated; after
        // a trusted gesture the original media implementation plays the MP3.
        let interacted = false;
        for (const type of ["click", "keydown"]) {
          document.addEventListener(type, event => {
            if (event.isTrusted) interacted = true;
          }, true);
        }
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          if (this instanceof HTMLAudioElement && !interacted) {
            return Promise.reject(new DOMException("A gesture is required", "NotAllowedError"));
          }
          return play.call(this);
        };
      });
      await providePage(page);
    } finally {
      await browser.close();
    }
  },
});

const music = 'audio[src="/audio/good-morning-new-yorkers.mp3"]';

test.describe("entrance music with browser autoplay restrictions", () => {

  test("ordinary interaction starts blocked music; mute survives interaction and reload", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && /hydration|hydrated/i.test(message.text())) errors.push(message.text());
    });
    await page.goto("/");
    await expect(page.locator(music)).toBeAttached();
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    expect(await page.locator(music).evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await expect(page.getByRole("button", { name: /Enter with sound|Stay muted/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    await expect.poll(() => page.locator(music).evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
    await page.getByRole("button", { name: "Mute all audio", exact: true }).click();
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    expect(await page.locator(music).evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    expect(await page.locator(music).evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await page.getByRole("button", { name: "Unmute all audio", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("ordinary interaction unlocks audio before application scripts load without an entry prompt", async ({ page }) => {
    let release!: () => void;
    const scriptsReady = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/_next\/.*\.js(?:\?|$)/, async route => {
      await scriptsReady;
      await route.continue();
    });
    try {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto("/", { waitUntil: "commit" });
      await expect(page.locator(music)).toBeAttached();
      await expect(page.locator("#paper-sound-entry")).toHaveCount(0);
      await page.mouse.click(180, 300);
      await expect.poll(() => page.locator(music).evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
    } finally {
      release();
    }
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
  });

  test("keyboard entry starts music and the controls fit a small viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    await expect(page.locator(music)).toBeAttached();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    await expect.poll(() => page.locator(music).evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
    const bounds = await page.locator(".explore-tools").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    await page.screenshot({ path: "artifacts/media/entrance-music-mobile.png" });
  });
});

test.describe("entrance music when autoplay is allowed", () => {
  test.use({ autoplayAllowed: true });

  test("starts automatically while application scripts are still downloading", async ({ page }) => {
    let release!: () => void;
    const scriptsReady = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/_next\/.*\.js(?:\?|$)/, async route => {
      await scriptsReady;
      await route.continue();
    });
    try {
      await page.goto("/", { waitUntil: "commit" });
      await expect.poll(() => page.locator(music).evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
      await expect(page.getByRole("button", { name: "Enter with sound" })).toBeHidden();
    } finally {
      release();
    }
  });

  test("plays on arrival and responds to tab visibility without losing mute", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    await expect.poll(() => page.locator(music).evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
    // Headless pages do not reliably become hidden; dispatch the browser's
    // visibility signal while retaining real media playback throughout.
    const visibility = async (hidden: boolean) => page.evaluate(value => {
      Object.defineProperty(document, "hidden", { configurable: true, value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
    await visibility(true);
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    expect(await page.locator(music).evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await visibility(false);
    await expect(page.getByRole("button", { name: "Mute all audio", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mute all audio", exact: true }).click();
    await visibility(true);
    await visibility(false);
    expect(await page.locator(music).evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  });
});
