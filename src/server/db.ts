import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { SLOTS } from "../lib/registry";
import { mode, validateProduction } from "./config";
import { databaseSchema, inDatabaseSchema } from "./database-schema.mjs";
export type Row = Record<string, unknown>;
export interface DB {
  query<T extends Row = Row>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
type Store = {
  db: DB;
  close: () => Promise<void>;
  transaction: <T>(fn: (db: DB) => Promise<T>) => Promise<T>;
};
const globalDB = globalThis as typeof globalThis & { paperDB?: Promise<Store> };
async function init(): Promise<Store> {
  validateProduction();
  const schema = databaseSchema(process.env.PAYMENT_MODE);
  let store: Store;
  if (process.env.DATABASE_URL) {
    const max = Number(process.env.DATABASE_POOL_MAX || 8);
    if (!Number.isInteger(max) || max < 1 || max > 20)
      throw new Error("Invalid DATABASE_POOL_MAX. Use 1–20 connections.");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    });
    // pg removes failed idle clients itself; without a listener an idle
    // network failure is emitted as an unhandled process error.
    pool.on("error", () =>
      console.warn("Database idle connection closed; the pool will reconnect."),
    );
    const transaction: Store["transaction"] = async (fn) => {
        const c = await pool.connect();
        try {
          return await inDatabaseSchema(c, schema, fn);
        } finally {
          c.release();
        }
    };
    store = {
      db: schema === 'public' ? pool : { query: (sql, params) => transaction(c => c.query(sql, params)) },
      close: () => pool.end(),
      transaction,
    };
  } else {
    if (process.env.NODE_ENV === "production")
      throw new Error("DATABASE_URL is required in production.");
    const dir =
      process.env.PAPER_DATA_DIR ||
      path.join(process.cwd(), ".data", "postgres");
    if (dir !== ":memory:") await mkdir(dir, { recursive: true });
    const p = new PGlite(dir === ":memory:" ? undefined : dir);
    await p.waitReady;
    store = {
      db: p,
      close: () => p.close(),
      transaction: (fn) => p.transaction((tx) => fn(tx)),
    };
  }
  try {
    // Automatic migrations are local only. Production migration is an explicit deployment step.
    if (!process.env.DATABASE_URL) {
      if (schema !== 'public') throw new Error('Live mode requires a hosted database');
      for (const file of (await readdir(path.join(process.cwd(), "migrations")))
        .filter((f) => f.endsWith(".sql"))
        .sort())
        await (store.db as PGlite).exec(
          await readFile(path.join(process.cwd(), "migrations", file), "utf8"),
        );
    }
    if (process.env.NODE_ENV === "production") {
      const configured = mode();
      if (schema === 'paper_live') {
        const binding = await store.db.query("SELECT value->>'mode' AS mode FROM settings WHERE id='environment'");
        if (binding.rows[0]?.mode !== 'dodo-live') throw new Error('Live database has not been provisioned');
      }
      const foreign = await store.db.query(
        "SELECT id FROM orders WHERE mode<>$1 LIMIT 1",
        [configured],
      );
      if (foreign.rows.length) {
        throw new Error(
          "PAYMENT_MODE differs from existing orders. Live and test records must be isolated.",
        );
      }
    }
    // One round trip on cold start instead of 72 sequential inserts. Existing
    // inventory, prices and ownership are preserved by ON CONFLICT DO NOTHING.
    await store.db.query(
      `INSERT INTO slots(id,opening) VALUES ${SLOTS.map((_, index) => `($${index * 2 + 1},$${index * 2 + 2})`).join(",")} ON CONFLICT DO NOTHING`,
      SLOTS.flatMap((slot) => [slot.id, slot.opening]),
    );
    return store;
  } catch (error) {
    // A failed initialization must not leave a pool behind before retrying.
    await store.close().catch(() => {});
    throw error;
  }
}
export async function database() {
  globalDB.paperDB ??= init().catch((e) => {
    globalDB.paperDB = undefined;
    throw e;
  });
  return globalDB.paperDB;
}
export async function closeDatabase() {
  if (globalDB.paperDB) await (await globalDB.paperDB).close();
  globalDB.paperDB = undefined;
}
export async function query<T extends Row = Row>(
  sql: string,
  p: unknown[] = [],
) {
  return (await (await database()).db.query<T>(sql, p)).rows;
}
export async function tx<T>(fn: (db: DB) => Promise<T>) {
  return (await database()).transaction(async (db) => {
    await db.query("SELECT id FROM settings WHERE id='global' FOR UPDATE");
    return fn(db);
  });
}
export async function one<T extends Row = Row>(
  db: DB,
  sql: string,
  p: unknown[] = [],
) {
  return (await db.query<T>(sql, p)).rows[0];
}
export const id = () => crypto.randomUUID();
export async function job(db: DB, key: string, kind: string, payload: unknown) {
  await db.query(
    "INSERT INTO jobs(id,kind,payload) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    [key, kind, JSON.stringify(payload)],
  );
}
export async function audit(
  db: DB,
  actor: string | null,
  action: string,
  target: string,
  details: unknown = {},
) {
  await db.query(
    "INSERT INTO audit(id,actor,action,target,details) VALUES ($1,$2,$3,$4,$5)",
    [id(), actor, action, target, JSON.stringify(details)],
  );
}
