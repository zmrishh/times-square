# Paper Square

A walkable, ink-on-paper interpretation of Times Square with 72 purchasable virtual billboard slots. Full-color creative previews, per-placement cumulative paid rankings, advertiser and moderation dashboards, and durable payment/refund reconciliation are implemented. This sells advertising inside this website; it does not place ads on physical screens.

## Run locally

Use Node.js 24 and npm. From this folder:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. In a second terminal run `npm run worker`. The app creates durable embedded PostgreSQL at `.data/postgres`, and uploads at `.data/uploads`. Keep only one app process on that embedded directory; the worker calls the app over HTTP. Production uses managed PostgreSQL.

No credentials are needed locally. Email sign-in displays a six-digit development code; no email is sent. Sign in as **operator@paper.local** to access the local review desk. Other addresses create advertiser accounts. All local money is visibly simulated. To try the complete flow, create a draft, sign in, continue directly to payment, accept the placement terms, and use the payment simulator. The operator can issue and track a full simulated refund. Simulation and the local admin shortcut are disabled under `NODE_ENV=production`.

Copy `.env.example` to `.env.local` to change configuration. Keep `APP_ORIGIN` exactly equal to the browser origin, including the port. `NEXT_PUBLIC_APP_NAME` controls the wordmark/title and is compiled into the client. `SUPPORT_EMAIL` configures the contact. Draft launch rules intentionally identify missing operator information.

## Implemented behavior

- One shared seven-day auction starts with the first request after this release goes live. The database stores the deadline once; reloads, restarts and redeployments preserve it. At the cutoff, each billboard's eligible paid leader wins permanently. Unclaimed slots stay unclaimed. New quotes and bids close, late payments enter the refund workflow, and later refunds or moderation never promote a runner-up. The winner may still edit eligible artwork. The public snapshot and worker finalize the saved winner map under the same transaction lock as payments.

- Actual 3D facades, red TKTS steps, One Times Square's sign tower, Marquis/Astor/1540 silhouettes, collision-bounded walking, cursor drag, explicit pointer lock, wheel zoom, tour, reduced motion and mobile joystick. HTML directory and purchase flow work without WebGL.
- Seventy-two stable deep links, occlusion-aware picking, paid artwork, live placement preview, continuous textures across both wraparound displays, searchable sponsor directory, history, sharing and an actual-scene downloadable postcard.
- Anonymous drafts survive authentication. Static PNG/JPEG/WebP uploads are limited to 5 MiB, 64–6000 pixels per side and 16 MP; derivatives are at most 2048 pixels, metadata stripped. Validated immutable creative versions are ready for checkout immediately, without manual approval. Uploaded artwork stays private until displayed on a paid placement.
- Integer-cent server quotes; returning brands pay only the difference for the same slot. At most one reservation per slot, 10 minutes plus 2 minutes settlement grace. No self-outbidding, automatic rebidding or automatic refund merely because a delivered placement is outbid.
- Server-created Dodo PWYW checkout sessions, raw-body signature verification, event/payment deduplication, atomic application, durable outbox/jobs, refund tracking, chargeback eligibility and operator recovery. Redirect parameters never grant a placement.
- Separate cash/tax/applied principal/refund liabilities, actual display periods, receipts, qualified views and deliberate website clicks. Live commercial aggregates exclude Dodo test and simulated money. Fees/net proceeds are explicitly unavailable without settlement reconciliation.

## Verify

See the [current production audit and launch blockers](docs/production-audit.md) for the coverage matrix, repaired defects, real test-payment/refund evidence, screenshots, performance and rollback instructions. The application has 72 slots; this audit added no inventory and preserved original data. Direct checkout remains enabled without a manual approval gate.

```sh
npm test
npm run lint
npm run build
# Keep npm run dev running for browser checks:
npm run test:e2e
npm run test:visual
node scripts/measure.mjs
```

Browser scripts use installed Microsoft Edge (`channel: msedge`). On another machine install Edge or change the channel to an installed Chromium browser. `tests/financial.test.ts` uses isolated in-memory PostgreSQL and no real provider calls. E2E creates labeled simulation records in the local database. Browser tests must run only against the development simulator. See [verification](docs/verification.md) for actual results and limitations, and `artifacts/` for screenshots.

## External setup and deployment

Hosting on Vercel: follow the [Vercel handoff](docs/vercel.md), including Supabase, environment variables and the separate scheduled worker. Importing the GitHub repository alone does not activate the financial backend. Generated audit artifacts are retained locally and excluded from Git.

See [deployment and Dodo configuration](docs/deployment.md) and [operations/recovery](docs/operations.md). Required: a public HTTPS origin, Node container host plus durable worker, Supabase PostgreSQL/email OTP/private storage, Dodo test credentials/product/webhook, operator identity/support/retention terms, and a complete real Dodo test purchase/refund. Live charging additionally requires acceptance for this exact explorable advertising product.

The code includes a Docker image and Compose services. Nothing has been deployed and no live payment has been enabled. [Scene research](docs/scene-plan.md) records original modeling choices; [asset notes](docs/assets-and-licenses.md) identify source and licensing boundaries.

## Expanded square

The second edition adds 57 authored placements, bringing inventory to 72. Existing IDs and commercial records are preserved by `006_expanded_inventory.sql`. See [density verification and matching screenshots](docs/density-update.md).
