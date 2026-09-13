# Vercel deployment handoff

Import `zmrishh/times-square` into Vercel, choose the Next.js preset, and leave the root directory at the repository root. Use Node.js 24, `npm ci`, and `npm run build`. The build output is Next.js's default; do not select static export. No production secrets or local databases are stored in Git.

## Required before a functioning production deployment

Add the values listed in [go-live.md](go-live.md) to **Vercel Project Settings -> Environment Variables** for the intended production environment. Use the final `https://<project>.vercel.app` origin or your custom domain for `APP_ORIGIN`. Configure that same canonical origin in Supabase and the Dodo return/webhook configuration. Missing settings intentionally prevent financial APIs from running.

Use a separate Supabase production database with the migrations applied, real email OTP, and the private `paper-assets` bucket. Local PGlite files and local uploads are development-only. Run `node --env-file=.env.production scripts/migrate.mjs` once against the intended production database before serving requests, after confirming it is the correct project. Do not put this command in a build shared by preview deployments. Use distinct preview/test credentials and data; keep preview deployments protected until configured.

Dodo live activation still requires actual acceptance and live keys/product/webhook. A Vercel deployment does not convert test records to live ones. See the [audit's outstanding launch requirements](production-audit.md#exact-launch-work-still-required).

## Worker and hosting differences that need attention

- Vercel does not run the Compose worker or `npm run worker` as a permanent background process. Use a durable external worker/scheduler to call **POST `/api/jobs`** at least once per minute with `Authorization: Bearer <JOB_SECRET>`, retry failed invocations and monitor the heartbeat. Set an appropriate Vercel function duration with enough time for the worker's batch/provider calls; the current job runner was tested on a continuously running Node server, not Vercel. Never start an unawaited background loop inside a request.
- Vercel's native cron invokes GET, whereas this application's worker endpoint accepts POST. It is not connected automatically. Native once-per-minute cron also requires a suitable paid plan; Hobby's daily cron is insufficient for reservations. Use the external POST scheduler above or implement and verify an authenticated cron adapter before relying on native cron. [Official cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron request behavior](https://vercel.com/docs/cron-jobs).
- Uploads are limited to 4,000,000 bytes plus a bounded 200,000-byte video poster, below Vercel's function request-body limit. Configure the private bucket for WebP and MP4 using [media storage setup](../scripts/setup-media-storage.sql), and verify an authenticated upload on the actual deployment. See [media verification and limits](billboard-media.md). [Function limits](https://vercel.com/docs/functions/limitations).
- Use a Supabase connection endpoint appropriate for serverless instances and a conservative per-instance pool size. Verify TLS, transactions, concurrency, DB connection limits, private uploads, worker recovery and signed webhook delivery on the actual deployment. [Function duration configuration](https://vercel.com/docs/functions/configuring-functions/duration).

The code was audited locally; **Vercel deployment itself has not been tested or performed**. The GitHub push is a source handoff, not a production activation. Audit screenshots and generated test/provider artifacts remain local under ignored `artifacts/`; repository reports reference those local files. Credentials remain in ignored environment files or the host's secret manager.
