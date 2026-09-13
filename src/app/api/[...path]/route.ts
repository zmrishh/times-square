import { prepareImage, prepareVideo } from "@/server/media";
import { byteRange, MAX_MEDIA_BYTES, MAX_POSTER_BYTES } from "@/lib/media";
import { boundedBody } from "@/server/request-body";
import { RateLimitError } from "@/server/errors";
import { financialReport } from "@/server/financial-report";
import { adjustPayment } from "@/server/auction";
import { reconcilePayment } from "@/server/payments";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  account,
  admin,
  anonymous,
  sendCode,
  verifyCode,
  hash,
  rate,
  supabase,
} from "@/server/auth";
import { audit, id, job, one, query, tx } from "@/server/db";
import { mode, origin } from "@/server/config";
import {
  publicSnapshot,
  submitCreative,
  moderate,
  setInventory,
} from "@/server/content";
import {
  reserve,
  refundIntent,
  Order,
  recompute,
  publish,
} from "@/server/auction";
import {
  dodo,
  startCheckout,
  simulatePayment,
  reconcileOrder,
} from "@/server/payments";
import { runJobs } from "@/server/jobs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { quoteAmount } from "@/lib/rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
const uuid = z.string().uuid();
const uploadDirectory = () => process.env.PAPER_UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads");
function fail(e: unknown) {
  if (e instanceof RateLimitError)
    return Response.json({ error: e.message, retryAfter: e.retryAfter }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(e.retryAfter) },
    });
  if (e instanceof SyntaxError) return json({ error: "Invalid JSON request." }, 400);
  if (e instanceof z.ZodError)
    return json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  const message = e instanceof Error ? e.message : "Request failed";
  const allowed =
    /Sign in|Admin access|code is|do not own|already|approved|unavailable|Too many|Target|Invalid|invalid|paused|checking out|reconciled|External setup|Upload|image|Give a reason|Account suspended|Simulation|Production|DATABASE_URL|PAYMENT_MODE|APP_ORIGIN|Live payments|Use a|Unknown|too large|Unsupported|origin|support|required|not belong|already been/;
  if (!allowed.test(message)) {
    console.error("API request failed:", message);
    return json(
      {
        error:
          "This action could not be completed. Please try again or contact support.",
      },
      500,
    );
  }
  return json(
    { error: message },
    /Sign in|Admin access/.test(message) ? 403 : 400,
  );
}
async function safeBody(r: Request) {
  if (Number(r.headers.get("content-length") || 0) > 20000)
    throw new Error("Request too large");
  const text = new TextDecoder().decode(await boundedBody(r, 20000));
  if (text.length > 20000) throw new Error("Request too large");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid request body. Use a JSON object.");
  return parsed as Record<string, unknown>;
}
function csrf(r: Request) {
  if (r.headers.get("origin") !== origin())
    throw new Error("Invalid request origin.");
}
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await ctx.params).path;
    if (p[0] === "health") {
      await query("SELECT 1");
      return json({ status: "ready" });
    }
    if (p[0] === "public") return json(await publicSnapshot());
    if (p[0] === "me") {
      const a = await account(false);
      if (!a)
        return json({
          account: null,
          brands: [],
          orders: [],
          placements: [],
          analytics: [],
          totals: [],
        });
      const brands = await query(
        "SELECT b.id,b.name,b.suspended,c.id AS creative_id,c.data,c.status,c.reason,c.created_at FROM brands b JOIN creatives c ON c.brand_id=b.id WHERE b.account_id=$1 ORDER BY c.created_at DESC",
        [a.id],
      );
      const orders = await query(
        "SELECT o.id,o.slot_id,o.target,o.due,o.state,o.mode,o.created_at,o.expires_at,o.checkout_url,p.id AS payment_id,p.principal,p.tax,p.cash,p.refunded_cash,p.state AS payment_state,r.state AS refund_state FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN LATERAL (SELECT state FROM refunds WHERE payment_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1) r ON true WHERE o.account_id=$1 ORDER BY o.created_at DESC LIMIT 100",
        [a.id],
      );
      const placements = await query(
        "SELECT h.slot_id,h.total,h.kind,h.started_at,h.ended_at,c.data FROM history h JOIN brands b ON b.id=h.brand_id JOIN creatives c ON c.id=h.creative_id WHERE b.account_id=$1 ORDER BY h.started_at DESC",
        [a.id],
      );
      const totals = await query(
        "SELECT t.slot_id,t.brand_id,t.amount FROM totals t JOIN brands b ON b.id=t.brand_id WHERE b.account_id=$1",
        [a.id],
      );
      const analytics = await query(
        "SELECT v.slot_id,v.kind,COUNT(*)::integer AS count FROM analytics v JOIN creatives c ON c.id=v.creative_id JOIN brands b ON b.id=c.brand_id WHERE b.account_id=$1 GROUP BY v.slot_id,v.kind",
        [a.id],
      );
      return json({
        account: a,
        brands,
        orders,
        placements,
        totals,
        analytics,
      });
    }
    if (p[0] === "draft") {
      const owner = await anonymous();
      const a = await account(false);
      return json(
        (
          await query(
            "SELECT id,data FROM drafts WHERE account_id=$2 OR (owner_token=$1 AND account_id IS NULL) ORDER BY updated_at DESC LIMIT 1",
            [owner, a?.id || null],
          )
        )[0] || null,
      );
    }
    if (p[0] === "receipt" && p[1]) {
      const a = (await account())!;
      const rows = await query(
        "SELECT o.id,o.slot_id,o.mode,o.created_at,p.principal,p.tax,p.cash,p.refunded_cash,p.state FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 AND o.account_id=$2",
        [uuid.parse(p[1]), a.id],
      );
      if (!rows.length) return json({ error: "Not found" }, 404);
      return new Response(
        JSON.stringify(
          {
            description:
              "Virtual advertising on Paper Square. Accounting record; provider-issued invoice remains the tax document.",
            records: rows,
          },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="paper-square-${p[1]}.json"`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (p[0] === "assets" && p[1]) {
      const assetId = uuid.parse(p[1]);
      const a = await account(false);
      const owner = await anonymous();
      const asset = (
        await query<{ path: string; public: boolean }>(
          `SELECT path,public FROM assets a WHERE id=$1 AND
           (account_id=$2 OR (owner_token=$3 AND account_id IS NULL) OR $4 OR
            (public=true AND EXISTS (
              SELECT 1 FROM creatives c JOIN brands b ON b.id=c.brand_id
              JOIN accounts u ON u.id=b.account_id
              WHERE (c.data->>'image'=$5 OR c.data->>'logo'=$5 OR c.data->>'poster'=$5) AND c.status='approved'
              AND NOT b.suspended AND NOT u.suspended
            )))`,
          [assetId, a?.id || null, owner, a?.role === "admin", `/api/assets/${assetId}`],
        )
      )[0];
      if (!asset) return new Response("Not found", { status: 404 });
      let bytes: Uint8Array;
      if (process.env.SUPABASE_URL) {
        const { data, error } = await supabase()
          .storage.from(process.env.SUPABASE_STORAGE_BUCKET || "paper-assets")
          .download(asset.path);
        if (error || !data) throw new Error("Image unavailable");
        bytes = new Uint8Array(await data.arrayBuffer());
      } else if (process.env.NODE_ENV !== "production")
        bytes = await readFile(
          path.join(uploadDirectory(), asset.path),
        );
      else throw new Error("External setup required: private image storage.");
      if (asset.path.endsWith(".mp4")) {
        if (req.nextUrl.searchParams.has("size")) return json({error:"Unsupported video size variant"},400);
        const range = byteRange(req.headers.get("range"), bytes.length);
        const headers = {
          "Content-Type":"video/mp4", "Accept-Ranges":"bytes",
          "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff",
        };
        if (range === false) return new Response(null,{status:416,headers:{...headers,"Content-Range":`bytes */${bytes.length}`}});
        return new Response((range ? bytes.slice(range.start,range.end+1) : bytes) as BodyInit,{
          status:range?206:200,
          headers:{...headers,"Content-Length":String(range?range.end-range.start+1:bytes.length),
            ...(range?{"Content-Range":`bytes ${range.start}-${range.end}/${bytes.length}`}:{})},
        });
      }
      // Authorization above is identical for every derivative. Limit the set of
      // variants so distant screens do not download full-resolution artwork.
      const requestedSize = req.nextUrl.searchParams.get("size");
      if (requestedSize) {
        const size = Number(requestedSize);
        if (![256, 512, 1024, 2048].includes(size))
          return json({ error: "Unsupported artwork size" }, 400);
        bytes = await sharp(bytes)
          .resize({
            width: size,
            height: size,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
      }
      return new Response(bytes as BodyInit, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": asset.public
            ? "private, no-cache"
            : "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (p[0] === "admin") {
      await admin();
      const [
        pending,
        payments,
        jobs,
        audits,
        reports,
        settings,
        users,
        disputes,
        analytics,
      ] = await Promise.all([
        query(
          "SELECT c.id,c.brand_id,c.data,c.status,c.reason,b.name FROM creatives c JOIN brands b ON b.id=c.brand_id ORDER BY c.created_at DESC LIMIT 100",
        ),
        query(
          "SELECT p.id,p.order_id,p.principal,p.tax,p.cash,p.refunded,p.refunded_cash,p.state,p.disputed,o.slot_id,o.mode,r.state AS refund_state FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN LATERAL (SELECT state FROM refunds WHERE payment_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1) r ON true ORDER BY p.created_at DESC LIMIT 100",
        ),
        query(
          "SELECT id,kind,state,attempts,error FROM jobs WHERE state<>'done' ORDER BY created_at DESC LIMIT 100",
        ),
        query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 100"),
        query("SELECT * FROM reports ORDER BY created_at DESC LIMIT 100"),
        query("SELECT value FROM settings WHERE id='global'"),
        query(
          "SELECT id,email,role,suspended FROM accounts ORDER BY created_at DESC LIMIT 100",
        ),
        query("SELECT * FROM disputes ORDER BY updated_at DESC LIMIT 100"),
        query(
          "SELECT kind,COUNT(*)::integer AS count FROM analytics GROUP BY kind",
        ),
      ]);
      return json({
        financial: await financialReport(),
        failedOrders: await query("SELECT id,slot_id,state,failure_code,mode,cutoff_at FROM orders WHERE state IN ('failed','ambiguous','initializing','refund_pending') ORDER BY created_at DESC LIMIT 100"),
        pending,
        payments,
        jobs,
        audits,
        reports,
        settings: settings[0].value,
        users,
        disputes,
        analytics,
      });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await ctx.params).path;
    if (p[0] === "webhook") {
      const m = mode();
      if (m === "simulation")
        return json(
          { error: "Simulation does not accept provider webhooks" },
          404,
        );
      if (Number(req.headers.get("content-length") || 0) > 1000000)
        return json({ error: "Too large" }, 413);
      const raw = new TextDecoder().decode(await boundedBody(req, 1000000));
      if (raw.length > 1000000) return json({ error: "Too large" }, 413);
      let event;
      try {
        event = dodo(m).webhooks.unwrap(raw, {
          headers: {
            "webhook-id": req.headers.get("webhook-id") || "",
            "webhook-signature": req.headers.get("webhook-signature") || "",
            "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
          },
        });
      } catch {
        return json({ error: "Invalid signature" }, 401);
      }
      const eventId = req.headers.get("webhook-id")!;
      await tx(async (db) => {
        await db.query(
          "INSERT INTO webhook_events(id,kind,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [eventId, event.type, JSON.stringify(event)],
        );
        await job(db, `event:${eventId}`, "event", { eventId, mode: m });
      });
      return json({ received: true });
    }
    if (p[0] === "jobs") {
      const secret =
        process.env.JOB_SECRET ||
        (process.env.NODE_ENV !== "production" ? "local-worker-only" : "");
      if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
        return json({ error: "Unauthorized" }, 401);
      return json(await runJobs());
    }
    csrf(req);
    const visitor = hash(
      req.headers.get("x-forwarded-for")?.split(",")[0] || "local",
    );
    await tx((db) => rate(db, `requests:${visitor}`, 240, 60));
    if (p[0] === "upload") {
      const a = await account(false);
      const owner = await anonymous();
      await tx((db) => rate(db, `upload:${a?.id || owner}`, 12, 3600));
      const uploadBytes = await boundedBody(req, MAX_MEDIA_BYTES + MAX_POSTER_BYTES + 10000);
      const form = await new Response(uploadBytes as BodyInit, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > MAX_MEDIA_BYTES)
        throw new Error("Upload an image or video up to 4 MB.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const video = file.type === "video/mp4" || buffer.toString("ascii",4,8) === "ftyp";
      const files: {id:string;key:string;bytes:Buffer;mime:string}[] = [];
      let metadata: {width:number;height:number;duration:number} | undefined;
      let posterId = "";
      if (video) {
        const prepared = await prepareVideo(buffer);
        const poster = form.get("poster");
        if (!(poster instanceof File) || !poster.size || poster.size > MAX_POSTER_BYTES)
          throw new Error("Upload a video with its preview frame. Please select the video again.");
        const posterBytes = await prepareImage(Buffer.from(await poster.arrayBuffer()));
        posterId=id();
        files.push({id:posterId,key:`${posterId}.webp`,bytes:posterBytes,mime:"image/webp"});
        metadata={width:prepared.width,height:prepared.height,duration:prepared.duration};
        const assetId=id();
        files.push({id:assetId,key:`${assetId}.mp4`,bytes:prepared.bytes,mime:"video/mp4"});
      } else {
        const assetId=id();
        files.push({id:assetId,key:`${assetId}.webp`,bytes:await prepareImage(buffer),mime:"image/webp"});
      }
      const stored:string[]=[];
      const bucket = process.env.SUPABASE_URL ? supabase().storage.from(process.env.SUPABASE_STORAGE_BUCKET || "paper-assets") : null;
      try {
        for (const f of files) {
          if (bucket) {
            const {error}=await bucket.upload(f.key,f.bytes,{contentType:f.mime,upsert:false});
            if(error) throw new Error("Upload storage unavailable");
          } else if (process.env.NODE_ENV !== "production") {
            await mkdir(uploadDirectory(),{recursive:true});
            await writeFile(path.join(uploadDirectory(),f.key),f.bytes);
          } else throw new Error("External setup required: private media storage.");
          stored.push(f.key);
        }
        await tx(async db=>{
          for(const f of files) await db.query(
            "INSERT INTO assets(id,account_id,owner_token,path,bytes) VALUES($1,$2,$3,$4,$5)",
            [f.id,a?.id || null,owner,f.key,f.bytes.length],
          );
        });
      } catch(e) {
        if(bucket) await bucket.remove(stored).catch(()=>{});
        else if (process.env.NODE_ENV !== "production") await Promise.all(stored.map(key=>unlink(path.join(uploadDirectory(),key)).catch(()=>{})));
        throw e;
      }
      return json({url:`/api/assets/${files.at(-1)!.id}`,kind:video?"video":"image",
        ...(posterId?{poster:`/api/assets/${posterId}`, ...metadata}:{}),
      });
    }
    const body = await safeBody(req);
    if (p[0] === "auth") {
      if (p[1] === "logout") {
        const c = await cookies();
        const token = c.get("paper_session")?.value;
        if (token)
          await query("DELETE FROM sessions WHERE token_hash=$1", [
            hash(token),
          ]);
        c.delete("paper_session");
        c.delete("paper_draft");
        return json({ ok: true });
      }
      const email = z.email().max(254).parse(body.email).toLowerCase();
      if (p[1] === "send") return json(await sendCode(email));
      if (p[1] === "verify")
        return json(
          await verifyCode(
            email,
            z
              .string()
              .regex(/^\d{6}$/)
              .parse(body.code),
          ),
        );
    }
    if (p[0] === "draft") {
      const owner = await anonymous();
      const a = await account(false);
      const draftId = await tx(async (db) => {
        const old = await one<{ id: string }>(db,
          "SELECT id FROM drafts WHERE account_id=$2 OR (owner_token=$1 AND account_id IS NULL) ORDER BY updated_at DESC LIMIT 1",
          [owner, a?.id || null]);
        const draftId = old?.id || id();
        await db.query(
          "INSERT INTO drafts(id,owner_token,account_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=$4,account_id=$3,updated_at=now()",
          [draftId, owner, a?.id || null, JSON.stringify(body)]);
        return draftId;
      });
      return json({ id: draftId });
    }
    if (p[0] === "analytics") {
      const b = z
        .object({
          slotId: z.string().max(20),
          kind: z.enum(["visit", "view", "panel", "click", "directory"]),
          creativeId: z.string().max(50).optional(),
        })
        .parse(body);
      if (
        /bot|crawler|spider|headless/i.test(req.headers.get("user-agent") || "")
      )
        return json({ ok: true });
      const owner = await anonymous();
      const a = await account(false);
      await tx((db) => rate(db, `analytics:${owner}`, 80, 60));
      const slot = (
        await query<{ creative_id: string }>(
          "SELECT creative_id FROM slots WHERE id=$1",
          [b.slotId],
        )
      )[0];
      if (["view", "panel", "click"].includes(b.kind) && !slot)
        return json({ ok: true });
      if (
        a &&
        slot?.creative_id &&
        (
          await query(
            "SELECT c.id FROM creatives c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1 AND b.account_id=$2",
            [slot.creative_id, a.id],
          )
        ).length
      )
        return json({ ok: true });
      await query(
        "INSERT INTO analytics(slot_id,creative_id,kind,visitor) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [b.slotId, slot?.creative_id || "house", b.kind, owner],
      );
      return json({ ok: true });
    }
    if (p[0] === "report") {
      const b = z
        .object({
          slotId: z.string().max(20),
          reason: z.string().trim().min(10).max(500),
        })
        .parse(body);
      await query("INSERT INTO reports(id,slot_id,reason) VALUES($1,$2,$3)", [
        id(),
        b.slotId,
        b.reason,
      ]);
      return json({ ok: true });
    }
    if (p[0] === "creatives") {
      const a = (await account())!;
      return json(
        await submitCreative(
          a,
          body.creative,
          body.brandId ? uuid.parse(body.brandId) : undefined,
        ),
      );
    }
    if (p[0] === "quote") {
      const a = (await account())!;
      const b = z
        .object({
          creativeId: uuid,
          slotId: z.string().max(20),
          target: z.number().int().positive().optional(),
        })
        .strict()
        .parse(body);
      return json(
        await tx(async (db) => {
          const c = await one<{ brand_id: string }>(
            db,
            "SELECT c.brand_id FROM creatives c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1 AND b.account_id=$2 AND c.status='approved' AND NOT b.suspended",
            [b.creativeId, a.id],
          );
          if (!c) throw new Error("A saved, valid creative is required.");
          const s = await one<{
            opening: number;
            leader_brand: string;
            available: boolean;
          }>(db, "SELECT * FROM slots WHERE id=$1", [b.slotId]);
          if (!s || !s.available) throw new Error("Placement unavailable.");
          if (s.leader_brand === c.brand_id)
            throw new Error(
              "You already lead this billboard. Submit an edited creative to change its artwork.",
            );
          const leader = await one<{ amount: number }>(
            db,
            "SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2",
            [b.slotId, s.leader_brand],
          );
          const existing = await one<{ amount: number }>(
            db,
            "SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2",
            [b.slotId, c.brand_id],
          );
          const cfg = await one<{ value: { preset: string } }>(
            db,
            "SELECT value FROM settings WHERE id='global'",
          );
          return quoteAmount(
            leader?.amount || 0,
            existing?.amount || 0,
            s.opening,
            b.target,
            cfg.value.preset,
          );
        }),
      );
    }
    if (p[0] === "checkout") {
      const a = (await account())!;
      if (p[1] === "simulate")
        return json(await simulatePayment(uuid.parse(body.orderId), a.id));
      if (p[1] === "status") {
        const o = (
          await query<Order>(
            "SELECT * FROM orders WHERE id=$1 AND account_id=$2",
            [uuid.parse(body.orderId), a.id],
          )
        )[0];
        if (!o) throw new Error("Checkout unavailable.");
        // Webhooks/workers remain authoritative; do not hammer Dodo on each UI poll.
        if (!o.last_reconciled_at || Date.now() - new Date(String(o.last_reconciled_at)).getTime() > 15000)
          await reconcileOrder(o.id);
        const fresh = (
          await query(
            "SELECT id,state,slot_id,due,target,mode,failure_code,cutoff_at FROM orders WHERE id=$1",
            [o.id],
          )
        )[0];
        return json(fresh);
      }
      const b = z
        .object({
          creativeId: uuid,
          slotId: z.string().max(20),
          target: z.number().int().positive().optional(),
          accepted: z.literal(true),
        })
        .strict()
        .parse(body);
      const reserved = await reserve(a, b.creativeId, b.slotId, b.target);
      const o = await startCheckout(reserved.id);
      return json({
        id: o.id,
        state: o.state,
        due: o.due,
        target: o.target,
        mode: o.mode,
        url: o.checkout_url,
      });
    }
    if (p[0] === "admin") {
      const a = await admin();
      if (p[1] === "moderate") {
        await moderate(
          a,
          uuid.parse(body.id),
          z.boolean().parse(body.approve),
          z
            .string()
            .max(500)
            .parse(body.reason || ""),
        );
        return json({ ok: true });
      }
      if (p[1] === "settings") {
        const b = z
          .object({
            paused: z.boolean(),
            preset: z.enum(["quarter", "double"]),
          })
          .parse(body);
        await tx(async (db) => {
          await db.query(
            "UPDATE settings SET value=value||$1::jsonb WHERE id='global'",
            [JSON.stringify(b)],
          );
          await publish(db, "all");
          await audit(db, a.id, "settings.updated", "global", b);
        });
        return json({ ok: true });
      }
      if (p[1] === "inventory") {
        const b = z
          .object({
            slotId: z.string(),
            available: z.boolean(),
            opening: z.number().int().min(100).max(100000),
          })
          .parse(body);
        await tx(async (db) => {
          await setInventory(db, b.slotId, b.available, b.opening);
          await audit(db, a.id, "inventory.updated", b.slotId, b);
        });
        return json({ ok: true });
      }
      if (p[1] === "suspend") {
        const b = z
          .object({
            accountId: uuid,
            suspended: z.boolean(),
            reason: z.string().min(10).max(500),
          })
          .parse(body);
        if (b.accountId === a.id)
          throw new Error("Cannot suspend your own admin account.");
        await tx(async (db) => {
          const changed = await db.query(
            "UPDATE accounts SET suspended=$2 WHERE id=$1 AND role<>'admin' RETURNING id",
            [b.accountId, b.suspended],
          );
          if (!changed.rows.length) throw new Error("Account unavailable or protected.");
          const slots = await db.query<{ slot_id: string }>(
            "SELECT DISTINCT t.slot_id FROM totals t JOIN brands b ON b.id=t.brand_id WHERE b.account_id=$1",
            [b.accountId],
          );
          for (const s of slots.rows)
            await recompute(db, s.slot_id, "moderation");
          await audit(db, a.id, "account.moderated", b.accountId, b);
        });
        return json({ ok: true });
      }
      if (p[1] === "refund-attribution") {
        const b = z
          .object({
            paymentId: z.string().max(200),
            principal: z.number().int().min(0),
            cash: z.number().int().positive(),
            reference: z.string().trim().min(10).max(500),
          })
          .strict()
          .parse(body);
        const payment = (
          await query<{ mode: string }>(
            "SELECT o.mode FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1",
            [b.paymentId],
          )
        )[0];
        if (!payment) throw new Error("Payment unavailable.");
        if (payment.mode !== "simulation")
          await reconcilePayment(b.paymentId, payment.mode);
        await tx(async (db) => {
          const p = await one<{
            principal: number;
            tax: number;
            cash: number;
            refunded_cash: number;
            disputed: boolean;
          }>(db, "SELECT * FROM payments WHERE id=$1", [b.paymentId]);
          if (
            p.refunded_cash !== b.cash ||
            b.cash >= p.cash ||
            b.principal > p.principal ||
            b.principal > b.cash ||
            b.cash - b.principal > p.tax
          )
            throw new Error(
              "Invalid refund attribution; refresh provider status and use the confirmed receipt.",
            );
          await db.query(
            "INSERT INTO refund_attributions(payment_id,refunded_cash,refunded_principal,evidence_reference,actor) VALUES($1,$2,$3,$4,$5) ON CONFLICT(payment_id) DO UPDATE SET refunded_cash=$2,refunded_principal=$3,evidence_reference=$4,actor=$5,created_at=now()",
            [b.paymentId, b.cash, b.principal, b.reference, a.id],
          );
          await audit(db, a.id, "refund.attribution", b.paymentId, b);
        });
        const p = (
          await query<{ disputed: boolean }>(
            "SELECT disputed FROM payments WHERE id=$1",
            [b.paymentId],
          )
        )[0];
        await adjustPayment(b.paymentId, b.principal, b.cash, p.disputed);
        await query("UPDATE jobs SET state='done',error=NULL WHERE id=$1", [
          "partial-review:" + b.paymentId + ":" + b.cash,
        ]);
        return json({ ok: true });
      }
      if (p[1] === "refund") {
        await tx((db) =>
          refundIntent(
            db,
            z.string().max(200).parse(body.paymentId),
            z.string().min(10).max(500).parse(body.reason),
            a.id,
          ),
        );
        return json({ ok: true });
      }
      if (p[1] === "jobs") {
        return json(await runJobs());
      }
      if (p[1] === "replay") {
        await tx(async (db) => {
          const changed = await db.query(
            "UPDATE jobs SET state='ready',attempts=0,available_at=now() WHERE id=$1 AND state='failed' AND kind<>'operator-review' RETURNING id",
            [z.string().max(250).parse(body.id)],
          );
          if (!changed.rows.length) throw new Error("Job unavailable for automatic retry. Operator review may be required.");
          await audit(db, a.id, "job.replayed", String(body.id));
        });
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return fail(e);
  }
}
