import { DB, one } from './db';
import type { AuctionWindow } from '../lib/auction-window';

type AuctionRecord = { startsAt: string; endsAt: string; winners?: Record<string, string | null> };

/** Call inside tx(): the global settings lock serializes closing with payments.
 * Persist once, so refreshes, cold starts and deployments never restart bidding. */
export async function auctionWindow(db: DB) {
  await db.query(`INSERT INTO settings(id,value)
    SELECT 'auction',jsonb_build_object('startsAt',started,'endsAt',started+interval '7 days')
    FROM (SELECT clock_timestamp() AS started) t ON CONFLICT DO NOTHING`);
  const row = await one<{ value: AuctionRecord; server_now: Date }>(db,
    "SELECT value,clock_timestamp() AS server_now FROM settings WHERE id='auction'");
  const closed = Boolean(row.value.winners) || row.server_now.getTime() >= Date.parse(row.value.endsAt);
  if (closed && !row.value.winners) {
    // The leader is maintained by every eligible paid ranking change. Capture
    // it before any post-deadline refund, moderation or creative edit runs.
    const result = await one<{ winners: Record<string, string | null> }>(db,
      "SELECT COALESCE(jsonb_object_agg(id,leader_brand),'{}'::jsonb) AS winners FROM slots");
    row.value.winners = result.winners;
    await db.query("UPDATE settings SET value=$1 WHERE id='auction'", [JSON.stringify(row.value)]);
    await db.query("UPDATE settings SET value=jsonb_set(value,'{version}',to_jsonb((value->>'version')::integer+1)) WHERE id='global'");
  }
  const window: AuctionWindow = {
    startsAt: new Date(row.value.startsAt).toISOString(),
    endsAt: new Date(row.value.endsAt).toISOString(),
    serverNow: row.server_now.toISOString(),
    closed,
  };
  return { ...window, winners: row.value.winners };
}

export async function requireOpenAuction(db: DB) {
  const auction = await auctionWindow(db);
  if (auction.closed) throw new Error('Bidding has ended. Billboard winners are permanent.');
  return auction;
}
