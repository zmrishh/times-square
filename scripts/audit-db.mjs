// Disposable PostgreSQL-wire fixture. Never points at customer data.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes, createHash } from "node:crypto";
const dir = ".data/audit-production";
await mkdir(dir,{recursive:true});
const db = await PGlite.create(dir);
for(const file of (await readdir("migrations")).filter(f=>f.endsWith(".sql")).sort())
  await db.exec(await readFile(`migrations/${file}`,"utf8"));
const sessions = {};
for(const key of ["advertiser","admin","advertiserB","expired"]) {
  const role = key === "admin" ? "admin" : "advertiser";
  const account = randomUUID(), token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO accounts(id,email,role) VALUES($1,$2,$3)",[account,`${account}@audit.example`,role]);
  await db.query("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+$3*interval '1 day')",[createHash("sha256").update(token).digest("hex"),account,key === "expired" ? -1 : 1]);
  sessions[key] = token;
}
await writeFile(".data/audit-production-sessions.json",JSON.stringify(sessions));
const server = new PGLiteSocketServer({db,host:"127.0.0.1",port:54329,maxConnections:8});
await server.start();
console.log("Isolated audit PostgreSQL-wire fixture ready on 127.0.0.1:54329; fixture sessions are private.");
async function stop() { await server.stop(); await db.close(); process.exit(0); }
process.on("SIGINT",stop);
process.on("SIGTERM",stop);
