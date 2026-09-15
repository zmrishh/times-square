import { z } from "zod";
import { Creative, SLOTS, Snapshot, PublicSlot } from "../lib/registry";
import { id, one, query, tx, audit, DB } from "./db";
import { Account } from "./auth";
import { mode } from "./config";
import { recompute, publish } from "./auction";
import { videoCredit } from './media-pricing';
const url = z
  .string()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        u.hostname.includes(".") &&
        !/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname)
      );
    } catch {
      return false;
    }
  }, "Use a public HTTPS URL.");
const asset = z.string().regex(/^(|\/api\/assets\/[a-f0-9-]{36})$/);
export const creativeSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    url,
    tagline: z.string().max(80),
    description: z.string().max(400),
    category: z.enum([
      "Technology",
      "Design",
      "Culture",
      "Food & drink",
      "Other",
    ]),
    social: z.union([z.literal(""), url]),
    mode: z.enum(["template", "upload", "video"]),
    bg: z.string().regex(/^#[a-f0-9]{6}$/i),
    fg: z.string().regex(/^#[a-f0-9]{6}$/i),
    headline: z.string().trim().max(90),
    subline: z.string().max(80),
    logo: asset,
    image: asset,
    poster: asset.optional(),
    fit: z.enum(["contain", "cover"]),
    cropX: z.number().min(0).max(100),
    cropY: z.number().min(0).max(100),
  })
  .strict()
  .refine((c) => c.mode !== "template" || c.headline.length > 0, {
    path: ["headline"],
    message: "Add a headline for your template.",
  });
