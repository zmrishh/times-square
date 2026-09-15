// Read-only checks run inside Vercel, where sensitive host settings are available.
// No credentials, customer records, or payment identifiers are logged.
import pg from 'pg';
import DodoPayments from 'dodopayments';
import { databaseSchema } from '../src/server/database-schema.mjs';

export async function checkPaymentDeployment(env = process.env) {
  const required = ['DATABASE_URL', 'DODO_PAYMENTS_API_KEY', 'DODO_PAYMENTS_WEBHOOK_KEY', 'DODO_PRODUCT_ID', 'DODO_BUSINESS_ID'];
  const missing = required.filter(key => !env[key]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);
  const db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  try {
    await db.connect();
    await db.query('BEGIN READ ONLY');
    const schema = databaseSchema(env.PAYMENT_MODE);
    await db.query(`SET LOCAL search_path = ${schema}`);
    if (schema === 'paper_live') {
      const binding = (await db.query("SELECT value->>'mode' AS mode FROM settings WHERE id='environment'")).rows[0];
      if (binding?.mode !== 'dodo-live' || env.SUPABASE_STORAGE_BUCKET !== 'paper-assets-live') throw new Error('Live database or storage isolation is not configured');
    }
    const orders = (await db.query('SELECT mode, state, count(*)::int AS count FROM orders GROUP BY mode, state ORDER BY mode,state')).rows;
    const counts = (await db.query('SELECT (SELECT count(*)::int FROM payments) AS payments, (SELECT count(*)::int FROM allocations) AS allocations, (SELECT count(*)::int FROM totals) AS totals')).rows[0];
    let background = null;
    if (schema === 'paper_live') {
      const scheduled = (await db.query("SELECT active,schedule FROM cron.job WHERE jobname='paper-square-live-worker'")).rows[0];
      const lastRun = (await db.query("SELECT status,start_time,end_time FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='paper-square-live-worker') ORDER BY start_time DESC LIMIT 1")).rows[0] ?? null;
      const state = (await db.query("SELECT value->>'workerCheckedAt' AS last_checked FROM settings WHERE id='global'")).rows[0];
      const probes = (await db.query("SELECT count(*)::int AS received,count(*) FILTER(WHERE processed_at IS NOT NULL)::int AS processed FROM webhook_events WHERE kind='integration.check'")).rows[0];
      background = { scheduled, lastRun, workerLastChecked: state.last_checked, setupProbes: probes };
      if (!scheduled?.active) throw new Error('Live worker is not scheduled');
      if (env.PAPER_VERIFY_LIVE_WORKER === '1' && (!state.last_checked || Date.now()-new Date(state.last_checked).getTime()>180000 || lastRun?.status!=='succeeded' || probes.received !== probes.processed)) throw new Error('Live worker verification failed');
    }
    await db.query('ROLLBACK');
    const client = new DodoPayments({ bearerToken: env.DODO_PAYMENTS_API_KEY, baseURL: null, environment: env.PAYMENT_MODE === 'dodo-live' ? 'live_mode' : 'test_mode', maxRetries: 0, timeout: 20000 });
    const product = await client.products.retrieve(env.DODO_PRODUCT_ID);
    const report = { paymentMode: env.PAYMENT_MODE, schema, productBusinessMatches: product.business_id === env.DODO_BUSINESS_ID, orders, counts, background, foreignOrderCount: orders.filter(o => o.mode !== env.PAYMENT_MODE).reduce((sum, o) => sum + o.count, 0) };
    console.log('PAYMENT_PREFLIGHT ' + JSON.stringify(report));
    if (!report.productBusinessMatches || report.foreignOrderCount) throw new Error('Payment configuration or database mode mismatch');
    if (env.PAYMENT_MODE === 'dodo-live') await import('./provider-preflight.mjs');
    return report;
  } finally {
    await db.end();
  }
}

if (process.env.PAPER_CHECK_PAYMENT_DEPLOYMENT === '1') {
  try { await checkPaymentDeployment(); }
  catch (error) {
    console.error('Payment preflight failed:', error.name, error.code ?? error.status ?? 'CHECK_FAILED');
    process.exitCode = 1;
  }
}
