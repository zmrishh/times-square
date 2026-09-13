import DodoPayments from "dodopayments";
import { mode, origin, required } from "./config";
import { query, tx, one, job, Row } from "./db";
import {
  Order,
  PaymentEvidence,
  applyEvidence,
  adjustPayment,
} from "./auction";
export function dodo(m = mode()) {
  if (m === "simulation")
    throw new Error("Dodo is not configured in simulation.");
  return new DodoPayments({
    baseURL: null,
    bearerToken: required("DODO_PAYMENTS_API_KEY"),
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: m === "dodo-live" ? "live_mode" : "test_mode",
    maxRetries: 0,
    timeout: 20000,
  });
}
export async function startCheckout(orderId: string) {
  const o = await tx(async (db) => {
    const o = await one<Order>(db, "SELECT * FROM orders WHERE id=$1", [
      orderId,
    ]);
    if (o.state !== "reserved") return null;
    await db.query("UPDATE orders SET state='initializing' WHERE id=$1", [
      orderId,
    ]);
    return o;
  });
  if (!o)
    return (
      await query<Order>("SELECT * FROM orders WHERE id=$1", [orderId])
    )[0];
  try {
    if (o.mode === "simulation") {
      await query(
        "UPDATE orders SET state=CASE WHEN state='initializing' THEN 'checkout' ELSE state END,session_id=$2,checkout_url=$3 WHERE id=$1",
        [o.id, `sim_${o.id}`, `/?checkout=${o.id}`],
      );
    } else {
      const base = origin();
      const session = await dodo(o.mode).checkoutSessions.create({
        product_cart: [
          { product_id: o.product_id, quantity: 1, amount: o.due },
        ],
        customer: { email: o.customer_email },
        billing_currency: "USD",
        allowed_payment_method_types: ["credit", "debit"],
        feature_flags: {
          allow_currency_selection: false,
          allow_discount_code: false,
          allow_customer_editing_email: false,
        },
        metadata: {
          order_id: o.id,
          slot_id: o.slot_id,
          creative_id: o.creative_id,
          environment: o.mode,
        },
        return_url: `${base}/?checkout=${o.id}`,
        cancel_url: `${base}/?checkout=${o.id}`,
      });
      if (!session.checkout_url)
        throw new Error("Provider did not return a checkout URL.");
      await query(
        "UPDATE orders SET state=CASE WHEN state='initializing' THEN 'checkout' ELSE state END,session_id=$2,checkout_url=$3 WHERE id=$1",
        [o.id, session.session_id, session.checkout_url],
      );
    }
  } catch {
    await tx(async (db) => {
      await db.query("UPDATE orders SET state='ambiguous' WHERE id=$1 AND state='initializing'", [o.id]);
      await job(db, `ambiguous:${o.id}`, "reconcile", { orderId: o.id });
    });
    throw new Error(
      "Checkout creation is being reconciled. Do not retry payment; check your dashboard.",
    );
  }
  return (await query<Order>("SELECT * FROM orders WHERE id=$1", [orderId]))[0];
}
export async function fetchEvidence(
  paymentId: string,
  m: string,
): Promise<PaymentEvidence> {
  const client = dodo(m);
  const p = await client.payments.retrieve(paymentId);
  // Failed attempts need no allocation evidence; some providers have no line items yet.
  const lines = p.status === "succeeded"
    ? await client.payments.retrieveLineItems(paymentId)
    : { items: [], currency: p.currency };
  const tax = p.tax || 0;
  const principal = p.total_amount - tax;
  const cart = p.product_cart || [];
  const item = lines.items[0];
  const cartValid =
    cart.length === 1 &&
    lines.items.length === 1 &&
    item.items_id === cart[0].product_id &&
    lines.currency === "USD" &&
    item.tax === tax &&
    (item.amount === principal || item.amount === p.total_amount) &&
    !p.discount_id &&
    !p.discounts?.length &&
    !p.subscription_id;
  const refunds = p.refunds.filter((r) => r.status === "succeeded");
  if (refunds.some((r) => !Number.isSafeInteger(r.amount) || r.amount! < 0))
    throw new Error(
      "Confirmed refund has no valid amount; provider reconciliation required.",
    );
  const refundedCash = refunds.reduce((sum, r) => sum + r.amount!, 0);
  // Launch operator actions only request full refunds. For an external partial refund,
  // conservatively withhold up to the refunded gross from eligible principal: refunded
  // money must never support rank. Exact principal/tax attribution goes to operator review.
  const principalRefund = Math.min(principal, refundedCash);
  const disputed = p.disputes.some(
    (d) => !["dispute_won", "dispute_cancelled"].includes(d.dispute_status),
  );
  return {
    id: p.payment_id,
    orderId: String(p.metadata.order_id || ""),
    sessionId: p.checkout_session_id || null,
    mode: m,
    businessId: p.business_id,
    productId: cartValid ? cart[0].product_id : "INVALID",
    quantity: cartValid ? cart[0].quantity : 0,
    email: p.customer.email,
    customerId: p.customer.customer_id,
    principal,
    tax,
    cash: p.total_amount,
    currency: p.currency,
    status: p.status || "",
    refundedPrincipal: principalRefund,
    refundedCash,
    disputed,
    raw: { payment: p, lines },
  };
}
export async function reconcilePayment(paymentId: string, m: string) {
  const e = await fetchEvidence(paymentId, m);
  if (e.status === "failed" || e.status === "cancelled") {
    const raw = e.raw as { payment: { error_code?: string | null } };
    // Bind failures to the same merchant/session/customer as successful evidence.
    // Keep the reservation until cutoff: a later authenticated success can still settle.
    await query(
      `UPDATE orders SET state='failed',failure_code=$2 WHERE id=$1
       AND mode=$3 AND business_id=$4 AND customer_email=$5 AND session_id=$6
       AND reserved=true AND state IN ('reserved','initializing','checkout','ambiguous','failed')`,
      [e.orderId, raw.payment.error_code?.slice(0, 100) || "PAYMENT_FAILED", m, e.businessId, e.email, e.sessionId],
    );
  }
  await applyEvidence(e);
  if (e.status === "succeeded") {
    await adjustPayment(e.id, e.refundedPrincipal, e.refundedCash, e.disputed);
    await query("UPDATE payments SET last_reconciled_at=now() WHERE id=$1", [
      paymentId,
    ]);
    const raw = e.raw as {
      payment: { disputes: { dispute_id: string; dispute_status: string }[] };
    };
    for (const d of raw.payment.disputes)
      await query(
        "INSERT INTO disputes(id,payment_id,status,payload) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET status=$3,payload=$4,updated_at=now()",
        [d.dispute_id, paymentId, d.dispute_status, JSON.stringify(d)],
      );
    if (
      e.refundedCash > 0 &&
      e.refundedCash < e.cash &&
      !(
        await query(
          "SELECT payment_id FROM refund_attributions WHERE payment_id=$1 AND refunded_cash=$2",
          [paymentId, e.refundedCash],
        )
      ).length
    )
      await tx((db) =>
        job(
          db,
          `partial-review:${paymentId}:${e.refundedCash}`,
          "operator-review",
          {
            paymentId,
            reason:
              "External partial refund: conservative principal withholding; reconcile exact tax attribution.",
          },
        ),
      );
  }
}
export async function reconcileOrder(orderId: string) {
  const o = (
    await query<Order>("SELECT * FROM orders WHERE id=$1", [orderId])
  )[0];
  if (!o) return;
  if (o.mode === "simulation") {
    if (o.reserved && new Date(o.cutoff_at).getTime() < Date.now())
      await query(
        "UPDATE orders SET state='expired',reserved=false WHERE id=$1 AND reserved=true",
        [o.id],
      );
    return;
  }
  const client = dodo(o.mode);
  if (o.session_id) {
    const status = await client.checkoutSessions.retrieve(o.session_id);
    if (status.payment_id) await reconcilePayment(status.payment_id, o.mode);
  } else {
    let scanned = 0;
    for await (const p of client.payments.list({
      created_at_gte: new Date(o.created_at).toISOString(),
      product_id: o.product_id,
    })) {
      if (++scanned > 500)
        throw new Error(
          "Ambiguous checkout scan exceeded 500 payments; operator review required.",
        );
      const full = await client.payments.retrieve(p.payment_id);
      if (full.metadata.order_id === o.id) {
        if (full.checkout_session_id)
          await query(
            "UPDATE orders SET session_id=$2 WHERE id=$1 AND session_id IS NULL",
            [o.id, full.checkout_session_id],
          );
        await reconcilePayment(p.payment_id, o.mode);
      }
    }
  }
  // Provider was successfully consulted. Payments arriving after this cutoff are refunded.
  if (new Date(o.cutoff_at).getTime() < Date.now())
    await query(
      "UPDATE orders SET state='expired',reserved=false WHERE id=$1 AND reserved=true",
      [o.id],
    );
  await query("UPDATE orders SET last_reconciled_at=now() WHERE id=$1", [o.id]);
}
export async function simulatePayment(orderId: string, accountId: string) {
  if (mode() !== "simulation" || process.env.NODE_ENV === "production")
    throw new Error("Simulation unavailable.");
  const o = (
    await query<Order>("SELECT * FROM orders WHERE id=$1 AND account_id=$2", [
      orderId,
      accountId,
    ])
  )[0];
  if (!o || !o.session_id) throw new Error("Checkout unavailable.");
  const evidence: PaymentEvidence = {
    id: `sim_pay_${o.id}`,
    orderId: o.id,
    sessionId: o.session_id,
    mode: "simulation",
    businessId: "local",
    productId: o.product_id,
    quantity: 1,
    email: o.customer_email,
    customerId: `sim_customer_${o.account_id}`,
    principal: o.due,
    tax: 0,
    cash: o.due,
    currency: "USD",
    status: "succeeded",
    refundedCash: 0,
    refundedPrincipal: 0,
    disputed: false,
    raw: { simulation: true, orderId: o.id },
  };
  return applyEvidence(evidence);
}
export async function processRefund(refundId: string) {
  const r = (
    await query<
      Row & {
        id: string;
        payment_id: string;
        provider_id: string | null;
        state: string;
        reason: string;
        mode: string;
        principal: number;
        cash: number;
      }
    >(
      "SELECT r.*,o.mode,p.principal,p.cash FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN orders o ON o.id=p.order_id WHERE r.id=$1",
      [refundId],
    )
  )[0];
  if (!r) return;
  if (r.state === "succeeded") {
    // The previous worker may have died after recording the refund but before
    // updating allocations. A retry must finish that reconciliation.
    if (r.mode !== "simulation") await reconcilePayment(r.payment_id, r.mode);
    return;
  }
  if (r.mode === "simulation") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Simulation unavailable");
    await adjustPayment(r.payment_id, r.principal, r.cash, false);
    await query(
      "UPDATE refunds SET state='succeeded',amount=$2,provider_id=$3,updated_at=now() WHERE id=$1",
      [r.id, r.cash, `sim_ref_${r.id}`],
    );
    return;
  }
  const client = dodo(r.mode);
  let existing = r.provider_id
    ? await client.refunds.retrieve(r.provider_id)
    : null;
  if (!existing) {
    const p = await client.payments.retrieve(r.payment_id);
    for (const ref of p.refunds) {
      const detail = await client.refunds.retrieve(ref.refund_id);
      if (detail.metadata.refund_intent_id === r.id) {
        existing = detail;
        break;
      }
    }
    if (!existing && r.state !== "queued") {
      await query(
        "UPDATE refunds SET state='ambiguous',updated_at=now() WHERE id=$1",
        [r.id],
      );
      throw new Error(
        "Refund outcome is ambiguous. Reconcile in Dodo before any retry.",
      );
    }
    if (!existing) {
      const claimed = await query(
        "UPDATE refunds SET state='sending',updated_at=now() WHERE id=$1 AND state='queued' RETURNING id",
        [r.id],
      );
      if (!claimed.length)
        throw new Error(
          "Refund request already claimed; reconcile before retrying.",
        );
      try {
        existing = await client.refunds.create({
          payment_id: r.payment_id,
          reason: r.reason,
          metadata: { refund_intent_id: r.id },
        });
      } catch {
        await query(
          "UPDATE refunds SET state='ambiguous',updated_at=now() WHERE id=$1",
          [r.id],
        );
        throw new Error(
          "Refund request timed out or failed: reconcile before retrying.",
        );
      }
    }
  }
  await query(
    "UPDATE refunds SET provider_id=$2,state=$3,amount=$4,updated_at=now() WHERE id=$1",
    [r.id, existing.refund_id, existing.status, existing.amount || null],
  );
  await reconcilePayment(r.payment_id, r.mode);
  if (existing.status === "failed")
    throw new Error("Provider refund failed. Operator intervention required.");
}