export async function submitCreative(
  a: Account,
  data: unknown,
  brandId?: string,
) {
  const c = creativeSchema.parse(data);
  if ((c.mode === "upload" || c.mode === "video") && !c.image)
    throw new Error("Upload your creative first.");
  if (c.mode === "video" && (!c.poster || c.poster === c.image || c.logo || c.fit !== "cover"))
    throw new Error("Upload a video preview and use fill-screen placement.");
  return tx(async (db) => {
    const active = await one(db, "SELECT id FROM accounts WHERE id=$1 AND NOT suspended", [a.id]);
    if (!active) throw new Error("Account suspended or unavailable.");
    if (brandId) {
      const b = await one(
        db,
        "SELECT id FROM brands WHERE id=$1 AND account_id=$2 AND suspended=false",
        [brandId, a.id],
      );
      if (!b) throw new Error("You do not own this brand.");
    } else {
      brandId = id();
      await db.query(
        "INSERT INTO brands(id,account_id,name) VALUES($1,$2,$3)",
        [brandId, a.id, c.name],
      );
    }
    for (const assetPath of [c.logo, c.image, c.poster].filter((s): s is string => Boolean(s))) {
      const own = await one<{path: string}>(
        db,
        "SELECT path FROM assets WHERE id=$1 AND account_id=$2",
        [assetPath.split("/").pop(), a.id],
      );
      if (!own) throw new Error("The image does not belong to your account.");
      const expectedVideo = c.mode === "video" && assetPath === c.image;
      if (expectedVideo ? !own.path.endsWith(".mp4") : !own.path.endsWith(".webp"))
        throw new Error("Unsupported media for this creative. Upload the matching image or video.");
    }
    const creativeId = id();
    // Retain the existing status vocabulary for historical orders. Validated
    // versions are checkout-ready immediately; no operator approval is needed.
    await db.query(
      "INSERT INTO creatives(id,brand_id,data,status,reviewed_at) VALUES($1,$2,$3,'approved',now())",
      [creativeId, brandId, JSON.stringify(c)],
    );
    const updatedSlots = await updateLeadingCreative(db, brandId, creativeId);
    await audit(db, a.id, "creative.saved", creativeId);
    return { creativeId, brandId, status: "approved", updatedSlots };
  });
}
async function updateLeadingCreative(
  db: DB,
  brandId: string,
  creativeId: string,
) {
  const led = await db.query<{ id: string }>(
    "SELECT id FROM slots WHERE leader_brand=$1",
    [brandId],
  );
  const updated:string[]=[];
  const c=await one<{data:Creative}>(db,'SELECT data FROM creatives WHERE id=$1',[creativeId]);
  for (const s of led.rows) {
    const t=await one<{amount:number}>(db,'SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2',[s.id,brandId]);
    if(c.data.mode==='video' && await videoCredit(db,s.id,brandId)<Math.ceil(t.amount/2)) continue;
    await db.query(
      "UPDATE totals SET creative_id=$3,fallback_creative_id=CASE WHEN $4 THEN $3 ELSE fallback_creative_id END WHERE slot_id=$1 AND brand_id=$2",
      [s.id, brandId, creativeId,c.data.mode!=='video'],
    );
    await recompute(db, s.id, "creative-update");
    updated.push(s.id);
  }
  return updated;
}
export async function moderate(
  a: Account,
  creativeId: string,
  approve: boolean,
  reason: string,
) {
  return tx(async (db) => {
    const c = await one<{ brand_id: string; data: Creative; status: string }>(
      db,
      "SELECT * FROM creatives WHERE id=$1",
      [creativeId],
    );
    if (!c || c.status !== "pending")
      throw new Error("This version has already been reviewed.");
    if (!approve && !reason.trim())
      throw new Error("Give a reason for rejection.");
    await db.query(
      "UPDATE creatives SET status=$2,reason=$3,reviewed_at=now() WHERE id=$1",
      [creativeId, approve ? "approved" : "rejected", reason],
    );
    if (approve) await updateLeadingCreative(db, c.brand_id, creativeId);
    await audit(
      db,
      a.id,
      approve ? "creative.approved" : "creative.rejected",
      creativeId,
      { reason },
    );
  });
}
let snapshotRead: Promise<Snapshot> | undefined;
export function publicSnapshot(): Promise<Snapshot> {
  // Share simultaneous public reads without caching completed/stale prices.
  snapshotRead ??= readPublicSnapshot().finally(() => { snapshotRead = undefined; });
  return snapshotRead;
}
async function readPublicSnapshot(): Promise<Snapshot> {
  const rows = await query<{
    id: string;
    version: number;
    available: boolean;
    opening: number;
    leader_brand: string | null;
    creative_id: string | null;
    data: Creative | null;
    amount: number | null;
    reserved: boolean;
  }>(
    `SELECT s.*,c.data,t.amount,EXISTS(SELECT 1 FROM orders o WHERE o.slot_id=s.id AND o.reserved=true) AS reserved FROM slots s LEFT JOIN creatives c ON c.id=s.creative_id AND c.status='approved' LEFT JOIN totals t ON t.slot_id=s.id AND t.brand_id=s.leader_brand ORDER BY s.id`,
  );
  const history = await query<{
    slot_id: string;
    name: string;
    total: number;
    started_at: Date;
    ended_at: Date | null;
    kind: string;
  }>(
    `SELECT h.slot_id,c.data->>'name' AS name,h.total,h.started_at,h.ended_at,h.kind FROM history h JOIN creatives c ON c.id=h.creative_id JOIN brands b ON b.id=h.brand_id WHERE c.status='approved' AND NOT b.suspended ORDER BY h.started_at DESC LIMIT 250`,
  );
  const slots: PublicSlot[] = rows.map((r) => ({
    id: r.id,
    version: r.version,
    available: r.available,
    opening: r.opening,
    total: r.amount || 0,
    brandId: r.leader_brand,
    creativeId: r.creative_id,
    creative: r.data,
    reserved: r.reserved,
    history: history
      .filter((h) => h.slot_id === r.id)
      .map((h) => ({
        name: h.name,
        total: h.total,
        at: new Date(h.started_at).toISOString(),
        until: h.ended_at ? new Date(h.ended_at).toISOString() : null,
        kind: h.kind,
      })),
  }));
  const directory = await query<{
    id: string;
    data: Creative;
    total: string;
    slots: string[];
    paid_slots: string[];
  }>(
    `SELECT b.id,c.data,COALESCE((SELECT SUM(t.amount) FROM totals t WHERE t.brand_id=b.id),0)::text AS total,ARRAY(SELECT s.id FROM slots s WHERE s.leader_brand=b.id) AS slots,ARRAY(SELECT t.slot_id FROM totals t WHERE t.brand_id=b.id) AS paid_slots FROM brands b JOIN accounts a ON a.id=b.account_id JOIN LATERAL (SELECT v.data FROM creatives v WHERE v.brand_id=b.id AND v.status='approved' AND EXISTS(SELECT 1 FROM history h WHERE h.creative_id=v.id) ORDER BY v.created_at DESC LIMIT 1) c ON true WHERE NOT b.suspended AND NOT a.suspended AND EXISTS(SELECT 1 FROM totals t WHERE t.brand_id=b.id) ORDER BY b.created_at`,
  );
  const settings = (
    await query<{
      value: { version: number; paused: boolean; preset: string };
    }>("SELECT value FROM settings WHERE id='global'")
  )[0].value;
  return {
    version: settings.version,
    slots,
    directory: directory.map((d) => ({
      id: d.id,
      creative: d.data,
      total: Number(d.total),
      slots: d.slots,
      paidSlots: d.paid_slots,
    })),
    paused: settings.paused,
    preset: settings.preset,
    mode: mode(),
    name: process.env.NEXT_PUBLIC_APP_NAME || "Paper Square",
    support: process.env.SUPPORT_EMAIL || "",
  };
}
export async function setInventory(
  db: DB,
  slotId: string,
  available: boolean,
  opening: number,
) {
  if (!SLOTS.some((s) => s.id === slotId)) throw new Error("Unknown slot");
  await db.query(
    "UPDATE slots SET available=$2,opening=$3,version=version+1 WHERE id=$1",
    [slotId, available, opening],
  );
  await recompute(db, slotId, "inventory-change");
  await publish(db, slotId);
}
