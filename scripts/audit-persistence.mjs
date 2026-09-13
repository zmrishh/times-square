import pg from "pg";
import {createHash} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
const db=new pg.Client({connectionString:"postgresql://audit:audit@127.0.0.1:54329/audit?sslmode=disable"});
await db.connect();
const snapshot={};
try {
  for(const table of ["slots","brands","creatives","drafts","orders","payments","allocations","totals","history","refunds","webhook_events"]) {
    const result=await db.query(`SELECT * FROM ${table}`);
    const rows=result.rows.map(r=>JSON.stringify(r)).sort();
    snapshot[table]={rows:rows.length,sha256:createHash("sha256").update(JSON.stringify(rows)).digest("hex")};
  }
}finally {await db.end();}
if(process.argv.includes("--before")) {
  await writeFile("artifacts/audit/persistence-before.json",JSON.stringify(snapshot,null,2));
  console.log("Saved isolated persistent ledger snapshot.");
}else {
  const before=JSON.parse(await readFile("artifacts/audit/persistence-before.json","utf8"));
  const result={date:new Date().toISOString(),method:"Full row hashes before and after restarting isolated PostgreSQL-wire database and web server; migration replay during database restart",passed:JSON.stringify(before)===JSON.stringify(snapshot),before,after:snapshot};
  await writeFile("artifacts/audit/persistence-after.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:result.passed,tables:Object.keys(snapshot).length}));
  if(!result.passed)process.exitCode=1;
}
