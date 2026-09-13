import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyVideoRelease } from '../scripts/release-video-migration.mjs';

test('release migration preserves existing inventory, repeats safely and retains broader private storage allowances', async () => {
  const pg = new PGlite();
  try {
    for (const file of (await readdir('migrations')).filter(f => f.endsWith('.sql') && f < '008').sort()) await pg.exec(await readFile(`migrations/${file}`, 'utf8'));
    await pg.exec("CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); INSERT INTO storage.buckets VALUES('paper-assets','paper-assets',false,70000000,ARRAY['image/webp','image/png']); INSERT INTO slots(id,opening) VALUES('release-existing',5000);");
    const db = { query: async (sql, params) => params ? pg.query(sql, params) : (await pg.exec(sql)).at(-1) };
    const first = await applyVideoRelease(db);
    assert.equal(first.preserved.slots > 0, true);
    assert.deepEqual(await applyVideoRelease(db), first);
    const bucket = (await pg.query('SELECT * FROM storage.buckets')).rows[0];
    assert.equal(Number(bucket.file_size_limit), 70000000);
    assert.equal(bucket.public, false);
    assert.ok(bucket.allowed_mime_types.includes('image/png'));
    assert.ok(bucket.allowed_mime_types.includes('video/mp4'));
    assert.equal((await pg.query("SELECT opening FROM slots WHERE id='release-existing'")).rows[0].opening, 5000);
  } finally { await pg.close(); }
});
