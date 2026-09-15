// Read-only provider/ledger verification. Never logs customer or payment IDs.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import DodoPayments from 'dodopayments';

async function main() {
  const env = {};
  for (const file of ['.env.local', '.env.production', '.env.dodo-live', '.env.supabase-admin']) {
    try { for (const [key, value] of Object.entries(parseEnv(await readFile(file, 'utf8')))) if (value) env[key] = value; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const project = new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const db = { async query(query) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Object.assign(new Error('Database read failed'), { status: response.status });
    return { rows: await response.json() };
  } };
  const client = new DodoPayments({ bearerToken: env.DODO_PAYMENTS_API_KEY, environment: 'live_mode', baseURL: null, maxRetries: 0, timeout: 20000 });
  {
    const orders = (await db.query(`SELECT o.id,o.slot_id,o.state,o.session_id,o.due,o.product_id,o.business_id,
      p.id AS payment_id,p.principal,p.tax,p.cash,
      EXISTS(SELECT 1 FROM paper_live.allocations a WHERE a.payment_id=p.id) AS allocated,
      EXISTS(SELECT 1 FROM paper_live.history h WHERE h.payment_id=p.id) AS delivered_history
      FROM paper_live.orders o JOIN paper_live.payments p ON p.order_id=o.id
      WHERE o.mode='dodo-live' AND o.state='delivered' ORDER BY o.created_at DESC LIMIT 5`)).rows;
    const events = (await db.query(`SELECT kind,count(*)::int AS received,count(*) FILTER(WHERE processed_at IS NOT NULL)::int AS processed
      FROM paper_live.webhook_events WHERE kind LIKE 'payment.%' GROUP BY kind ORDER BY kind`)).rows;
    const verified = [];
    for (const order of orders) {
      const [payment, checkout] = await Promise.all([client.payments.retrieve(order.payment_id), client.checkoutSessions.retrieve(order.session_id)]);
      const checks = {
        providerSucceeded: payment.status === 'succeeded', checkoutSucceeded: checkout.payment_status === 'succeeded',
        checkoutMatches: checkout.payment_id === order.payment_id && payment.checkout_session_id === order.session_id,
        orderMatches: payment.metadata.order_id === order.id && payment.metadata.environment === 'dodo-live',
        merchantMatches: payment.business_id === order.business_id,
        productMatches: payment.product_cart?.length === 1 && payment.product_cart[0].product_id === order.product_id,
        amountMatches: payment.currency === 'USD' && payment.total_amount === order.cash && order.principal === order.due,
        taxMatches: (payment.tax || 0) === order.tax, allocated: order.allocated, displayed: order.delivered_history,
      };
      verified.push({ slot: order.slot_id, checks });
    }
    const snapshot = await (await fetch('https://newyorkcity-kappa.vercel.app/api/public')).json();
    const report = { checkedAt: new Date().toISOString(), mode: snapshot.mode, paused: snapshot.paused,
      minimumAvailableOpening: Math.min(...snapshot.slots.filter(s => s.available && !s.brandId).map(s => s.opening)),
      verified, paymentEvents: events, newChargesCreated: 0, refundsCreated: 0,
      scope: 'Existing live checkout and payment status matched to delivered ledger entries. Bank payout and separate merchant approval correspondence were not checked.' };
    await mkdir('artifacts/audit', { recursive: true });
    await writeFile('artifacts/audit/live-payment-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (snapshot.mode !== 'dodo-live' || !verified.length || verified.some(v => Object.values(v.checks).some(value => !value)))
      throw new Error('Live payment evidence did not pass all checks');
  }
}
main().catch(error => { console.error('Live payment verification failed:', error.name, error.code || error.status || 'CHECK_FAILED'); process.exitCode = 1; });
