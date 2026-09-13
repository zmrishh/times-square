import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("mobile video upload, continuous looping, wrap preview, reduced motion and private ranges",async({browser,request})=>{
  test.setTimeout(150000);
  expect((await (await request.get("/api/public")).json()).mode).toBe("simulation");
  await mkdir("artifacts/media",{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  try {
    await page.goto("http://localhost:3001/?billboard=tsq-036");
    await page.getByRole("button",{name:/Claim this billboard|Outbid this brand/}).click();
    await expect(page.getByRole("button",{name:"Template",exact:true})).toHaveCount(0);
    await expect(page.locator(".media-spec")).toContainText("aspect ratio");
    await page.getByRole("button",{name:"Looping video",exact:true}).click();
    const emptyAxe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(emptyAxe.violations.map(v=>v.id)).toEqual([]);
    const response=page.waitForResponse(r=>r.url().endsWith("/api/upload/complete")&&r.request().method()==="POST");
    await page.getByLabel("Upload video",{exact:true}).setInputFiles("tests/fixtures/loop.mp4");
    const uploaded=await response;expect(uploaded.ok()).toBeTruthy();
    const media=await uploaded.json();
    const video=page.locator(".video-art video");await video.scrollIntoViewIfNeeded();
    await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0);
    const looped=await video.evaluate(async(v:HTMLVideoElement)=>{
      let previous=v.currentTime,wrapped=false;
      for(let n=0;n<24;n++){await new Promise(r=>setTimeout(r,100));if(v.currentTime<previous-.4) wrapped=true;previous=v.currentTime;}
      return {wrapped,muted:v.muted,loop:v.loop,inline:v.playsInline};
    });
    expect(looped).toEqual({wrapped:true,muted:true,loop:true,inline:true});
    const privateRange=await context.request.get(media.url,{headers:{Range:"bytes=0-49"}});
    expect(privateRange.status()).toBe(206);expect((await privateRange.body()).length).toBe(50);
    expect((await request.get(media.url,{headers:{Range:"bytes=0-49"}})).status()).toBe(404);
    expect((await request.get(media.poster)).status()).toBe(404);
    expect((await context.request.get(media.url,{headers:{Range:"bytes=999999999-"}})).status()).toBe(416);
    expect((await context.request.get(media.url+"?size=256")).status()).toBe(400);
    await page.screenshot({path:"artifacts/media/mobile-video-editor.png"});
    const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(axe.violations.map(v=>v.id)).toEqual([]);
    await page.getByRole("button",{name:"See it on your actual billboard"}).click();
    const canvas=page.locator(".scene canvas");
    await expect.poll(async()=>JSON.parse(await canvas.getAttribute("data-videos")||"[]").filter((v:{slot:string})=>v.slot==="tsq-036").length,{timeout:20000}).toBe(2);
    await page.screenshot({path:"artifacts/media/mobile-wrap-video.png"});
    await page.emulateMedia({reducedMotion:"reduce"});
    await expect.poll(async()=>JSON.parse(await canvas.getAttribute("data-videos")||"[]").length).toBe(0);
    await page.getByRole("button",{name:"Back to editor"}).click();
    await page.reload();
    // Persisted upload is recovered through the existing draft flow.
    await page.getByRole("button",{name:"Close panel",exact:true}).click();
    expect(errors).toEqual([]);
  } finally {await context.close();}
});
