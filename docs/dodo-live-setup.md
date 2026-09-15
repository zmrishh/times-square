# Dodo live activation

Live payments were enabled on September 14, 2026 at `https://newyorkcity-kappa.vercel.app`, using deployment `dpl_7CoEtSkM46BJg6zTotxUKbthexy4`. No real card payment or refund was made during setup.

- Created live product `pdt_0Nnb5CaME4AitLjbUfbtH`, **Paper Square — Virtual Billboard Advertising**. It uses the existing test product's tax category and one-time USD pricing: $1 minimum, Pay What You Want, tax-exclusive, no discount, and purchasing-power-parity disabled. The app supplies the actual quoted amount. The real-provider product preflight passed.
- The live webhook for `https://newyorkcity-kappa.vercel.app/api/webhook` is enabled for payment, refund, and dispute events. Its signing key matches Production. Private setup values are stored in Vercel and the ignored `.env.dodo-live` file. A signed non-financial `integration.check` event was accepted and processed; an unsigned request returned HTTP 401. This is a transport check, not a provider-originated payment or proof of settlement.
- Validated the current hosted configuration through production-configured deployment `dpl_B2duarcQAgye6skaA63yJEPAganP`, without promoting the public domain. It reported `dodo-test`, a matching product/business, zero orders, zero payments, zero allocations, and zero totals.
- Production now uses the private `paper_live` schema and private `paper-assets-live` bucket in the existing Supabase project. Preview retains `public`, `paper-assets`, and its test credentials. Provisioning preserved source records, created 72 live inventory entries, and found zero cross-schema foreign keys. Each live transaction pins its search path without a public fallback. Live orders reject test payment modes; browser roles cannot access the live schema.
- Supabase Cron runs the live worker every minute with its authorization secret in Vault. Webhooks also trigger immediate processing through Next.js `after`. The final hosted preflight observed a successful scheduled run at 17:41 UTC, the worker completion at 17:41:05 UTC, and the single setup event processed. Financial records remained empty.
- Public browser checks returned HTTP 200, `dodo-live`, and 72 billboards for all four cold/idle reads. All 51 unit/database tests, lint, type checking and the production build passed. Isolation tests cover preservation, repeat provisioning, transaction search paths, access denial and rejection of test orders. Unit test concurrency is capped at two to prevent embedded PostgreSQL fixtures exhausting this machine's memory.

## Operating notes

- Existing Supabase Auth and connection settings are retained. Test uploads and placements remain in the test environment; they were not promoted into live sponsor history.
- Same-project isolation shares the administrator, Auth service, database infrastructure and storage service. It is logical data isolation, not separate infrastructure.
- Keep `PAPER_PROVISION_LIVE` disabled for routine deployments. It is repeatable but only needed for initial provisioning or deliberate setup repair.
- Use `PAPER_CHECK_PAYMENT_DEPLOYMENT=1` for hosted configuration checks and `PAPER_VERIFY_LIVE_WORKER=1` to verify recent scheduled processing before promotion.
- A real live payment, tax receipt, refund and bank settlement have not been exercised during this activation.

`scripts/payment-deployment-preflight.mjs` performs read-only hosted checks without logging credentials or customer records. The existing build keeps it inactive unless explicitly requested. `scripts/provider-preflight.mjs` checks the real Dodo product configuration.
