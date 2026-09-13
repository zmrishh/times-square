import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { EMPTY_CREATIVE } from "../../src/lib/registry";
const origin = process.env.PAPER_TEST_ORIGIN || "http://localhost:3001";
async function post(r: APIRequestContext, path: string, data: unknown) {
  return r.post(`/api/${path}`, {headers:{Origin:origin},data});
}
async function login(r: APIRequestContext, email: string) {
  const sent = await (await post(r,"auth/send",{email})).json();
  expect(sent.localCode).toBeTruthy();
  expect((await post(r,"auth/verify",{email,code:sent.localCode})).ok()).toBeTruthy();
}
test("account draft recovery, permission boundaries, upload removal and honest errors",async ({browser,request}) => {
  expect((await (await request.get("/api/public")).json()).mode).toBe("simulation");
  const a = await browser.newContext({baseURL:origin});
  const second = await browser.newContext({baseURL:origin});
  const stranger = await browser.newContext({baseURL:origin});
  const operator = await browser.newContext({baseURL:origin});
  const email = `audit-${Date.now()}@example.com`;
  try {
    await post(a.request,"draft",{name:"Recovered account draft",privateNote:"account A only"});
    await login(a.request,email);
    const me = await (await a.request.get("/api/me")).json();
    await login(second.request,email);
    expect((await (await second.request.get("/api/draft")).json()).data.privateNote).toBe("account A only");
    expect(await (await stranger.request.get("/api/draft")).json()).toBeNull();
    await Promise.all([post(a.request,"draft",{name:"Revision A"}),post(second.request,"draft",{name:"Revision B"})]);
    expect((await (await a.request.get("/api/draft")).json()).id).toBe((await (await second.request.get("/api/draft")).json()).id);
    const bad = await a.request.post("/api/draft",{headers:{Origin:origin,"Content-Type":"application/json"},data:Buffer.from("{broken")});
    expect(bad.status()).toBe(400);
    await login(operator.request,"operator@paper.local");
    expect((await post(operator.request,"admin/suspend",{accountId:crypto.randomUUID(),suspended:true,reason:"Audit missing account"})).status()).toBe(400);
    expect((await post(operator.request,"admin/replay",{id:"audit-missing-job"})).status()).toBe(400);
    const buffer = await sharp({create:{width:256,height:128,channels:3,background:"#f45632"}}).png().toBuffer();
    const upload = await a.request.post("/api/upload",{headers:{Origin:origin},multipart:{file:{name:"audit.png",mimeType:"image/png",buffer}}});
    expect(upload.ok()).toBeTruthy();
    const asset = (await upload.json()).url;
    expect((await stranger.request.get(asset)).status()).toBe(404);
    expect((await operator.request.get(asset)).status()).toBe(200);
    const creative = await (await post(a.request,"creatives",{creative:{...EMPTY_CREATIVE,name:"Audit upload",url:"https://audit.example",mode:"upload",image:asset}})).json();
    const price=await(await post(a.request,'quote',{creativeId:creative.creativeId,slotId:'tsq-065'})).json();
    const checkoutResponse = await post(a.request,"checkout",{creativeId:creative.creativeId,slotId:"tsq-065",accepted:true,expectedDue:price.due});
    expect(checkoutResponse.ok()).toBeTruthy();
    const checkout = await checkoutResponse.json();
    expect((await post(stranger.request,"checkout/simulate",{orderId:checkout.id})).status()).toBe(403);
    expect((await post(a.request,"checkout/simulate",{orderId:checkout.id})).ok()).toBeTruthy();
    expect((await stranger.request.get(asset)).status()).toBe(200);
    expect((await post(operator.request,"admin/suspend",{accountId:me.account.id,suspended:true,reason:"Audit prohibited content removal"})).ok()).toBeTruthy();
    expect((await stranger.request.get(asset)).status()).toBe(404);
    expect((await (await a.request.get("/api/me")).json()).account).toBeNull();
    const anon = await (await stranger.request.get("/api/me")).json();
    expect(anon.totals).toEqual([]);
    const limitedEmail = `rate-${Date.now()}@example.com`;
    for(let i=0;i<5;i++) expect((await post(stranger.request,"auth/send",{email:limitedEmail})).ok()).toBeTruthy();
    const limited = await post(stranger.request,"auth/send",{email:limitedEmail});
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  } finally {await Promise.all([a.close(),second.close(),stranger.close(),operator.close()]);}
});

for (const width of [360,390,768,1366,1920]) test(`visual and accessibility audit at ${width}px`,async ({page}) => {
  test.setTimeout(180000);
  await mkdir("artifacts/audit",{recursive:true});
  await page.setViewportSize({width,height:width<768?844:960});
  const errors: string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".scene canvas")).toHaveAttribute("data-camera",/.+/,{timeout:20000});
  await page.getByRole("button",{name:"Dismiss introduction"}).click();
  const results: unknown[]=[];
  async function capture(state: string) {
    await page.screenshot({path:`artifacts/audit/${width}-${state}.png`});
    const axe = await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    results.push({state,violations:axe.violations});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${state} page overflow`).toBe(true);
  }
  await capture("square");
  for(const name of ["Directory","Map","Rules"]) {
    if (name === "Directory") await page.getByRole("button",{name:/Get a billboard/}).click();
    else {
      await page.getByRole("button",{name:/Get a billboard/}).click();
      await page.getByRole("button",{name:name === "Rules" ? /Rules & privacy/ : "View placement map"}).click();
    }
    await capture(name.toLowerCase());
    await page.getByRole("button",{name:"Close panel",exact:true}).click();
  }
  await page.goto("/?billboard=tsq-036");
  await expect(page.locator(".placement-caption")).toBeVisible();
  await capture("wrap-detail");
  await page.getByRole("button",{name:/Claim this billboard|Outbid this brand/}).click();
  await page.getByLabel("Brand name",{exact:false}).fill("A remarkably long independent creative studio");
  await page.getByLabel("Website",{exact:false}).fill("https://an-exceptionally-long-domain-name.example/creative-campaign");
  await capture("editor");
  const image=await sharp({create:{width:256,height:128,channels:3,background:"#f45632"}}).png().toBuffer();
  const upload=page.waitForResponse(r=>r.url().endsWith("/api/upload") && r.request().method()==="POST");
  await page.getByLabel("Upload artwork",{exact:true}).setInputFiles({name:"audit-art.png",mimeType:"image/png",buffer:image});
  expect((await upload).ok()).toBeTruthy();
  await page.getByRole("button",{name:"Sign in to continue"}).click();
  await capture("auth");
  await writeFile(`artifacts/audit/${width}-accessibility.json`,JSON.stringify({errors,results},null,2));
  expect(errors).toEqual([]);
  const serious = results.flatMap(r=>(r as {violations:{impact:string}[]}).violations.filter(v=>["critical","serious"].includes(v.impact)));
  expect(serious.length,"serious/critical accessibility violations; see evidence JSON").toBe(0);
});
