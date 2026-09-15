# Deployment and external configuration

Current readiness and executed evidence: [production audit](production-audit.md). A real $1 Dodo test purchase and full refund now pass; real webhook delivery and deployed Supabase/TLS/worker acceptance remain outstanding. Older baseline statements below about unavailable provider credentials describe the initial build only.

Target architecture: a continuously running Node 24 Docker web service behind a TLS reverse proxy, a separate durable worker container, and Supabase for PostgreSQL, email OTP and private storage. This avoids relying on short serverless request limits for reconciliation. `Dockerfile` and `compose.yaml` describe the two application services. Container deployment itself has not been exercised on a remote host.

## Database and authentication

1. Create a Supabase project. Set `DATABASE_URL` to its server connection string (use a trusted TLS connection) and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. These are server secrets, never `NEXT_PUBLIC_*` values. The database connection role must be able to run the migrations and bypass application-table RLS; browsers never connect to the database.
2. Run `npm run db:migrate` with the deployment environment loaded. Migrations are ordered and repeatable. Migration 006 adds the 57 second-edition IDs, bringing inventory to 72. It uses INSERT ... ON CONFLICT DO NOTHING; the server also seeds missing registry IDs without overwriting ownership, prices or creative assignments. No paid advertisers are seeded. Restart the app after an inventory update. Financial transitions lock the global settings row for short serial transactions; provider requests happen outside these transactions. For higher scale, replace that conservative lock with a documented per-slot locking strategy while preserving cross-slot moderation correctness.
3. Enable Google authentication in Supabase and save the Google OAuth Client ID and Client Secret in its provider settings. Register the Supabase `/auth/v1/callback` URL in Google. Set the Supabase Site URL to the canonical HTTPS `APP_ORIGIN`, and allow `APP_ORIGIN/auth/callback`. The app verifies the Google identity using PKCE, issues an opaque HttpOnly/SameSite session, and restores the saved destination. See [Google sign-in setup and verification](auth-setup.md).
4. Sign in once through Google with the intended operator email. In the trusted SQL console, promote that existing account with a parameterized equivalent of `UPDATE accounts SET role='admin' WHERE email='your-verified-address';`. Record this bootstrap action in your operator change log. There is no production auto-admin email. Never promote an unverified arbitrary signup.
5. Create one **private** Supabase Storage bucket named `paper-assets` (or set `SUPABASE_STORAGE_BUCKET`). Do not add public/anonymous read or write policies. All object operations use the server key; `/api/assets/:id` decides whether a displayed derivative is public or the requester owns a private draft. Migrations revoke anonymous/authenticated table access and enable RLS. Run access tests again against the deployed project's roles and storage settings.

## Dodo test configuration

