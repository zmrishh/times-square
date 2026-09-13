// Isolated real Dodo test database only. Stop its web server before running.
import {PGlite} from "@electric-sql/pglite";
import {readFile,writeFile} from "node:fs/promises";
const db=await PGlite.create(".data/audit-real-dodo");
try {
  const exercise=JSON.parse(await readFile("artifacts/audit/real-dodo-exercise.json","utf8"));
  const order=(await db.query("SELECT id,slot_id,state,reserved,due FROM orders WHERE id=$1",[exercise.orderId])).rows;
  const payments=(await db.query("SELECT id,principal,tax,cash,refunded,refunded_cash,state FROM payments WHERE order_id=$1",[exercise.orderId])).rows;
  const allocations=(await db.query("SELECT payment_id,slot_id,amount FROM allocations WHERE payment_id=$1",[exercise.paymentId])).rows;
  const refunds=(await db.query("SELECT id,provider_id,state,amount FROM refunds WHERE payment_id=$1",[exercise.paymentId])).rows;
  const events=(await db.query("SELECT id,kind,received_at,processed_at FROM webhook_events ORDER BY received_at")).rows;
  const jobs=(await db.query("SELECT kind,state,count(*)::int AS count FROM jobs GROUP BY kind,state ORDER BY kind,state")).rows;
  const report={date:new Date().toISOString(),method:"Reopened isolated real Dodo test database after server stop; no original customer database opened",order,payments,allocations,refunds,events,jobs};
  await writeFile("artifacts/audit/real-dodo-ledger.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally {await db.close();}
