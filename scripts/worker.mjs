import { setTimeout } from "node:timers/promises";
const origin = process.env.WORKER_ORIGIN || process.env.APP_ORIGIN || "http://localhost:3000";
const secret =
  process.env.JOB_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "local-worker-only");
if (!secret) throw new Error("JOB_SECRET is required.");
const once = process.argv.includes("--once");
do {
  try {
    const r = await fetch(`${origin}/api/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) throw new Error(`Worker endpoint ${r.status}`);
    console.log(new Date().toISOString(), await r.json());
  } catch (e) {
    console.error("Worker failed:", e.message);
    if (once) process.exitCode = 1;
  }
  if (!once) await setTimeout(15000);
} while (!once);
