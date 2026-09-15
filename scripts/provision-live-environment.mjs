import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

async function sourceFingerprint(db) {
  const result = {};
  for (const table of ['accounts', 'sessions', 'drafts', 'assets', 'brands', 'creatives', 'slots', 'orders', 'payments', 'allocations', 'totals', 'history']) {
    result[table] = (await db.query(`SELECT count(*)::int AS count, md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS digest FROM public.${table} t`)).rows[0];
  }
  return result;
}

export async function provisionLiveSchema(db) {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await db.query("SET LOCAL lock_timeout='10s'");
    await db.query("SET LOCAL statement_timeout='30s'");
    const exists = (await db.query("SELECT to_regnamespace('paper_live') IS NOT NULL AS present")).rows[0].present;
    const before = await sourceFingerprint(db);
    if (!exists) {
      await db.query('CREATE SCHEMA paper_live');
      await db.query('SET LOCAL search_path = paper_live');
      for (const file of (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort()) {
        await db.query(await readFile(`migrations/${file}`, 'utf8'));
      }
      // Preserve existing identities and logins, without copying test purchases,
      // uploads, placements, or queued work into the live environment.
      await db.query('INSERT INTO accounts SELECT * FROM public.accounts');
      await db.query('INSERT INTO sessions SELECT * FROM public.sessions');
      await db.query(`INSERT INTO slots(id,opening,available) SELECT id,opening,available FROM public.slots
        ON CONFLICT(id) DO UPDATE SET opening=EXCLUDED.opening,available=EXCLUDED.available`);
      await db.query(`INSERT INTO settings(id,value) VALUES('environment','{"mode":"dodo-live","version":1}')`);
      await db.query("ALTER TABLE orders ADD CONSTRAINT live_orders_only CHECK(mode='dodo-live')");
      await db.query('REVOKE ALL ON SCHEMA paper_live FROM PUBLIC');
      await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA paper_live FROM PUBLIC');
      await db.query('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA paper_live FROM PUBLIC');
      await db.query(`DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
          REVOKE ALL ON SCHEMA paper_live FROM anon;
          REVOKE ALL ON ALL TABLES IN SCHEMA paper_live FROM anon;
        END IF;
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
          REVOKE ALL ON SCHEMA paper_live FROM authenticated;
          REVOKE ALL ON ALL TABLES IN SCHEMA paper_live FROM authenticated;
        END IF;
      END $$`);
    } else {
      await db.query('SET LOCAL search_path = paper_live');
    }
    const binding = (await db.query("SELECT value->>'mode' AS mode FROM settings WHERE id='environment'")).rows[0];
    if (binding?.mode !== 'dodo-live') throw new Error('Existing live schema has no valid environment binding');
    const foreign = (await db.query("SELECT count(*)::int AS count FROM orders WHERE mode<>'dodo-live'")).rows[0].count;
    const crossSchema = (await db.query(`SELECT count(*)::int AS count FROM pg_constraint c
      JOIN pg_class src ON src.oid=c.conrelid JOIN pg_namespace sn ON sn.oid=src.relnamespace
      JOIN pg_class dest ON dest.oid=c.confrelid JOIN pg_namespace dn ON dn.oid=dest.relnamespace
      WHERE c.contype='f' AND sn.nspname='paper_live' AND dn.nspname<>'paper_live'`)).rows[0].count;
    if (foreign || crossSchema) throw new Error('Live schema isolation failed');
    const after = await sourceFingerprint(db);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Test records changed during live provisioning');
    const counts = (await db.query('SELECT (SELECT count(*)::int FROM slots) AS slots, (SELECT count(*)::int FROM accounts) AS accounts, (SELECT count(*)::int FROM orders) AS orders')).rows[0];
    await db.query('COMMIT');
    return { created: !exists, schema: 'paper_live', sourcePreserved: true, crossSchemaForeignKeys: crossSchema, counts };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export async function provisionLiveBucket(env = process.env) {
  if (env.SUPABASE_STORAGE_BUCKET !== 'paper-assets-live') throw new Error('Dedicated live bucket required');
  const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  let result = await storage.getBucket('paper-assets-live');
  if (result.error) {
    if (!['400', '404'].includes(String(result.error.statusCode))) throw new Error('Cannot inspect live bucket');
    const created = await storage.createBucket('paper-assets-live', { public: false, fileSizeLimit: 50000000, allowedMimeTypes: ['image/webp', 'video/mp4'] });
    if (created.error) throw new Error('Cannot create live bucket');
    result = await storage.getBucket('paper-assets-live');
  }
  const bucket = result.data;
  if (result.error || !bucket || bucket.public || Number(bucket.file_size_limit) < 50000000 || !bucket.allowed_mime_types?.includes('video/mp4') || !bucket.allowed_mime_types?.includes('image/webp')) throw new Error('Live bucket configuration invalid');
  return { bucket: 'paper-assets-live', private: true, videoLimit: Number(bucket.file_size_limit) };
}

export async function provisionLiveWorker(db, env = process.env) {
  if (env.APP_ORIGIN !== 'https://newyorkcity-kappa.vercel.app' || !env.JOB_SECRET || env.JOB_SECRET.length < 32) throw new Error('Invalid live worker configuration');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions');
  const secretName = 'paper_square_live_worker';
  const secret = (await db.query('SELECT id FROM vault.secrets WHERE name=$1', [secretName])).rows[0];
  if (secret) await db.query('SELECT vault.update_secret($1::uuid,$2,$3,$4)', [secret.id, env.JOB_SECRET, secretName, 'Paper Square live worker authorization']);
  else await db.query('SELECT vault.create_secret($1,$2,$3)', [env.JOB_SECRET, secretName, 'Paper Square live worker authorization']);
  // The live-only key is rejected by the previous test deployment until promotion.
  const command = `SELECT net.http_post(
    url:='https://newyorkcity-kappa.vercel.app/api/jobs',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='paper_square_live_worker'),'X-Paper-Payment-Mode','dodo-live'),
    body:='{}'::jsonb, timeout_milliseconds:=90000)`;
  await db.query('SELECT cron.schedule($1,$2,$3)', ['paper-square-live-worker', '* * * * *', command]);
  const scheduled = (await db.query('SELECT active,schedule FROM cron.job WHERE jobname=$1', ['paper-square-live-worker'])).rows[0];
  if (!scheduled?.active || scheduled.schedule !== '* * * * *') throw new Error('Live worker schedule invalid');
  return { workerScheduled: true, schedule: scheduled.schedule, secretStoredInVault: true };
}

if (process.env.PAPER_PROVISION_LIVE === '1') {
  let db;
  try {
    if (process.env.VERCEL_ENV !== 'production' || process.env.PAYMENT_MODE !== 'dodo-live' || process.env.APP_ORIGIN !== 'https://newyorkcity-kappa.vercel.app') throw new Error('Invalid live provisioning environment');
    db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    await db.connect();
    const schema = await provisionLiveSchema(db);
    const storage = await provisionLiveBucket();
    const worker = await provisionLiveWorker(db);
    console.log('LIVE_PROVISION ' + JSON.stringify({ ...schema, ...storage, ...worker }));
  } catch (error) {
    console.error('Live provisioning failed:', error.name, error.code ?? error.status ?? 'PROVISION_FAILED');
    process.exitCode = 1;
  } finally { await db?.end(); }
}