Official references checked on 2026-09-12: [checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [dynamic pricing](https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout), [webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [refund API](https://docs.dodopayments.com/api-reference/refunds/post-refunds), [refund detail](https://docs.dodopayments.com/api-reference/refunds/get-refunds-1), and [merchant acceptance](https://docs.dodopayments.com/miscellaneous/merchant-acceptance). Implementation also uses installed SDK 2.50.0 types. No real test account was available during this build.

1. In Dodo **test mode**, create one one-time USD Pay What You Want product. Set minimum price to **$1 or lower**, tax-exclusive pricing, zero discount, purchasing-power-parity disabled, no subscription or add-ons. Actual cart principal is always calculated by the server, up to $10,000. The low product minimum permits operator-edited opening prices; it does not control ranking rules.
2. Describe it honestly as “Advertising on this website's own virtual billboards. No physical Times Square placement. Cumulative ranking; no guaranteed display duration or traffic; outbidding does not automatically refund delivered advertising.” Set the correct tax category with the provider. Do not enable currency conversion or discount campaigns.
3. Set `PAYMENT_MODE=dodo-test`, `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_ID`, `DODO_BUSINESS_ID` and `DODO_PAYMENTS_WEBHOOK_KEY` from the same test business. Set `APP_ORIGIN=https://your-domain.example`. The server creates explicit-amount checkout sessions, binds customer email and internal quote metadata, and returns to `APP_ORIGIN/?checkout=<internal-order-id>` for success or cancellation. No caller-supplied return host is accepted.
4. Configure `https://your-domain.example/api/webhook` with payment, refund and dispute events. Preserve the raw body and `webhook-id`, `webhook-signature`, `webhook-timestamp` headers through your proxy. The endpoint verifies with the official SDK and durably records the event before acknowledgement. Jobs retrieve fresh provider state instead of trusting event arrival order.
5. Run `node --env-file=.env.local scripts/provider-preflight.mjs` against your test configuration. This performs only a product read and checks business, currency, one-time PWYW, discount and tax settings. It does not prove webhook delivery or actual payment/refund behavior.
6. Complete and record the real-provider acceptance exercise below before opening to customers.

## Host and worker

Create `.env.production` from `.env.example`, with `NODE_ENV=production`, `AUTH_MODE=supabase`, `PAYMENT_MODE=dodo-test`, the public HTTPS origin, all secrets above, configured support address, and a cryptographically random `JOB_SECRET` shared by web and worker. Keep `.env.production` out of version control and backups that are not encrypted. On a managed host, set the same values in its secret manager.

```sh
docker compose build
# Run migrations with the same deployment environment:
docker compose run --rm web npm run db:migrate
docker compose up -d
```

Put a TLS proxy in front of `127.0.0.1:3000`. Forward the original Origin header and set trusted client-address headers at the proxy; do not allow arbitrary public clients to forge the forwarded-IP chain. Enforce an additional 6 MiB maximum request body and timeouts at the proxy. Keep `/api/*` uncached and preserve webhook bytes. Serve `/_next/static/*` with immutable caching; app code adds no-store responses for private APIs. Publish no Supabase service keys in CDN configuration.

The worker calls authenticated `POST /api/jobs` every 15 seconds and resumes DB-backed leases after restarts. A scheduled HTTP invocation every minute with `Authorization: Bearer <JOB_SECRET>` is an alternative if the scheduler reliably retries and permits long requests. A running web process alone is insufficient. Alarm on worker downtime, repeated failures, old reservations, undelivered payments, ambiguous refunds and database errors. Back up PostgreSQL and private storage; test a restore before launch.

Compose sets `WORKER_ORIGIN=http://web:3000`; `APP_ORIGIN` remains the public HTTPS origin for browser requests and checkout returns. `DATABASE_POOL_MAX` defaults to 8 (valid range 1-20); size this for the actual database connection budget. Admin Operations exposes the last completed worker run. The worker has an 80-second batch budget and persisted attempt-bound leases; the host must permit the request to finish.

Overwrite untrusted `X-Forwarded-For` at the trusted ingress instead of copying the client's supplied value. Production startup requires valid canonical/support settings, Supabase authentication/storage, database and provider secrets; it rejects simulation and local authentication. Migration 007 adds payment failure codes without rewriting existing orders. Follow the backup/rollout/rollback procedure in the production audit; keep the additive migration when rolling back application code.

## Real-provider acceptance exercise

- Sign in through Google, verify return to the selected billboard and saved draft, upload an image, prove private access from another session fails, and continue to checkout without an operator approval step.
- Purchase a placement in Dodo test mode, including a taxable case. Verify line-item subtotal equals quoted principal, tax is separate, the webhook/job applies once and another browser sees the takeover.
- Retry/duplicate the webhook and revisit a forged return URL; neither may credit extra principal.
- Outbid and return using the $100/$125/$40/$85 example; verify slot-local difference and one active leader.
- Abandon a checkout, reconcile past the 12-minute cutoff, and exercise a late successful payment into full-refund tracking.
- Issue a full refund; verify provider-confirmed gross cash including tax, zero refunded principal supporting rank and recomputed leadership. Exercise refund failure/timeout and a dispute if the provider test environment supports them.
- Confirm deployment RLS/storage policies, canonical origin, worker recovery after restart, HTTPS cookies, production simulation denial and the real merchant's receipt/invoice links.
- Measure a representative physical phone and target desktop on the hosted production build; headless viewport emulation is insufficient for the mobile FPS acceptance target.

## Live activation

After merchant verification for the virtual-advertising product, provision separate live keys/product/webhook and isolated live data, then set `PAYMENT_MODE=dodo-live` and `DODO_LIVE_ACCEPTANCE=confirmed-for-this-product`. That flag records the operator's attestation; it is not independent proof of provider approval.

The same Supabase project can now serve both environments. Live mode uses the private `paper_live` schema and `paper-assets-live` bucket; test mode retains `public` and `paper-assets`. Every live database operation is inside a transaction with a pinned search path containing no `public` fallback, including under transaction pooling. Foreign keys stay inside the live schema, live orders reject test modes, and browser roles have no live-schema access. Both environments still share the Supabase administrator, Auth service, and physical database; they are logically isolated rather than separate infrastructure.

For first-time provisioning, use a production-configured deployment with `PAPER_PROVISION_LIVE=1`, `PAPER_CHECK_PAYMENT_DEPLOYMENT=1`, and `--skip-domain`. The setup creates live tables, preserves existing account identities and login sessions, copies inventory settings, and leaves test purchases, uploads, placements and jobs untouched. It creates a private live bucket and a one-minute Supabase Cron worker whose authorization secret is held in Vault. Webhook responses also schedule immediate durable-queue processing through Next.js `after`.

Keep Production-only Dodo, bucket and worker-secret variables separate from Preview. Provisioning repeats without resetting live data. Future migrations use the schema selected by `PAYMENT_MODE`. Validate the candidate before promoting it; set `PAPER_PROVISION_LIVE=0` for routine deployments. `PAPER_VERIFY_LIVE_WORKER=1` additionally checks recent scheduled processing. See [live setup verification](dodo-live-setup.md).
