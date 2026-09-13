import { query, tx, one, job, Row } from "./db";
import { Order } from "./auction";
import { reconcileOrder, reconcilePayment, processRefund } from "./payments";
import { cleanupVideos,removeVideoKeys } from './video-uploads';
type Job = Row & {
  id: string;
  kind: string;
  payload: Record<string, string>;
  attempts: number;
};
export async function runJobs(limit = 20) {
  const started = Date.now();
  await tx(db=>job(db,`media-expiry:${Math.floor(Date.now()/3600000)}`,'media-expiry',{}));
  const due = await query<Order>(
    "SELECT * FROM orders WHERE created_at<now()-interval '20 seconds' AND ((reserved=true AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '1 minute')) OR (mode<>'simulation' AND created_at>now()-interval '30 days' AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '5 minutes'))) ORDER BY last_reconciled_at NULLS FIRST LIMIT 30",
  );
  await tx(async (db) => {
    for (const o of due)
      await job(
        db,
        `periodic:${o.id}:${Math.floor(Date.now() / 60000)}`,
        "reconcile",
        { orderId: o.id },
      );
    const refunds = await db.query<{ id: string }>(
      "SELECT id FROM refunds WHERE state IN ('pending','review','sending','ambiguous') AND updated_at<now()-interval '1 minute' LIMIT 30",
    );
    for (const r of refunds.rows)
      await job(
        db,
        `refundcheck:${r.id}:${Math.floor(Date.now() / 60000)}`,
        "refund",
        { refundId: r.id },
      );
  });
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    // Leave the remaining durable queue for the next worker request.
    if (Date.now() - started > 80000) break;
    const j = await tx((db) =>
      one<Job>(
        db,
        `UPDATE jobs SET state='running',attempts=attempts+1,leased_until=now()+interval '2 minutes' WHERE id=(SELECT id FROM jobs WHERE (state='ready' AND available_at<=now()) OR (state='running' AND leased_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`,
      ),
    );
    if (!j) break;
    try {
      if (j.kind === "operator-review") {
        await query(
          "UPDATE jobs SET state='failed',error=$2,leased_until=NULL WHERE id=$1 AND state='running' AND attempts=$3",
          [j.id, j.payload.reason || "Operator reconciliation required", j.attempts],
        );
        continue;
      }
      if(j.kind === 'media-expiry') await cleanupVideos();
      else if(j.kind === 'media-cleanup') await removeVideoKeys([`${j.payload.attempt}.mp4`,`${j.payload.attempt}.webp`]);
      else if (j.kind === "reconcile") await reconcileOrder(j.payload.orderId);
      else if (j.kind === "refund") await processRefund(j.payload.refundId);
      else if (j.kind === "event") {
        const event = (
          await query<{
            id: string;
            payload: {
              type: string;
              data: { payment_id?: string; metadata?: { order_id?: string } };
            };
          }>("SELECT id,payload FROM webhook_events WHERE id=$1", [
            j.payload.eventId,
          ])
        )[0];
        if (event) {
          const paymentId = event.payload.data.payment_id;
          if (paymentId) await reconcilePayment(paymentId, j.payload.mode);
          await query(
            "UPDATE webhook_events SET processed_at=now() WHERE id=$1",
            [event.id],
          );
        }
      }
      await query(
        "UPDATE jobs SET state='done',leased_until=NULL,error=NULL WHERE id=$1 AND state='running' AND attempts=$2",
        [j.id, j.attempts],
      );
      processed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Job processing failed";
      await query(
        "UPDATE jobs SET state=$2,error=$3,leased_until=NULL,available_at=now()+$4*interval '1 second' WHERE id=$1 AND state='running' AND attempts=$5",
        [
          j.id,
          j.attempts >= 5 ? "failed" : "ready",
          message,
          Math.min(3600, 30 * 2 ** j.attempts),
          j.attempts,
        ],
      );
    }
  }
  await query("UPDATE settings SET value=jsonb_set(value,'{workerCheckedAt}',to_jsonb(now())) WHERE id='global'");
  return { processed };
}
