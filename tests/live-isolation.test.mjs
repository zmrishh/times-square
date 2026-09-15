import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { provisionLiveSchema } from '../scripts/provision-live-environment.mjs';
import { databaseSchema, inDatabaseSchema } from '../src/server/database-schema.mjs';

test('live schema preserves test records, isolates transactions and survives repeat provisioning', async () => {
  const pg = new PGlite();
  const db = { query: async (sql, params) => params ? pg.query(sql, params) : (await pg.exec(sql)).at(-1) };
  const seedCreative = `INSERT INTO brands(id,account_id,name) VALUES('brand','owner','Fixture');
    INSERT INTO creatives(id,brand_id,data,status) VALUES('creative','brand','{}','approved');`;
  const order = mode => `INSERT INTO orders(id,account_id,brand_id,creative_id,slot_id,slot_version,existing,target,due,rules,mode,product_id,business_id,customer_email,expires_at,cutoff_at)
    VALUES('order','owner','brand','creative','tsq-016',1,0,100,100,'{}','${mode}','fixture-product','fixture-business','owner@example.com',now()+interval '10 minutes',now()+interval '12 minutes')`;
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    for (const file of (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort()) await pg.exec(await readFile(`migrations/${file}`, 'utf8'));
    await pg.exec(`INSERT INTO accounts(id,email,role) VALUES('owner','owner@example.com','admin'); ${seedCreative} ${order('dodo-test')}; CREATE TABLE only_in_test(id text);`);
    const provisioned = await provisionLiveSchema(db);
    assert.equal(provisioned.created, true);
    assert.equal(provisioned.sourcePreserved, true);
    assert.equal(provisioned.crossSchemaForeignKeys, 0);
    assert.equal(provisioned.counts.orders, 0);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n, 1);
    assert.equal((await pg.query("SELECT has_schema_privilege('anon','paper_live','USAGE') AS allowed")).rows[0].allowed, false);
    assert.equal((await pg.query("SELECT has_schema_privilege('authenticated','paper_live','USAGE') AS allowed")).rows[0].allowed, false);
    const noRls = await pg.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='paper_live' AND c.relkind='r' AND NOT c.relrowsecurity");
    assert.deepEqual(noRls.rows, []);
    await inDatabaseSchema(db, 'paper_live', async c => {
      assert.equal((await c.query('SELECT current_schema() AS name')).rows[0].name, 'paper_live');
      await c.query(seedCreative);
    });
    assert.equal((await pg.query('SELECT current_schema() AS name')).rows[0].name, 'public');
    await assert.rejects(inDatabaseSchema(db, 'paper_live', c => c.query(order('dodo-test'))), /live_orders_only/);
    await assert.rejects(inDatabaseSchema(db, 'paper_live', c => c.query('SELECT * FROM only_in_test')), /does not exist/);
    assert.equal((await pg.query('SELECT current_schema() AS name')).rows[0].name, 'public');
    await inDatabaseSchema(db, 'paper_live', c => c.query(order('dodo-live')));
    assert.equal((await inDatabaseSchema(db, 'paper_live', c => c.query('SELECT mode FROM orders'))).rows[0].mode, 'dodo-live');
    assert.equal((await inDatabaseSchema(db, 'public', c => c.query('SELECT mode FROM orders'))).rows[0].mode, 'dodo-test');
    const repeated = await provisionLiveSchema(db);
    assert.equal(repeated.created, false);
    assert.equal(repeated.counts.orders, 1);
    assert.equal(repeated.sourcePreserved, true);
    assert.equal(databaseSchema('dodo-live'), 'paper_live');
    assert.equal(databaseSchema('dodo-test'), 'public');
    await assert.rejects(inDatabaseSchema(db, 'public; DROP SCHEMA paper_live CASCADE', async () => {}), /Invalid/);
  } finally { await pg.close(); }
});
