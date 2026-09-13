import test, { after, mock } from "node:test";
import assert from "node:assert/strict";
import { Payments } from "dodopayments/resources/payments";
import { CheckoutSessions } from "dodopayments/resources/checkout-sessions";
import { query, tx, id, closeDatabase } from "../src/server/db";
import { reserve, applyEvidence, refundIntent, type PaymentEvidence, type Order } from "../src/server/auction";
import { startCheckout, reconcilePayment, processRefund } from "../src/server/payments";
import { submitCreative } from "../src/server/content";
import { rate, type Account } from "../src/server/auth";
import { RateLimitError } from "../src/server/errors";
import { EMPTY_CREATIVE } from "../src/lib/registry";

process.env.PAPER_DATA_DIR = ":memory:";
process.env.PAYMENT_MODE = "dodo-test";
process.env.DODO_PAYMENTS_API_KEY = "audit-mocked-key";
process.env.DODO_PRODUCT_ID = "audit-product";
process.env.DODO_BUSINESS_ID = "audit-business";
process.env.APP_ORIGIN = "http://localhost:3001";
after(async () => { mock.restoreAll(); await closeDatabase(); });

async function fixture(slot: string) {
  const a: Account = { id: id(), email: `${id()}@audit.example`, role: "advertiser", suspended: false };
  await query("INSERT INTO accounts(id,email,role) VALUES($1,$2,$3)", [a.id,a.email,a.role]);
  const c = await submitCreative(a, {...EMPTY_CREATIVE, name:"Audit brand",url:"https://audit.example"});
  return reserve(a,c.creativeId,slot);
}

test("rate limits return a bounded, actionable cooldown", async () => {
  await tx(db => rate(db,"audit-rate",1,60));
  await assert.rejects(() => tx(db => rate(db,"audit-rate",1,60)), e =>
    e instanceof RateLimitError && e.retryAfter > 0 && e.retryAfter <= 60);
});

test("checkout creation cannot overwrite settlement received during provider request", async () => {
  const o = await fixture("tsq-061");
  const session = `audit-session-${o.id}`;
  const stub = mock.method(CheckoutSessions.prototype,"create",async () => {
    const e: PaymentEvidence = {
      id:`audit-pay-${o.id}`,orderId:o.id,sessionId:session,mode:o.mode,
      businessId:o.business_id,productId:o.product_id,quantity:1,email:o.customer_email,
      customerId:"audit-customer",principal:o.due,tax:0,cash:o.due,currency:"USD",
      status:"succeeded",refundedPrincipal:0,refundedCash:0,disputed:false,raw:{audit:true},
    };
    await applyEvidence(e);
    return {session_id:session, checkout_url:"https://test.checkout.dodopayments.com/audit"};
  });
  try {
    const result = await startCheckout(o.id);
    assert.equal(result.state,"delivered");
    assert.equal(result.reserved,false);
    assert.equal((await query("SELECT * FROM allocations WHERE payment_id=$1",[`audit-pay-${o.id}`])).length,1);
  } finally { stub.mock.restore(); }
});

test("terminal failure is visible, remains reserved, and cannot regress delivery", async () => {
  const o = await fixture("tsq-062");
  const session = `audit-session-${o.id}`;
  await query("UPDATE orders SET state='checkout',session_id=$2 WHERE id=$1",[o.id,session]);
  const stub = mock.method(Payments.prototype,"retrieve",async () => ({
    payment_id:`audit-failed-${o.id}`,metadata:{order_id:o.id},checkout_session_id:session,
    business_id:o.business_id,product_cart:[],tax:0,total_amount:o.due,currency:"USD",
    status:"failed",error_code:"DO_NOT_HONOR",refunds:[],disputes:[],
    customer:{email:o.customer_email,customer_id:"audit-customer"},
  }));
  const lines = mock.method(Payments.prototype,"retrieveLineItems",async () => { throw new Error("No line items for failed payment"); });
  try {
    await reconcilePayment(`audit-failed-${o.id}`,o.mode);
    const failed = (await query("SELECT state,reserved,failure_code FROM orders WHERE id=$1",[o.id]))[0];
    assert.deepEqual(failed,{state:"failed",reserved:true,failure_code:"DO_NOT_HONOR"});
    assert.equal(lines.mock.callCount(),0);
    await query("UPDATE orders SET state='delivered',reserved=false WHERE id=$1",[o.id]);
    await reconcilePayment(`audit-failed-${o.id}`,o.mode);
    assert.equal((await query("SELECT state FROM orders WHERE id=$1",[o.id]))[0].state,"delivered");
  } finally { stub.mock.restore(); lines.mock.restore(); }
});

