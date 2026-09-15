import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { database, closeDatabase } from "../src/server/db";
import { isDatabaseUnavailable } from "../src/server/errors";

test("failed initialization closes its pool; retry batches inventory in one request", async (t) => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
  let attempts = 0,
    closed = 0;
  const queries: { sql: string; params: unknown[] }[] = [];
  t.mock.method(Pool.prototype, "end", async () => {
    closed++;
  });
  t.mock.method(
    Pool.prototype,
    "query",
    async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (++attempts === 1)
        throw new Error("timeout exceeded when trying to connect");
      return { rows: [] };
    },
  );
  try {
    await assert.rejects(database(), /timeout/);
    assert.equal(closed, 1);
    await database();
    assert.equal(queries.length, 2);
    assert.equal(queries[1].params.length, 144);
    assert.match(queries[1].sql, /ON CONFLICT DO NOTHING/);
    assert.equal(
      isDatabaseUnavailable(
        new Error("timeout exceeded when trying to connect"),
      ),
      true,
    );
    assert.equal(isDatabaseUnavailable(new Error("Invalid purchase")), false);
  } finally {
    await closeDatabase();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
