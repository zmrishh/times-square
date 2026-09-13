import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

const protectedTables = ['slots', 'orders', 'payments', 'brands', 'creatives', 'assets', 'allocations', 'totals'];
async function fingerprint(db) {
  const result = {};
  for (const table of protectedTables) {
    const row = (await db.query(`SELECT count(*)::text AS count,
      md5(COALESCE(string_agg((to_jsonb(t)-'video_fee'-'fallback_creative_id')::text, '' ORDER BY (to_jsonb(t)-'video_fee'-'fallback_creative_id')::text),'')) AS digest FROM ${table} t`)).rows[0];
    result[table] = row;
  }
  return result;
}

export async function applyVideoRelease(db, bucket = 'paper-assets') {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='10s'");
    await db.query("SET LOCAL statement_timeout='30s'");
    await db.query(`LOCK TABLE ${protectedTables.join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const before = await fingerprint(db);
    await db.query(await readFile('migrations/008_video_premium.sql', 'utf8'));
    await db.query(`INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      VALUES($1,$1,false,50000000,ARRAY['image/webp','video/mp4'])
      ON CONFLICT(id) DO UPDATE SET public=false,
      file_size_limit=CASE WHEN storage.buckets.file_size_limit IS NULL THEN NULL ELSE GREATEST(storage.buckets.file_size_limit,50000000) END,
      allowed_mime_types=CASE WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL ELSE
      ARRAY(SELECT DISTINCT mime FROM unnest(storage.buckets.allowed_mime_types || ARRAY['image/webp','video/mp4']) AS mime) END`, [bucket]);
    const after = await fingerprint(db);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Commercial records changed during migration');
    const storage = (await db.query('SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id=$1', [bucket])).rows[0];
    if (!storage || storage.public || (storage.file_size_limit !== null && Number(storage.file_size_limit) < 50000000) || (storage.allowed_mime_types !== null && !storage.allowed_mime_types.includes('video/mp4'))) throw new Error('Storage verification failed');
    await db.query('SELECT video_fee FROM orders LIMIT 0');
    await db.query('SELECT fallback_creative_id FROM totals LIMIT 0');
    await db.query('SELECT poster_id FROM media_uploads LIMIT 0');
    await db.query('COMMIT');
    return { migration: '008_video_premium', preserved: Object.fromEntries(Object.entries(before).map(([name, value]) => [name, Number(value.count)])), privateBucket: true, videoLimitAtLeast50MB: true };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (process.env.PAPER_APPLY_VIDEO_UPGRADE !== '1') {
    console.log('Video migration not requested; normal build.');
    return;
  }
  if (process.env.VERCEL_ENV !== 'production' || !process.env.DATABASE_URL || process.env.APP_ORIGIN !== 'https://newyorkcity-kappa.vercel.app') throw new Error('Release environment verification failed');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
  try {
    const client = await pool.connect();
    try { console.log(JSON.stringify(await applyVideoRelease(client, process.env.SUPABASE_STORAGE_BUCKET || 'paper-assets'))); }
    finally { client.release(); }
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Database errors can contain customer data or connection details.
    console.error('Video migration failed; deployment stopped. Database error code:', /^[A-Z0-9]{5}$/.test(error.code || '') ? error.code : 'RELEASE_CHECK_FAILED');
    process.exitCode = 1;
  });
}
