// Only opens the isolated copy; never opens the protected original database.
import {PGlite} from "@electric-sql/pglite";
import DodoPayments from "dodopayments";
import {writeFile} from "node:fs/promises";
if(process.env.PAYMENT_MODE!=="dodo-test") throw new Error("Test-mode reads only.");
const client=new DodoPayments({baseURL:null,bearerToken:process.env.DODO_PAYMENTS_API_KEY,environment:"test_mode",maxRetries:0,timeout:15000});
const db=await PGlite.create(".data/audit-customer-read-copy");
try {
  const p=await client.payments.retrieve("pay_0NnUvpSVuCwl9lLbYoyRm");
  const orderId=p.metadata.order_id;
  const result=await db.query(`SELECT o.id,o.slot_id,o.state,o.mode,o.due,o.target,o.session_id,p.id AS payment_id,p.cash,p.principal,p.tax,p.refunded_cash,a.amount AS allocation,s.creative_id=o.creative_id AS owns_creative
    FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN allocations a ON a.payment_id=p.id JOIN slots s ON s.id=o.slot_id WHERE o.id=$1`,[orderId]);
  const o=result.rows[0];
  const evidence={date:new Date().toISOString(),method:"Authenticated Dodo test retrieval compared with isolated copy of existing local ledger. No original database or provider mutation.",provider:{id:p.payment_id,status:p.status,currency:p.currency,cash:p.total_amount,tax:p.tax},local:result.rows,matches:!!o&&o.payment_id===p.payment_id&&o.cash===p.total_amount&&o.principal===p.total_amount-(p.tax||0)&&o.session_id===p.checkout_session_id&&o.state==="delivered"&&o.allocation===o.due};
  await writeFile("artifacts/audit/existing-dodo-payment.json",JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({providerStatus:p.status,localState:o?.state,matches:evidence.matches}));
} finally {await db.close();}
