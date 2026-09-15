import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { databaseSchema, inDatabaseSchema } from '../src/server/database-schema.mjs';
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL required for deployment migrations. Local embedded PostgreSQL migrates automatically.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const client = await pool.connect();
  try { await inDatabaseSchema(client, databaseSchema(process.env.PAYMENT_MODE), async db => {
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.query(await readFile(`migrations/${file}`, "utf8"));
    console.log(`${file} applied.`);
  }
  }); } finally { client.release(); }
} finally {
  await pool.end();
}
