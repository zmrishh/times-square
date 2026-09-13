// Read-only, bounded provider evidence. Outputs no keys, customers or card data.
import DodoPayments from "dodopayments";
import {writeFile} from "node:fs/promises";
if(process.env.PAYMENT_MODE!=="dodo-test") throw new Error("Audit provider reads require dodo-test.");
const client=new DodoPayments({baseURL:null,bearerToken:process.env.DODO_PAYMENTS_API_KEY,environment:"test_mode",maxRetries:0,timeout:15000});
const payments=[];
for await(const entry of client.payments.list({page_size:10})) {
  const p=await client.payments.retrieve(entry.payment_id);
  payments.push({id:p.payment_id,status:p.status,errorCode:p.error_code,currency:p.currency,cash:p.total_amount,tax:p.tax,createdAt:p.created_at,refundStatuses:p.refunds.map(r=>r.status)});
  if(payments.length>=6) break;
}
await writeFile("artifacts/audit/dodo-read-only.json",JSON.stringify({date:new Date().toISOString(),mode:"real Dodo test API; read-only",payments},null,2));
console.log(JSON.stringify({checked:payments.length,statuses:payments.map(p=>({status:p.status,error:p.errorCode}))}));
