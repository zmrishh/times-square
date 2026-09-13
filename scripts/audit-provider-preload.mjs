// TEST HARNESS ONLY. The application keeps its real Dodo adapter and signed
// webhook boundary; this process intercepts test-provider HTTP with fixtures.
// Never ship this preload or set NODE_OPTIONS to it on a deployed service.
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const nativeFetch=globalThis.fetch;
const fixturePath=".data/audit-provider.json";
let queue=Promise.resolve();
globalThis.fetch=async (input,init) => {
  const req=new Request(input,init), url=new URL(req.url);
  // Isolated Supabase Storage HTTP fixture. No real credentials or bucket.
  if(url.hostname === "audit.invalid" && url.pathname.startsWith("/storage/v1/object/paper-assets")) {
    const key=url.pathname.split("/").at(-1);
    if(req.method === "DELETE") {
      const body=await req.json();
      for(const name of body.prefixes || []) if(/^[a-f0-9-]{36}\.(webp|mp4)$/.test(name))
        await unlink(`.data/audit-storage/${name}`).catch(()=>{});
      return Response.json([]);
    }
    if(!/^[a-f0-9-]{36}\.(webp|mp4)$/.test(key)) return Response.json({message:"Invalid fixture key"},{status:400});
    if(req.method === "POST") {
      await mkdir(".data/audit-storage",{recursive:true});
      await writeFile(`.data/audit-storage/${key}`,Buffer.from(await req.arrayBuffer()));
      return Response.json({Key:`paper-assets/${key}`,Id:key});
    }
    if(req.method === "GET") {
      try{return new Response(await readFile(`.data/audit-storage/${key}`),{headers:{"Content-Type":key.endsWith(".mp4")?"video/mp4":"image/webp"}});}
      catch{return Response.json({message:"Fixture object not found"},{status:404});}
    }
  }
  if(url.hostname!=="test.dodopayments.com") return nativeFetch(input,init);
  const task=queue.then(async()=> {
    let data;
    try {data=JSON.parse(await readFile(fixturePath,"utf8"));}
    catch {data={sessions:{},payments:{},refunds:{}};}
    let confirmed={};
    try {confirmed=JSON.parse(await readFile(".data/audit-provider-confirmed.json","utf8"));} catch {}
    for(const s of Object.values(data.sessions)) {
      const orderId=s.request.metadata.order_id;
      if(confirmed[orderId] && !s.payment_id) {
        const paymentId=`audit_pay_${orderId}`;
        s.payment_id=paymentId;
        const principal=s.request.product_cart[0].amount, tax=180;
        data.payments[paymentId]={payment_id:paymentId,checkout_session_id:s.session_id,
          metadata:s.request.metadata,business_id:"audit-business",status:confirmed[orderId] === "failed" ? "failed" : "succeeded",error_code:confirmed[orderId] === "failed" ? "DO_NOT_HONOR" : null,currency:"USD",
          total_amount:principal+tax,tax,product_cart:s.request.product_cart,
          customer:{email:s.request.customer.email,customer_id:`audit_customer_${orderId}`},
          refunds:[],disputes:[],created_at:new Date().toISOString()};
      }
    }
    const parts=url.pathname.split("/").filter(Boolean);
    const body=req.method==="POST"?await req.json():null;
    let result;
    if(parts[0]==="checkouts" && req.method==="POST") {
      const sid=`audit_cks_${randomUUID()}`;
      result={session_id:sid,checkout_url:`https://paper-audit.example/?checkout=${body.metadata.order_id}`,payment_id:null,request:body};
      data.sessions[sid]=result;
    } else if(parts[0]==="checkouts") result=data.sessions[parts[1]];
    else if(parts[0]==="payments" && parts[2]==="line-items") {
      const p=data.payments[parts[1]];
      result={currency:p.currency,items:[{items_id:p.product_cart[0].product_id,amount:p.total_amount-p.tax,tax:p.tax}]};
    } else if(parts[0]==="payments" && parts[1]) result=data.payments[parts[1]];
    else if(parts[0]==="payments") result={items:Object.values(data.payments)};
    else if(parts[0]==="refunds" && req.method==="POST") {
      const p=data.payments[body.payment_id];
      result={refund_id:`audit_ref_${randomUUID()}`,payment_id:p.payment_id,status:"succeeded",amount:p.total_amount,metadata:body.metadata};
      data.refunds[result.refund_id]=result;
      p.refunds.push(result);
    } else if(parts[0]==="refunds") result=data.refunds[parts[1]];
    if(!result) return Response.json({message:"Audit provider fixture not found"},{status:404});
    await writeFile(fixturePath,JSON.stringify(data));
    return Response.json(result);
  });
  queue=task.then(()=>{},()=>{});
  return task;
};
