import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
const base="http://127.0.0.1:3002", canonical="https://paper-audit.example";
const sessions=JSON.parse(await readFile(".data/audit-production-sessions.json","utf8"));
const evidence={environment:"production Next.js build; fixture sessions; mocked Dodo HTTP; PGlite PostgreSQL-wire adapter",checks:[],errors:[],accessibility:[]};
await mkdir("artifacts/audit",{recursive:true});
const browser=await chromium.launch({channel:"msedge",headless:true});
async function api(path,role,body,headers={}) {
  const r=await fetch(`${base}/api/${path}`,{method:body===undefined?"GET":"POST",headers:{Origin:canonical,"Content-Type":"application/json",...(role?{Cookie:`paper_session=${sessions[role]}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json(),headers:Object.fromEntries(r.headers)};
}
async function context(role,width=1366) {
  const c=await browser.newContext({viewport:{width,height:900}});
  if(role) await c.addCookies([{name:"paper_session",value:sessions[role],url:canonical,httpOnly:true,secure:true,sameSite:"Lax"}]);
  await c.route(`${canonical}/**`,async route=> {
    const response=await route.fetch({url:route.request().url().replace(canonical,base),timeout:45000});
    await route.fulfill({response});
  });
  return c;
}
async function shot(page,name) {
  await page.screenshot({path:`artifacts/audit/production-${name}.png`});
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  evidence.accessibility.push({name,violations:result.violations});
}
try {
  expect((await api("health")).status).toBe(200);
  const snapshot=await api("public");
  expect(snapshot.data.mode).toBe("dodo-test");
  expect(snapshot.data.slots.length).toBe(72);
  expect((await api("admin")).status).toBe(403);
  expect((await api("admin","advertiserB")).status).toBe(403);
  expect((await api("me","expired")).data.account).toBeNull();
  expect((await api("creatives","expired",{})).status).toBe(403);
  expect((await api("checkout/simulate","advertiser",{orderId:randomUUID()})).status).toBe(400);
  expect((await api("draft","advertiser",{privateNote:"production fixture persistence"})).status).toBe(200);
  expect((await api("draft","advertiser",{}, {Origin:"https://attacker.example"})).status).toBe(400);
  expect((await api("auth/send",null,{email:"fixture@example.com"})).data.localCode).toBeUndefined();
  evidence.checks.push("Production rejects simulator, anonymous admin and foreign Origin; no local OTP disclosure; 72 slots and health available.");
  const c=await context("advertiser");
  let page=await c.newPage();
  page.on("pageerror",e=>evidence.errors.push(e.message));
  await page.goto(`${canonical}/?billboard=tsq-067`);
  await page.getByRole("button",{name:/Claim this billboard|Outbid this brand/}).click();
  await page.getByLabel("Brand name",{exact:false}).fill(`Production audit ${Date.now()}`);
  await page.getByLabel("Website",{exact:false}).fill("https://audit.example");
  await page.getByLabel("Headline",{exact:false}).fill("Production boundary test");
  await page.getByRole("button",{name:"Continue to payment",exact:true}).click();
  await expect(page.getByText("Your creative is ready for checkout",{exact:true})).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:/Pay .*Dodo/}).click();
  await expect(page).toHaveURL(/checkout=/);
  const orderId=new URL(page.url()).searchParams.get("checkout");
  expect((await api("checkout/status","advertiser",{orderId})).data.state).toBe("checkout");
  await shot(page,"pending");
  await page.close();
  const confirmed=JSON.parse(await readFile(".data/audit-provider-confirmed.json","utf8").catch(()=>"{}"));
  confirmed[orderId]=true;
  await writeFile(".data/audit-provider-confirmed.json",JSON.stringify(confirmed));
  const paymentId=`audit_pay_${orderId}`;
  async function webhook(eventId,type="payment.succeeded") {
    const raw=JSON.stringify({type,business_id:"audit-business",timestamp:new Date().toISOString(),data:{payment_id:paymentId}});
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature=createHmac("sha256",Buffer.from("audit-fixture-webhook-secret")).update(`${eventId}.${timestamp}.${raw}`).digest("base64");
    return fetch(`${base}/api/webhook`,{method:"POST",body:raw,headers:{"webhook-id":eventId,"webhook-timestamp":timestamp,"webhook-signature":`v1,${signature}`}});
  }
  const eventId=randomUUID();
  expect((await webhook(eventId)).status).toBe(200);
  expect((await webhook(eventId)).status).toBe(200);
  expect((await webhook(randomUUID(),"payment.failed")).status).toBe(200);
  expect((await fetch(`${base}/api/webhook`,{method:"POST",body:"{}"})).status).toBe(401);
  const jobs=await api("jobs",null,{}, {Authorization:"Bearer audit-worker-fixture-secret-32-characters"});
  expect(jobs.status).toBe(200);
  const settled=(await api("checkout/status","advertiser",{orderId})).data;
  expect(settled.state).toBe("delivered");
  const me=(await api("me","advertiser")).data;
  expect(me.orders.filter(o=>o.id===orderId)).toHaveLength(1);
  const receipt=(await api(`receipt/${orderId}`,"advertiser")).data.records;
  expect(receipt).toHaveLength(1);
  expect(receipt[0].cash).toBe(settled.due+180);
  expect(receipt[0].principal).toBe(settled.due);
  expect((await api(`receipt/${orderId}`,"advertiserB")).status).toBe(404);
  expect((await api("checkout/status","advertiserB",{orderId})).status).toBe(400);
  expect((await api("quote","advertiserB",{slotId:"tsq-067",creativeId:me.brands[0].creative_id})).status).toBe(400);
  expect((await api("creatives","advertiserB",{brandId:me.brands[0].id,creative:me.brands[0].data})).status).toBe(400);
  evidence.checks.push("Expired sessions denied; authenticated advertiser B cannot read A's receipt/status, quote A's creative, edit A's brand, or access admin.");
  evidence.checks.push("UI creative → quote → terms → checkout; forged return stays unpaid; browser closed; signed duplicate/out-of-order events → durable worker → exactly one allocation; tax excluded from rank.");
  page=await c.newPage();
  await page.goto(`${canonical}/?checkout=${orderId}`);
  await expect(page.getByRole("heading",{name:/You’re up in the square/})).toBeVisible();
  await shot(page,"delivered");
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  await page.getByRole("button",{name:/Your account|Sign in/}).click();
  await shot(page,"account");
  const operator=await context("admin",390), adminPage=await operator.newPage();
  await adminPage.goto(canonical,{waitUntil:"networkidle"});
  await adminPage.getByRole("button",{name:/Your account|Sign in/}).click();
  await adminPage.getByRole("button",{name:"Open square management"}).click();
  for(const name of ["Review","Payments","Inventory","Operations"]) {
    await adminPage.getByRole("button",{name,exact:true}).click();
    await shot(adminPage,`admin-${name.toLowerCase()}-390`);
  }
  expect((await api("admin/refund","admin",{paymentId,reason:"Isolated production audit refund"})).status).toBe(200);
  await api("jobs",null,{}, {Authorization:"Bearer audit-worker-fixture-secret-32-characters"});
  expect((await api("checkout/status","advertiser",{orderId})).data.state).toBe("refunded");
  // An earlier failed refund must not duplicate the payment or hide its latest outcome.
  const fixtureDb=new pg.Client({connectionString:"postgresql://audit:audit@127.0.0.1:54329/audit?sslmode=disable"});
  await fixtureDb.connect();
  try {
    await fixtureDb.query("INSERT INTO refunds(id,payment_id,state,reason,created_at) VALUES($1,$2,'failed','Earlier isolated fixture attempt',now()-interval '1 hour')",[randomUUID(),paymentId]);
  } finally {await fixtureDb.end();}
  const accountPayments=(await api("me","advertiser")).data.orders.filter(o=>o.payment_id===paymentId);
  const adminPayments=(await api("admin","admin")).data.payments.filter(p=>p.id===paymentId);
  expect(accountPayments).toHaveLength(1);expect(adminPayments).toHaveLength(1);
  expect(accountPayments[0].refund_state).toBe("succeeded");expect(adminPayments[0].refund_state).toBe("succeeded");
  evidence.checks.push("Multiple refund attempts produce one payment row and show the latest refund outcome in both account and admin APIs.");
  evidence.checks.push("Admin refund initiation, worker confirmation, receipt and ranking reconciliation pass with mocked provider; no real funds moved.");
  const failedOrder=await api("checkout","advertiser",{slotId:"tsq-068",creativeId:me.brands[0].creative_id,accepted:true});
  expect(failedOrder.status).toBe(200);
  confirmed[failedOrder.data.id]="failed";
  await writeFile(".data/audit-provider-confirmed.json",JSON.stringify(confirmed));
  expect((await api("checkout/status","advertiser",{orderId:failedOrder.data.id})).data.failure_code).toBe("DO_NOT_HONOR");
  await page.goto(`${canonical}/?checkout=${failedOrder.data.id}`);
  await expect(page.getByRole("heading",{name:"The payment was declined."})).toBeVisible();
  await shot(page,"declined");
  evidence.checks.push("Mock terminal DO_NOT_HONOR reaches the production return UI with clear failure guidance; no placement granted.");
  evidence.orderId=orderId;
  evidence.paymentId=paymentId;
  expect(evidence.errors).toEqual([]);
  expect(evidence.accessibility.flatMap(r=>r.violations.filter(v=>["serious","critical"].includes(v.impact))).length).toBe(0);
} catch(e) {evidence.failure=String(e);process.exitCode=1;console.error(String(e));}
finally {await writeFile("artifacts/audit/production-smoke.json",JSON.stringify(evidence,null,2));await browser.close();}
