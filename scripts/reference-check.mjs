import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts/references", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const log = [];
for (const [name, url] of [
  ["doodle", "https://doodleshooter.vercel.app/"],
  ["hyrox", "https://hyrox.marclou.com/"],
  ["outbid", "https://outbid.lol/"],
]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(5000);
    const text = await page.locator("body").innerText();
    log.push({ name, url, text: text.slice(0, 12000) });
    await page.screenshot({ path: `artifacts/references/${name}.png` });
    if (name === "doodle") {
      await page.getByText('START',{exact:true}).click();
      await page.waitForTimeout(1800);
      await page.keyboard.down("w");
      await page.waitForTimeout(800);
      await page.keyboard.up("w");
      await page.keyboard.press('Escape');
      await page.screenshot({
        path: "artifacts/references/doodle-controls.png",
      });
      log.push({name:'doodle-interaction',text:(await page.locator('body').innerText()).slice(0,2000)});
    }
    if(name==='hyrox'){
      await page.getByText('How it works?',{exact:true}).click();
      await page.waitForTimeout(700);
      log.push({name:'hyrox-rules-interaction',text:(await page.locator('body').innerText()).slice(0,4500)});
      await page.screenshot({path:'artifacts/references/hyrox-rules.png'});
    }
  } catch (e) {
    log.push({ name, url, error: e.message });
  } finally {
    await page.close();
  }
}
await writeFile(
  "artifacts/references/inspection.json",
  JSON.stringify(log, null, 2),
);
await browser.close();
console.log(
  log.map((x) => ({
    name: x.name,
    error: x.error,
    text: x.text?.slice(0, 1600),
  })),
);
