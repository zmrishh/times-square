import { query } from "./db";

export async function financialReport() {
  // All-time live cash is separate from eligible principal, taxes and test fixtures.
  const rows = await query(`SELECT
    COALESCE(SUM(p.cash),0)::text AS collected_cash,
    COALESCE(SUM(p.tax),0)::text AS collected_tax,
    COALESCE(SUM(p.refunded_cash),0)::text AS refunded_cash,
    COALESCE(SUM(CASE WHEN p.disputed THEN 0 ELSE COALESCE(a.amount,0) END),0)::text AS applied_principal,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=p.id AND r.state<>'succeeded')
      THEN p.cash-p.refunded_cash ELSE 0 END),0)::text AS refund_liability
    FROM payments p JOIN orders o ON o.id=p.order_id
    LEFT JOIN allocations a ON a.payment_id=p.id WHERE o.mode='dodo-live'`);
  return Object.fromEntries(
    Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]),
  );
}
