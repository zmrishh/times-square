import { DB, one } from './db';
import { mediaPrice, quoteAmount, RULES } from '../lib/rules';

/** Net format payments are isolated to a brand and placement. Older paid video
 * allocations are grandfathered; their immutable quotes are never repriced. */
export async function videoCredit(db: DB, slotId: string, brandId: string) {
  const r=await one<{credit:string}>(db,`SELECT COALESCE(SUM(
    CASE WHEN o.rules->>'rulesVersion' IS DISTINCT FROM '2026-09-video-v2' AND c.data->>'mode'='video'
      THEN CEIL(a.amount::numeric/2)
      ELSE GREATEST(0,p.principal-p.refunded-a.amount) END),0)::text AS credit
    FROM allocations a JOIN payments p ON p.id=a.payment_id JOIN orders o ON o.id=p.order_id
    JOIN creatives c ON c.id=o.creative_id WHERE a.slot_id=$1 AND a.brand_id=$2 AND NOT p.disputed`,[slotId,brandId]);
  return Number(r.credit);
}
export async function placementQuote(db: DB, creativeId:string, accountId:string, slotId:string, target?:number) {
  const c=await one<{brand_id:string;mode:string}>(db,`SELECT c.brand_id,c.data->>'mode' AS mode FROM creatives c JOIN brands b ON b.id=c.brand_id JOIN accounts a ON a.id=b.account_id
    WHERE c.id=$1 AND b.account_id=$2 AND c.status='approved' AND NOT b.suspended AND NOT a.suspended`,[creativeId,accountId]);
  if(!c) throw new Error('A saved, valid creative is required.');
  const s=await one<{opening:number;leader_brand:string;available:boolean}>(db,'SELECT * FROM slots WHERE id=$1',[slotId]);
  if(!s?.available) throw new Error('Placement unavailable.');
  const totals=await db.query<{brand_id:string;amount:number}>("SELECT brand_id,amount FROM totals WHERE slot_id=$1 AND brand_id IN ($2,$3)",[slotId,s.leader_brand,c.brand_id]);
  const existing=totals.rows.find(t=>t.brand_id===c.brand_id)?.amount || 0;
  const leader=totals.rows.find(t=>t.brand_id===s.leader_brand)?.amount || 0;
  const cfg=await one<{value:{preset:string}}>(db,"SELECT value FROM settings WHERE id='global'");
  const leading=s.leader_brand===c.brand_id;
  const credit=await videoCredit(db,slotId,c.brand_id);
  if(leading && target!==undefined && target!==existing) throw new Error('Current sponsors cannot increase their own ranking.');
  const base=leading ? {minimum:existing,target:existing,due:0,existing,rulesVersion:RULES.version,preset:cfg.value.preset} : quoteAmount(leader,existing,s.opening,target,cfg.value.preset);
  const result=mediaPrice(base,c.mode==='video',credit);
  return {...result,upgrade:leading};
}
