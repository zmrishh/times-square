import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { id, query, tx, one, DB } from "./db";
import { isLocal, required } from "./config";
import { RateLimitError } from "./errors";
export type Account = {
  id: string;
  email: string;
  role: "admin" | "advertiser";
  suspended: boolean;
};
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function account(requiredAuth = true): Promise<Account | null> {
  const token = (await cookies()).get("paper_session")?.value;
  if (!token) {
    if (requiredAuth) throw new Error("Sign in to continue.");
    return null;
  }
  const a = (
    await query<Account>(
      `SELECT a.id,a.email,a.role,a.suspended FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [hash(token)],
    )
  )[0];
  if (!a || a.suspended) {
    if (requiredAuth) throw new Error("Sign in to continue.");
    return null;
  }
  return a;
}
export async function admin() {
  const a = await account();
  if (a?.role !== "admin") throw new Error("Admin access required.");
  return a;
}
export async function anonymous() {
  const c = await cookies();
  let token = c.get("paper_draft")?.value;
  if (!token) {
    token = randomBytes(24).toString("hex");
    c.set("paper_draft", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return hash(token);
}
export async function rate(db: DB, key: string, limit: number, seconds = 60) {
  const r = await one<{ count: number; reset_at: string }>(
    db,
    `INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+$2*interval '1 second' ELSE rate_limits.reset_at END RETURNING count,reset_at`,
    [key, seconds],
  );
  if (r.count > limit)
    throw new RateLimitError(Math.max(1, Math.ceil((new Date(r.reset_at).getTime() - Date.now()) / 1000)));
}
export function supabase() {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function sendCode(email: string) {
  await tx((db) => rate(db, `auth:${hash(email)}`, 5, 900));
  if (!isLocal()) {
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error("Unable to send the sign-in email.");
    return { sent: true };
  }
  const code = String(randomInt(100000, 999999));
  await query(
    `INSERT INTO challenges(email,code_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(email) DO UPDATE SET code_hash=$2,expires_at=now()+interval '10 minutes',attempts=0`,
    [email, hash(code)],
  );
  return { sent: true, localCode: code };
}
export async function verifyCode(email: string, code: string) {
  if (isLocal()) {
    const result = await tx(async (db) => {
      const r = await one<{ code_hash: string; attempts: number }>(
        db,
        "UPDATE challenges SET attempts=attempts+1 WHERE email=$1 AND expires_at>now() RETURNING code_hash,attempts",
        [email],
      );
      if (!r || r.attempts > 5 || r.code_hash !== hash(code)) return false;
      await db.query("DELETE FROM challenges WHERE email=$1", [email]);
      return true;
    });
    if (!result) throw new Error("The code is invalid or expired.");
  } else {
    const { data, error } = await supabase().auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error || !data.user?.email || data.user.email.toLowerCase() !== email)
      throw new Error("The code is invalid or expired.");
  }
  const token = randomBytes(32).toString("hex");
  const owner = await anonymous();
  const a = await tx(async (db) => {
    let a = await one<Account>(
      db,
      "SELECT id,email,role,suspended FROM accounts WHERE email=$1",
      [email],
    );
    if (!a) {
      a = {
        id: id(),
        email,
        role:
          isLocal() && email === "operator@paper.local"
            ? "admin"
            : "advertiser",
        suspended: false,
      };
      await db.query("INSERT INTO accounts(id,email,role) VALUES($1,$2,$3)", [
        a.id,
        email,
        a.role,
      ]);
    }
    if (a.suspended) throw new Error("Account suspended. Contact support.");
    await db.query(
      "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [hash(token), a.id],
    );
    await db.query(
      "UPDATE drafts SET account_id=$1 WHERE owner_token=$2 AND account_id IS NULL",
      [a.id, owner],
    );
    await db.query(
      "UPDATE assets SET account_id=$1 WHERE owner_token=$2 AND account_id IS NULL",
      [a.id, owner],
    );
    return a;
  });
  (await cookies()).set("paper_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 604800,
  });
  return a;
}
