// Run only while the development app is stopped: embedded Postgres has one owner.
import { PGlite } from "@electric-sql/pglite";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
if (process.env.DATABASE_URL || process.env.NODE_ENV === "production")
  throw new Error("Local embedded inventory verification only");
const db = new PGlite(".data/postgres");
await db.waitReady;
try {
  const fingerprint = async () => {
    const result = {};
    for (const table of [
      "slots",
      "brands",
      "creatives",
      "orders",
      "payments",
      "allocations",
      "totals",
      "history",
      "refunds",
    ]) {
      const { rows } = await db.query(
        `SELECT * FROM ${table} ${table === "slots" ? "WHERE id <= 'tsq-015'" : ""} ORDER BY 1,2`,
      );
      result[table] = {
        rows: rows.length,
        sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      };
    }
    return result;
  };
  const before = await fingerprint();
  const migration = await readFile(
    "migrations/006_expanded_inventory.sql",
    "utf8",
  );
  await db.transaction(async (tx) => {
    await tx.exec(migration);
    await tx.exec(migration);
  });
  const after = await fingerprint();
  assert.deepEqual(after, before);
  const { rows } = await db.query("SELECT id,opening FROM slots ORDER BY id");
  assert.equal(rows.length, 72);
  await writeFile(
    "artifacts/density/migration-verification.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        replays: 2,
        distinctSlots: rows.length,
        preserved: true,
        before,
        after,
      },
      null,
      2,
    ),
  );
  console.log(
    "72 slots; migration applied twice; all original slots and commercial record hashes unchanged.",
  );
} finally {
  await db.close();
}
