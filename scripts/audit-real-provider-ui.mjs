import {chromium,request,expect} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
async function run() {
let session=JSON.parse(await readFile(".data/audit-real-session.json","utf8"));
const browser=await chromium.launch({channel:"msedge",headless:true});
try {
 const api=await request.newContext({baseURL:"http://127.0.0.1:3000",extraHTTPHeaders:{Origin:"https://paper-audit.example"},storageState:session.advertiser});
 const post=async(c,path,data)=>{const r=await c.post(`/api/${path}`,{data});const b=await r.json();expect(r.ok(),`${path}: ${JSON.stringify(b)}`).toBe(true);return b;};
 if(process.argv.includes("--retry-expired")) {
   const existing=await readFile(".data/audit-real-retry-session.json","utf8").catch(()=>null);
   if(existing) session=JSON.parse(existing);
   else {
     const old=await post(api,"checkout/status",{orderId:session.order.id});expect(old.state).toBe("expired");
     const me=await (await api.get("/api/me")).json();
     const order=await post(api,"checkout",{slotId:"tsq-070",creativeId:me.brands[0].creative_id,accepted:true});
     expect(order.due).toBe(100);expect(order.mode).toBe("dodo-test");
     session={...session,order};await writeFile(".data/audit-real-retry-session.json",JSON.stringify(session));
   }
 }
 const url=new URL(session.order.url);
 if(!url.hostname.startsWith("test.") || !url.hostname.endsWith("dodopayments.com")) throw new Error("Refusing a non-test checkout host.");
 const page=await browser.newPage({viewport:{width:1366,height:960}});
 await page.route("https://paper-audit.example/**",async route=>{const response=await route.fetch({url:route.request().url().replace("https://paper-audit.example","http://127.0.0.1:3000")});await route.fulfill({response});});
 await page.goto(url.href,{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(3000);
 if((process.argv.includes("--billing") || process.argv.includes("--pay")) && await page.locator('select[name="country"]').isVisible()) {
   await page.locator('[name="fullName"]').fill("Paper Square QA Test");
   await page.locator('select[name="country"]').selectOption("US");
   const manual=page.getByRole("button",{name:"Enter address manually"});
   if(await manual.isVisible()) await manual.click();
   await page.locator('input[name="addressLine"]').fill("123 Test Street");
   await page.locator('[name="city"]').fill("New York");
   await page.locator('[name="zipCode"]').fill("10001");
   const state=page.locator('[name="state"]');
   if(await state.evaluate(e=>e.tagName)==="SELECT") await state.selectOption("NY");
   else await state.fill("NY");
   await page.getByRole("button",{name:"Continue to Payment",exact:true}).click();
   await page.waitForTimeout(4000);
 }
 if(process.argv.includes("--pay")) {
   const state=await post(api,"checkout/status",{orderId:session.order.id});
   expect(new Date(state.cutoff_at).getTime()-Date.now()).toBeGreaterThan(60000);
   const found={};
   for(const frame of page.frames()) {
     for(const input of await frame.locator("input").all()) {
       if(!await input.isVisible())continue;
       const key=await input.evaluate(n=>[n.name,n.id,n.placeholder,n.autocomplete,n.getAttribute("aria-label")].join(" "));
       if(/card.?number|cc-number|1234.?1234/i.test(key)) {await input.fill("4242424242424242");found.number=true;}
       else if(/MM.*YY|card.?expiry|cc-exp|expiration/i.test(key)) {await input.fill("06/32");found.expiry=true;}
       else if(/CVC|CVV|security.?code|cc-csc/i.test(key)) {await input.fill("123");found.cvv=true;}
       else if(/card.?holder|cc-name|name.?on.?card/i.test(key)) await input.fill("Paper Square QA Test");
     }
   }
   expect(found).toEqual({number:true,expiry:true,cvv:true});
   await page.getByRole("button",{name:"Pay now",exact:true}).click();
   await page.waitForTimeout(6000);
   await api.post("/api/jobs",{headers:{Authorization:"Bearer local-worker-only"}});
   const settled=await post(api,"checkout/status",{orderId:session.order.id});
   const me=await (await api.get("/api/me")).json();
   const order=me.orders.find(o=>o.id===session.order.id);
   const result={mode:"REAL Dodo test API and hosted checkout; official test card only",orderId:session.order.id,status:settled.state,paymentId:order?.payment_id,principal:order?.principal,cash:order?.cash,tax:order?.tax};
   await writeFile("artifacts/audit/real-dodo-exercise.json",JSON.stringify(result,null,2));
   expect(settled.state).toBe("delivered");expect(order.principal).toBe(100);
   const operator=await request.newContext({baseURL:"http://127.0.0.1:3000",extraHTTPHeaders:{Origin:"https://paper-audit.example"},storageState:session.operator});
   await post(operator,"admin/refund",{paymentId:order.payment_id,reason:"Disposable production-readiness QA test completed"});
   await operator.post("/api/jobs",{headers:{Authorization:"Bearer local-worker-only"}});
   result.refundState=(await post(api,"checkout/status",{orderId:session.order.id})).state;
   const management=await (await operator.get("/api/admin")).json();
   result.refund=management.payments.find(p=>p.id===order.payment_id)?.refund_state;
   await writeFile("artifacts/audit/real-dodo-exercise.json",JSON.stringify(result,null,2));
   console.log(JSON.stringify(result));
   await operator.dispose();await api.dispose();
   return;
 }
 await page.screenshot({path:"artifacts/audit/real-dodo-test-checkout.png"});
 const controls=await page.locator("input,select,button").evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,type:n.getAttribute("type"),name:n.getAttribute("name"),id:n.id,placeholder:n.getAttribute("placeholder"),label:n.getAttribute("aria-label"),text:n.tagName==="BUTTON"?n.textContent?.trim():undefined})));
 console.log(JSON.stringify(controls,null,2));
 console.log("FRAMES",JSON.stringify(page.frames().map(f=>({name:f.name(),host:new URL(f.url()||"about:blank").hostname}))));
 for(const frame of page.frames()) {
   const inputs=await frame.locator("input").evaluateAll(nodes=>nodes.map(n=>({type:n.type,name:n.name,id:n.id,placeholder:n.placeholder,label:n.getAttribute("aria-label")}))).catch(()=>[]);
   if(inputs.length) console.log(JSON.stringify({frame:new URL(frame.url()||"about:blank").hostname,inputs}));
 }
 await writeFile(".data/audit-real-checkout-controls.json",JSON.stringify(controls));
}finally{await browser.close();}
}
await run();
