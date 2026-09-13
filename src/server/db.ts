import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { SLOTS } from "../lib/registry";
import { mode, validateProduction } from "./config";
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
    store = {
      db: pool,
      close: () => pool.end(),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const result = await fn(c);
          await c.query("COMMIT");
          return result;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
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
  // Automatic migrations are local only. Production migration is an explicit deployment step.
  if (!process.env.DATABASE_URL) {
    for (const file of (await readdir(path.join(process.cwd(), "migrations")))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await (store.db as PGlite).exec(
        await readFile(path.join(process.cwd(), "migrations", file), "utf8"),
      );
  }
  if (process.env.NODE_ENV === "production") {
    const configured = mode();
    const foreign = await store.db.query(
      "SELECT id FROM orders WHERE mode<>$1 LIMIT 1",
      [configured],
    );
    if (foreign.rows.length) {
      await store.close();
      throw new Error(
        "PAYMENT_MODE differs from existing orders. Use a separate database for live and test environments.",
      );
    }
  }
  for (const s of SLOTS)
    await store.db.query(
      "INSERT INTO slots(id,opening) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [s.id, s.opening],
    );
  return store;
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