function evidence(o: Order): PaymentEvidence {
  return {id:`audit-pay-${o.id}`,orderId:o.id,sessionId:o.session_id,mode:o.mode,businessId:o.business_id,
    productId:o.product_id,quantity:1,email:o.customer_email,customerId:"audit-customer",principal:o.due,
    cash:o.due,tax:0,currency:"USD",status:"succeeded",refundedPrincipal:0,refundedCash:0,disputed:false,raw:{audit:true}};
}
test("database failure rolls back the whole settlement and a retry applies once",async()=> {
  const o=await fixture("tsq-063");
  o.session_id=`audit-session-${o.id}`;
  await query("UPDATE orders SET state='checkout',session_id=$2 WHERE id=$1",[o.id,o.session_id]);
  await query("CREATE FUNCTION audit_reject_allocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit injected database failure'; END $$");
  await query("CREATE TRIGGER audit_failure BEFORE INSERT ON allocations FOR EACH ROW EXECUTE FUNCTION audit_reject_allocation()");
  try {
    await assert.rejects(()=>applyEvidence(evidence(o)),/audit injected database failure/);
    assert.equal((await query("SELECT id FROM payments WHERE order_id=$1",[o.id])).length,0);
    assert.equal((await query("SELECT leader_brand FROM slots WHERE id=$1",[o.slot_id]))[0].leader_brand,null);
    assert.equal((await query("SELECT reserved FROM orders WHERE id=$1",[o.id]))[0].reserved,true);
  } finally {
    await query("DROP TRIGGER audit_failure ON allocations");
    await query("DROP FUNCTION audit_reject_allocation()");
  }
  await applyEvidence(evidence(o));
  await applyEvidence(evidence(o));
  assert.equal((await query("SELECT * FROM allocations WHERE payment_id=$1",[evidence(o).id])).length,1);
});

test("refund job retry completes accounting after a recorded provider success",async()=> {
  const o=await fixture("tsq-064");
  o.session_id=`audit-session-${o.id}`;
  await query("UPDATE orders SET state='checkout',session_id=$2 WHERE id=$1",[o.id,o.session_id]);
  const e=evidence(o);
  await applyEvidence(e);
  await tx(db=>refundIntent(db,e.id,"Audit interrupted refund"));
  const r=(await query<{id:string}>("SELECT id FROM refunds WHERE payment_id=$1",[e.id]))[0];
  await query("UPDATE refunds SET state='succeeded' WHERE id=$1",[r.id]);
  const payment=mock.method(Payments.prototype,"retrieve",async()=>({payment_id:e.id,metadata:{order_id:o.id},checkout_session_id:o.session_id,
    business_id:o.business_id,product_cart:[{product_id:o.product_id,quantity:1}],tax:0,total_amount:o.due,currency:"USD",status:"succeeded",
    refunds:[{status:"succeeded",amount:o.due}],disputes:[],customer:{email:o.customer_email,customer_id:"audit-customer"}}));
  const lines=mock.method(Payments.prototype,"retrieveLineItems",async()=>({currency:"USD",items:[{items_id:o.product_id,amount:o.due,tax:0}]}));
  try {
    await processRefund(r.id);
    assert.equal((await query("SELECT refunded_cash FROM payments WHERE id=$1",[e.id]))[0].refunded_cash,o.due);
    assert.equal((await query("SELECT amount FROM allocations WHERE payment_id=$1",[e.id]))[0].amount,0);
    await assert.rejects(()=>tx(db=>refundIntent(db,e.id,"Audit duplicate full refund")),/already fully refunded/);
  } finally {payment.mock.restore();lines.mock.restore();}
});
