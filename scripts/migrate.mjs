import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL required for deployment migrations. Local embedded PostgreSQL migrates automatically.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pool.query(await readFile(`migrations/${file}`, "utf8"));
    console.log(`${file} applied.`);
  }
} finally {
  await pool.end();
}
