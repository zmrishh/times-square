import { DB, Row, tx, one, id, job, audit } from "./db";
import { Account, rate } from "./auth";
import { mode, required } from "./config";
import { RULES, quoteAmount } from "../lib/rules";
export type Order = Row & {
  id: string;
  account_id: string;
  brand_id: string;
  creative_id: string;
  slot_id: string;
  slot_version: number;
  existing: number;
  target: number;
  due: number;
  mode: string;
  product_id: string;
  business_id: string;
  customer_id: string | null;
  customer_email: string;
  state: string;
  session_id: string | null;
  checkout_url: string | null;
  reserved: boolean;
  expires_at: Date;
  cutoff_at: Date;
  created_at: Date;
};
export type PaymentEvidence = {
  id: string;
  orderId: string;
  sessionId: string | null;
  mode: string;
  businessId: string;
  productId: string;
  quantity: number;
  email: string;
  customerId: string;
  principal: number;
  tax: number;
  cash: number;
  currency: string;
  status: string;
  refundedPrincipal: number;
  refundedCash: number;
  disputed: boolean;
  raw: unknown;
};
export async function reserve(
  a: Account,
  creativeId: string,
  slotId: string,
  target?: number,
) {
  const paymentMode = mode();
  return tx(async (db) => {
    const current = await one<{ suspended: boolean }>(
      db,
      "SELECT suspended FROM accounts WHERE id=$1",
      [a.id],
    );
    if (!current || current.suspended)
      throw new Error("Account suspended or unavailable.");
    const config = await one<{ value: { paused: boolean; preset: string } }>(
      db,
      "SELECT value FROM settings WHERE id='global'",
    );
    if (config.value.paused)
      throw new Error("New checkouts are temporarily paused.");
    const creative = await one<{
      brand_id: string;
      status: string;
      account_id: string;
      suspended: boolean;
    }>(
      db,
      "SELECT c.brand_id,c.status,b.account_id,b.suspended FROM creatives c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1",
      [creativeId],
    );
    if (!creative || creative.account_id !== a.id || creative.suspended)
      throw new Error("You do not own an eligible brand.");
    if (creative.status !== "approved")
      throw new Error(
        "Save a valid creative before payment; this version is unavailable.",
      );
    const s = await one<{
      version: number;
      opening: number;
      leader_brand: string;
      available: boolean;
    }>(db, "SELECT * FROM slots WHERE id=$1", [slotId]);
    if (!s || !s.available) throw new Error("This placement is unavailable.");
    if (s.leader_brand === creative.brand_id)
      throw new Error(
        "You already lead this billboard. Edit your creative instead.",
      );
    const active = await one<Order>(
      db,
      "SELECT * FROM orders WHERE slot_id=$1 AND reserved=true",
      [slotId],
    );
    if (active) {
      if (active.account_id === a.id && active.creative_id === creativeId)
        return active;
      throw new Error(
        "Another advertiser is checking out. Please try again after reconciliation.",
      );
    }
    await rate(db, `reservation:${a.id}`, 3, 1800);
    const leader = await one<{ amount: number }>(
      db,
      "SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2",
      [slotId, s.leader_brand],
    );
    const existing = await one<{ amount: number }>(
      db,
      "SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2",
      [slotId, creative.brand_id],
    );
    const quote = quoteAmount(
      leader?.amount || 0,
      existing?.amount || 0,
      s.opening,
      target,
      config.value.preset,
    );
    const orderId = id();
    await db.query(
      `INSERT INTO orders(id,account_id,brand_id,creative_id,slot_id,slot_version,existing,target,due,rules,mode,product_id,business_id,customer_email,expires_at,cutoff_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        orderId,
        a.id,
        creative.brand_id,
        creativeId,
        slotId,
        s.version,
        quote.existing,
        quote.target,
        quote.due,
        JSON.stringify({ ...RULES, ...quote }),
        paymentMode,
        paymentMode === "simulation"
          ? "simulation-product"
          : required("DODO_PRODUCT_ID"),
        paymentMode === "simulation" ? "local" : required("DODO_BUSINESS_ID"),
        a.email,
        new Date(Date.now() + RULES.reservationMs),
        new Date(Date.now() + RULES.reservationMs + RULES.graceMs),
      ],
    );
    await audit(db, a.id, "quote.created", orderId, quote);
    await job(db, `reconcile:${orderId}`, "reconcile", { orderId });
    return one<Order>(db, "SELECT * FROM orders WHERE id=$1", [orderId]);
  });
}
export async function publish(db: DB, slotId: string) {
  await db.query(
    "UPDATE settings SET value=jsonb_set(value,'{version}',to_jsonb((value->>'version')::integer+1)) WHERE id='global'",
  );
  await job(db, `public:${id()}`, "public", { slotId });
}
export async function recompute(
  db: DB,
  slotId: string,
  kind: string,
  paymentId: string | null = null,
) {
  await db.query(
    `UPDATE totals t SET amount=COALESCE((SELECT SUM(a.amount) FROM allocations a JOIN payments p ON p.id=a.payment_id WHERE a.slot_id=t.slot_id AND a.brand_id=t.brand_id AND p.disputed=false),0) WHERE t.slot_id=$1`,
    [slotId],
  );
  const winner = await one<{
    brand_id: string;
    creative_id: string;
    amount: number;
  }>(
    db,
    `SELECT t.brand_id,t.creative_id,t.amount FROM totals t JOIN brands b ON b.id=t.brand_id JOIN accounts a ON a.id=b.account_id JOIN creatives c ON c.id=t.creative_id WHERE t.slot_id=$1 AND t.amount>0 AND NOT b.suspended AND NOT a.suspended AND c.status='approved' ORDER BY t.amount DESC,t.updated_at ASC,t.brand_id ASC LIMIT 1`,
    [slotId],
  );
  const s = await one<{
    leader_brand: string | null;
    creative_id: string | null;
    available: boolean;
  }>(db, "SELECT leader_brand,creative_id,available FROM slots WHERE id=$1", [
    slotId,
  ]);
  const w = s.available ? winner : undefined;
  // Artwork becomes public only when attached to a paid, displayed placement.
  if (w) {
    await db.query(
      `UPDATE assets SET public=true WHERE id IN (SELECT split_part(c.data->>'logo','/',4) FROM creatives c WHERE c.id=$1 UNION SELECT split_part(c.data->>'image','/',4) FROM creatives c WHERE c.id=$1)`,
      [w.creative_id],
    );
  }
  if (
    s.leader_brand !== (w?.brand_id || null) ||
    s.creative_id !== (w?.creative_id || null) ||
    kind === "takeover"
  ) {
    await db.query(
      "UPDATE history SET ended_at=now() WHERE slot_id=$1 AND ended_at IS NULL",
      [slotId],
    );
    await db.query(
      "UPDATE slots SET leader_brand=$2,creative_id=$3,version=version+1 WHERE id=$1",
      [slotId, w?.brand_id || null, w?.creative_id || null],
    );
    if (w)
      await db.query(
        "INSERT INTO history(id,slot_id,brand_id,creative_id,payment_id,total,kind) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id(), slotId, w.brand_id, w.creative_id, paymentId, w.amount, kind],
      );
  } else
    await db.query("UPDATE slots SET version=version+1 WHERE id=$1", [slotId]);
  await publish(db, slotId);
}
export function evidenceMatches(o: Order, e: PaymentEvidence) {
  return (
    e.status === "succeeded" &&
    e.orderId === o.id &&
    e.sessionId === o.session_id &&
    e.mode === o.mode &&
    e.businessId === o.business_id &&
    e.productId === o.product_id &&
    e.quantity === 1 &&
    e.email.toLowerCase() === o.customer_email.toLowerCase() &&
    (!o.customer_id || e.customerId === o.customer_id) &&
    e.currency === "USD" &&
    e.principal === o.due &&
    Number.isSafeInteger(e.tax) &&
    e.tax >= 0 &&
    e.cash === e.principal + e.tax
  );
}
export async function refundIntent(
  db: DB,
  paymentId: string,
  reason: string,
  actor: string | null = null,
) {
  const existing = await one(
    db,
    "SELECT id FROM refunds WHERE payment_id=$1 AND state IN ('queued','sending','pending','ambiguous','review')",
    [paymentId],
  );
  if (existing) return;
  const payment = await one<{ cash: number; refunded_cash: number }>(db,
    "SELECT cash,refunded_cash FROM payments WHERE id=$1", [paymentId]);
  if (!payment || payment.refunded_cash >= payment.cash)
    throw new Error("Payment unavailable or already fully refunded.");
  const rid = id();
  await db.query(
    "INSERT INTO refunds(id,payment_id,state,reason) VALUES($1,$2,'queued',$3)",
    [rid, paymentId, reason],
  );
  await job(db, `refund:${rid}`, "refund", { refundId: rid });
  await audit(db, actor, "refund.requested", paymentId, { reason });
}
export async function applyEvidence(e: PaymentEvidence) {
  if (e.status !== "succeeded") return;
  return tx(async (db) => {
    const o = await one<Order>(db, "SELECT * FROM orders WHERE id=$1", [
      e.orderId,
    ]);
    if (!o)
      throw new Error(
        "Unmatched provider payment: operator reconciliation required.",
      );
    // Authenticated provider evidence can beat the checkout-create response.
    // Bind its session only after all other immutable quote fields match.
    if (!o.session_id && e.sessionId && ["initializing", "ambiguous"].includes(o.state)
      && evidenceMatches({ ...o, session_id: e.sessionId }, e)) {
      await db.query("UPDATE orders SET session_id=$2 WHERE id=$1", [o.id, e.sessionId]);
      o.session_id = e.sessionId;
    }
    const existing = await one<{ order_id: string }>(
      db,
      "SELECT order_id FROM payments WHERE id=$1",
      [e.id],
    );
    if (existing) {
      if (existing.order_id !== o.id)
        throw new Error("Payment identity conflict.");
      return;
    }
    if (
      !Number.isSafeInteger(e.cash) ||
      e.cash < 0 ||
      !Number.isSafeInteger(e.principal) ||
      e.principal < 0 ||
      !Number.isSafeInteger(e.tax) ||
      e.tax < 0
    )
      throw new Error("Invalid provider money fields.");
    const s = await one<{ version: number; available: boolean }>(
      db,
      "SELECT version,available FROM slots WHERE id=$1",
      [o.slot_id],
    );
    const c = await one<{ status: string; suspended: boolean }>(
      db,
      "SELECT c.status,(b.suspended OR a.suspended) AS suspended FROM creatives c JOIN brands b ON b.id=c.brand_id JOIN accounts a ON a.id=b.account_id WHERE c.id=$1",
      [o.creative_id],
    );
    const prior = await one(db, "SELECT id FROM payments WHERE order_id=$1", [
      o.id,
    ]);
    const valid =
      evidenceMatches(o, e) &&
      o.reserved &&
      new Date(o.cutoff_at).getTime() >= Date.now() &&
      s.version === o.slot_version &&
      s.available &&
      c.status === "approved" &&
      !c.suspended &&
      !prior &&
      !e.disputed &&
      e.refundedCash === 0;
    await db.query(
      `INSERT INTO payments(id,order_id,principal,tax,cash,state,evidence,disputed) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        e.id,
        o.id,
        e.principal,
        e.tax,
        e.cash,
        valid ? "applied" : "undelivered",
        JSON.stringify(e.raw),
        e.disputed,
      ],
    );
    if (valid) {
      await db.query("UPDATE orders SET customer_id=$2 WHERE id=$1", [
        o.id,
        e.customerId,
      ]);
      await db.query(
        "INSERT INTO allocations(payment_id,slot_id,brand_id,amount) VALUES($1,$2,$3,$4)",
        [e.id, o.slot_id, o.brand_id, o.due],
      );
      await db.query(
        "INSERT INTO totals(slot_id,brand_id,amount,creative_id) VALUES($1,$2,$3,$4) ON CONFLICT(slot_id,brand_id) DO UPDATE SET creative_id=$4,updated_at=now()",
        [o.slot_id, o.brand_id, 0, o.creative_id],
      );
      await recompute(db, o.slot_id, "takeover", e.id);
      await audit(db, null, "payment.applied", e.id, {
        orderId: o.id,
        principal: o.due,
      });
    } else {
      await refundIntent(
        db,
        e.id,
        "Undelivered placement: stale, mismatched, refunded, or superseded checkout.",
      );
    }
    // A second charge against the same order must not overwrite the delivered first charge.
    if (!prior)
      await db.query("UPDATE orders SET state=$2,reserved=false WHERE id=$1", [
        o.id,
        valid ? "delivered" : "refund_pending",
      ]);
    return { delivered: valid };
  });
}
export async function adjustPayment(
  paymentId: string,
  refundedPrincipal: number,
  refundedCash: number,
  disputed: boolean,
) {
  return tx(async (db) => {
    const p = await one<{
      principal: number;
      cash: number;
      refunded: number;
      refunded_cash: number;
      order_id: string;
      disputed: boolean;
    }>(db, "SELECT * FROM payments WHERE id=$1", [paymentId]);
    if (!p) return;
    if (
      !Number.isSafeInteger(refundedPrincipal) ||
      !Number.isSafeInteger(refundedCash) ||
      refundedPrincipal < 0 ||
      refundedCash < 0 ||
      refundedPrincipal > p.principal ||
      refundedCash > p.cash
    )
      throw new Error("Refund reconciliation exceeds payment.");
    const cash = Math.max(p.refunded_cash, refundedCash);
    const attribution = await one<{ refunded_principal: number }>(
      db,
      "SELECT refunded_principal FROM refund_attributions WHERE payment_id=$1 AND refunded_cash=$2",
      [paymentId, cash],
    );
    const principal = attribution
      ? attribution.refunded_principal
      : Math.max(p.refunded, refundedPrincipal);
    if (
      principal === p.refunded &&
      cash === p.refunded_cash &&
      disputed === p.disputed
    )
      return;
    await db.query(
      "UPDATE payments SET refunded=$2,refunded_cash=$3,disputed=$4,state=CASE WHEN $3=cash THEN 'refunded' WHEN $4 THEN 'disputed' WHEN state='disputed' THEN CASE WHEN EXISTS (SELECT 1 FROM allocations WHERE payment_id=$1) THEN 'applied' ELSE 'undelivered' END ELSE state END WHERE id=$1",
      [paymentId, principal, cash, disputed],
    );
    await db.query("UPDATE allocations SET amount=$2 WHERE payment_id=$1", [
      paymentId,
      p.principal - principal,
    ]);
    const o = await one<Order>(db, "SELECT * FROM orders WHERE id=$1", [
      p.order_id,
    ]);
    if (cash === p.cash)
      await db.query(
        "UPDATE orders SET state='refunded' WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id=$1 AND id<>$2 AND state='applied')",
        [o.id, paymentId],
      );
    await recompute(db, o.slot_id, disputed ? "dispute" : "refund");
    await audit(db, null, "payment.adjusted", paymentId, {
      principal,
      cash,
      disputed,
    });
  });
}
