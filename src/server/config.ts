export function origin(
  value = process.env.APP_ORIGIN || "http://localhost:3000",
  production = process.env.NODE_ENV === "production",
) {
  const u = new URL(value);
  if (u.username || u.password || u.pathname !== "/" || u.search || u.hash)
    throw new Error("APP_ORIGIN must be a canonical origin.");
  if (
    production &&
    (u.protocol !== "https:" ||
      u.hostname === "localhost" ||
      u.hostname.endsWith(".localhost") ||
      /^(127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) ||
      u.hostname.includes(":"))
  )
    throw new Error("Production requires a public HTTPS APP_ORIGIN.");
  return u.origin;
}
export function mode() {
  const m = process.env.PAYMENT_MODE || "simulation";
  if (m === "simulation" && process.env.NODE_ENV === "production")
    throw new Error(
      "Simulation is disabled in production. Set PAYMENT_MODE=dodo-test.",
    );
  if (!["simulation", "dodo-test", "dodo-live"].includes(m))
    throw new Error("Invalid PAYMENT_MODE");
  if (
    m === "dodo-live" &&
    process.env.DODO_LIVE_ACCEPTANCE !== "confirmed-for-this-product"
  )
    throw new Error(
      "Live payments require merchant acceptance for this exact product.",
    );
  return m;
}
export function isLocal() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_MODE || "local") === "local"
  );
}
export function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`External setup required: ${key}`);
  return value;
}

export function validateProduction() {
  if (process.env.NODE_ENV !== "production") return;
  origin();
  mode();
  if (process.env.AUTH_MODE !== "supabase")
    throw new Error("Production requires AUTH_MODE=supabase.");
  for (const key of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY", "DODO_PRODUCT_ID", "DODO_BUSINESS_ID", "JOB_SECRET", "SUPPORT_EMAIL"])
    required(key);
  if (required("JOB_SECRET").length < 32)
    throw new Error("Production requires a JOB_SECRET of at least 32 characters.");
  if (new URL(required("SUPABASE_URL")).protocol !== "https:")
    throw new Error("Production requires HTTPS Supabase storage and authentication.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(required("SUPPORT_EMAIL")))
    throw new Error("Production requires a valid SUPPORT_EMAIL.");
}
