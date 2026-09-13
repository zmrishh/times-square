// Creates ONE disposable checkout using the isolated app's Dodo TEST adapter.
import {request,expect} from "@playwright/test";
import {writeFile,access} from "node:fs/promises";
import {EMPTY_CREATIVE} from "../src/lib/registry.ts";
const saved=".data/audit-real-session.json";
try {await access(saved);throw new Error("An audit checkout already exists; reuse its saved session instead of creating another.");} catch(e) {if(e.code!=="ENOENT")throw e;}
const baseURL="http://127.0.0.1:3000",origin="https://paper-audit.example";
const a=await request.newContext({baseURL,extraHTTPHeaders:{Origin:origin}});
const operator=await request.newContext({baseURL,extraHTTPHeaders:{Origin:origin}});
async function post(c,path,data){const r=await c.post(`/api/${path}`,{data});const b=await r.json();expect(r.ok(),`${path}: ${JSON.stringify(b)}`).toBe(true);return b;}
async function login(c,email){const sent=await post(c,"auth/send",{email});expect(sent.localCode).toBeTruthy();await post(c,"auth/verify",{email,code:sent.localCode});}
try {
  const snap=await (await a.get("/api/public")).json();expect(snap.mode).toBe("dodo-test");
  // A clean isolated registry has no real/customer leaders.
  expect(snap.slots.every(s=>!s.brandId)).toBe(true);
  await login(operator,"operator@paper.local");
  await post(operator,"admin/inventory",{slotId:"tsq-070",available:true,opening:100});
  await login(a,`paper-square-audit-${Date.now()}@example.com`);
  const creative=await post(a,"creatives",{creative:{...EMPTY_CREATIVE,name:"Disposable QA test",url:"https://example.com",headline:"TEST INVENTORY ONLY"}});
  const order=await post(a,"checkout",{slotId:"tsq-070",creativeId:creative.creativeId,accepted:true});
  expect(order.mode).toBe("dodo-test");expect(order.due).toBe(100);
  await writeFile(saved,JSON.stringify({order,advertiser:await a.storageState(),operator:await operator.storageState()},null,2));
  console.log(JSON.stringify({orderId:order.id,state:order.state,mode:order.mode,due:order.due}));
}finally{await a.dispose();await operator.dispose();}
