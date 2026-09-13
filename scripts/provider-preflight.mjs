import DodoPayments from "dodopayments";
const required = [
  "APP_ORIGIN",
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_WEBHOOK_KEY",
  "DODO_PRODUCT_ID",
  "DODO_BUSINESS_ID",
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Missing ${key}`);
if (!["dodo-test", "dodo-live"].includes(process.env.PAYMENT_MODE))
  throw new Error("Set PAYMENT_MODE=dodo-test or accepted dodo-live.");
if (
  process.env.PAYMENT_MODE === "dodo-live" &&
  process.env.DODO_LIVE_ACCEPTANCE !== "confirmed-for-this-product"
)
  throw new Error("Live mode requires explicit merchant acceptance.");
const client = new DodoPayments({
  baseURL: null,
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment:
    process.env.PAYMENT_MODE === "dodo-live" ? "live_mode" : "test_mode",
  maxRetries: 0,
  timeout: 15000,
});
const product = await client.products.retrieve(process.env.DODO_PRODUCT_ID);
if (product.business_id !== process.env.DODO_BUSINESS_ID)
  throw new Error("Product/business binding mismatch.");
const p = product.price;
if (
  product.is_recurring ||
  p.type !== "one_time_price" ||
  !p.pay_what_you_want ||
  p.currency !== "USD" ||
  p.price > 100 ||
  p.tax_inclusive ||
  p.discount ||
  p.discount_bps ||
  p.purchasing_power_parity
)
  throw new Error(
    "Product must be one-time USD PWYW, minimum at most $1, tax-exclusive, zero discount, PPP disabled.",
  );
console.log(
  "Read-only product configuration check passed. No checkout or refund was created. This check does not verify webhook delivery, merchant acceptance or settlement.",
);
