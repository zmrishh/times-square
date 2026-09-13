# Switching Paper Square to production

Prepared September 13, 2026. The private, git-ignored `.env.production` has production/live mode selected, Supabase authentication selected, and a generated worker secret. External service values remain blank. **Production has not been activated.** The running localhost app still uses `.env.local` and its original test database.

## Values to supply privately

1. Set `APP_ORIGIN` to the final public HTTPS origin and `SUPPORT_EMAIL` to the operator's real support address.
2. Create a separate production Supabase project. Fill `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; configure email OTP and the private `paper-assets` bucket as described in [deployment](deployment.md). Do not connect the live application to the existing test ledger.
3. After Dodo business/product acceptance, switch the dashboard to Live Mode. Create a live API key, copy/create the one-time USD PWYW product in live mode, and enter `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_ID`, and `DODO_BUSINESS_ID` from live mode. Minimum must be $1 or less, tax-exclusive, zero discount and PPP off, matching the server's integer USD ranking model.
4. Create a live webhook for `https://<your-domain>/api/webhook`, subscribing to payment/refund/dispute events. Enter its signing secret as `DODO_PAYMENTS_WEBHOOK_KEY`. The local CLI test relay is not the production endpoint.
5. Set `DODO_LIVE_ACCEPTANCE=confirmed-for-this-product` only when the actual product has been accepted. This value records acceptance; it does not obtain it.

Enter keys in `.env.production` locally or the host's secret manager. Do not send them in chat. Dodo test keys, products and webhooks are independent from live ones: [official test/live documentation](https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode).

## Validation and activation

Read-only provider configuration check, after completing the file:

```powershell
node --env-file=.env.production scripts/provider-preflight.mjs
```

Do not use an ordinary `npm start` in this working directory for live activation: Next.js gives `.env.local` priority over `.env.production`. The existing Docker deployment injects `.env.production` as process variables and excludes local environment files from its image, preventing that mix-up.

On the chosen Docker host, with the production secrets file present and after the [audit launch requirements](production-audit.md#exact-launch-work-still-required) are satisfied:

```sh
docker compose build
docker compose run --rm web npm run db:migrate
docker compose up -d
```

Configure the host's public HTTPS proxy to the private web port. Compose starts the web process and worker together and supplies the worker's internal origin. Verify health, real OTP, private uploads, 72 empty live placements, canonical return URLs, signed webhook delivery, worker heartbeat, alerts and backups. Do not use test cards in live mode or manufacture live activity for verification.

The project currently supports USD card payments. Production activation does not add UPI support. Preserve the test deployment/data for reproducing provider failures. Deployment/rollback procedures and remaining acceptance checks are in the [production audit](production-audit.md).
