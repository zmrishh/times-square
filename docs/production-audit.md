# Paper Square production audit

> Historical audit from September 13. Later deployment and live payment evidence
> supersede its configuration/checkout blockers; see [current live verification](dodo-live-setup.md).

**Launch decision: blocked by production configuration and external acceptance, not ready for public live payments.** The local application has been repaired and its core journeys pass the tests below. Real Dodo **test-mode** purchase and full refund succeeded. Real webhook delivery, production Supabase authentication/storage, managed PostgreSQL, deployed TLS/worker monitoring, and live merchant acceptance still need verification. USD card checkout is implemented; UPI is not.

Audited September 13, 2026. This report supersedes earlier verification counts and statements that no real provider test was available. No site was deployed, live customer charged, or real customer refunded. The later **direct checkout** requirement takes precedence over the original approval-gated journey.

## Scope and authorization

Preserve direct checkout (the later explicit product decision). Test legacy approval/rejection without restoring an approval gate. All test mutations use isolated data; no live charges, live refunds, deployment, or customer messaging. Existing .data/postgres and .data/dodo-test databases and .env.local are excluded from audit mutations.

## Execution plan

1. Inventory routes, actions, schema, environment, scenes and deployment; establish a coverage matrix and baseline file manifest.
2. Reproduce and fix financial, authorization, upload, persistence and job defects. Add focused regression checks.
3. Exercise desktop/mobile UI, full registry, HTML fallback and failure states; fix blockers.
4. Measure loading, rendering and bounded request concurrency; check production configuration and dependencies.
5. Run full regression and a production-build smoke test; record evidence, external blockers and rollback steps.

## Evidence rules

PASS means executed and verified. CODE REVIEW is not runtime verification. BLOCKED identifies a specific unavailable external dependency. NOT TESTED states a coverage gap. A simulator pass is never evidence of Dodo settlement.

## What exists

Next.js 16.3.5 / React 19.2.8 App Router; Three.js 0.186 with React Three Fiber; TypeScript, Zod, Sharp, PostgreSQL and Dodo SDK 2.50.0. `/` hosts the square and its HTML panels. `/api/[...path]` dispatches authenticated application APIs; `/api/og/[id]` makes labeled sharing illustrations. `src/components/paper-square.tsx` owns navigation/session/panel state; `square-scene.tsx` owns rendering/input; `panels.tsx`, `creative-editor.tsx` and `ui.tsx` implement the HTML flows. `src/lib/registry.ts`, `scene-layout.ts`, `house-art.ts` and `creative-renderer.ts` are the authored scene/creative sources.

`src/server/auction.ts` owns transactional financial rules, `payments.ts` provider reconciliation, `jobs.ts` durable work, `auth.ts` opaque sessions and rate limits, `content.ts` creative ownership/moderation, `financial-report.ts` reporting, and `db.ts` initialization/transactions. Seven additive/repeatable SQL migrations define accounts, sessions, drafts, assets, immutable creatives, 72 slots, orders, payments, allocations, per-slot totals, display history, refunds/disputes, webhook events, jobs and audit records. Local development uses persistent PGlite; production requires PostgreSQL and private Supabase storage/email OTP. Realtime is five-second versioned polling, not WebSockets. Docker/Compose supplies a web process and separate worker; no remote deployment was executed.

There are **72 distinct slots and 74 artwork meshes**. Both wraparounds count once. **Zero slots added in this audit**; the earlier density expansion added 57 to the original 15. Existing IDs, dimensions and commercial associations remain intact. House artwork is labeled unsold, ambient pedestrians are decorative, and simulated/test money is excluded from live commercial totals. Analytics are estimated browser/day/creative events, not verified people. Provider invoices, settlement fees/net proceeds, email notifications and automatic retention are not implemented product features and must not be presented as working integrations.

## Coverage matrix

Evidence abbreviations: **U** = `tests/financial.test.ts`, `inventory.test.ts`, `audit.test.ts`; **E** = `tests/e2e/{product,navigation,density,audit}.spec.ts`; **P** = `scripts/audit-production-smoke.mjs` (production build, fixture sessions and mocked provider); **R** = real Dodo test checkout/refund; **V** = `scripts/audit-performance.mjs` and rendered captures. PASS applies to the named checks, not every possible combination of failure states.

| Feature / user and state | Implementation / API | Executed evidence and result | Remaining boundary |
|---|---|---|---|
| First visitor, intro, enter, reset, navigation | `paper-square`, `square-scene`, `/` | PASS E/V; intro dismissed, scene loaded, sensible starting view | Hosted cold load not tested |
| Keyboard walk/strafe, mouse drag, wheel zoom, pointer lock, Escape | `square-scene` camera/input | PASS E; movement, drag separation, pointer lock, collision and typing isolation | Every browser input implementation not tested |
| Mobile touch, joystick, directory and map | `square-scene`, `panels` | PASS E at 390; panel/HTML audit at 360/390/768/1366/1920 | Physical touch hardware/soft keyboard not tested |
| Guided views, quality, mute, reduced motion | `paper-square`, `square-scene` | PASS E/V guided viewpoints; CODE REVIEW quality/audio/reduced-motion branches | Audio output and every quality transition not measured |
| Directory search/filter; map building cluster/list | `panels`, `/api/public` | PASS E/V; accessible HTML route to purchases without 3D | Exhaustive screen-reader session not tested |
| Every billboard hover, click, deep link and camera | registry, scene-layout, scene picker | PASS U/E: all 72 IDs, actual meshes, collision-safe viewing positions | Visual sampling supplements geometric checks |
| Portrait, ticker, flagship and wrap creative preview | creative renderer/editor, registry | PASS U/E/V; both wrap edges/UV scale; expanded portrait and wrap preview | Every uploaded aspect ratio not sampled |
| Occupied, empty, unavailable placements | public snapshot, panels, auction | PASS U/E; simulated takeover/unavailable state, 72 detail selections | Fully image-populated square not load-tested |
| Website destination, sharing, postcard, report | `paper-square`, panels, analytics/report APIs, OG route | CODE REVIEW HTTPS validation, safe external link, share cancellation and actual-canvas export; earlier postcard capture evidence retained | Native share sheet, downloads, reports and popup behavior not exhaustively re-exercised in this pass |
| Anonymous draft -> sign-in -> return on another browser | `/api/draft`, auth APIs, editor | PASS E: private draft, authentication recovery, refresh and concurrent writes produce one draft | Real email OTP delivery BLOCKED by missing Supabase configuration |
| Upload, template edit, preview, continue directly | `/api/upload`, `/api/assets/:id`, `/api/creatives` | PASS U/E/P; PNG re-encoding, SVG rejection, private-before-payment/public-after-payment, template and uploaded creative flows | Production bucket upload/download BLOCKED |
| Legacy pending/rejected creative; administrator review | `/api/admin/*`, `content.ts` | PASS U authorization/status transitions; P admin review screen | New submissions intentionally require no approval; exhaustive review/rejection UI errors not tested |
| New sponsor claims empty screen | quote/checkout, auction, payment APIs | PASS E simulator, P mock, R real $1 test card purchase | Live charging intentionally not tested |
| Outbid, returning sponsor difference, displaced history | rules, auction, account/detail panels | PASS U financial transitions and slot-local difference; E second visitor takeover | Real-provider multi-buyer bidding sequence NOT TESTED |
| Current leader edits creative, cannot self-outbid | content, auction, `/api/creatives` | PASS U ownership, immutable versions, self-bid denial; E owner upload state | Complete current-sponsor editing UI sequence not independently repeated in production build |
| Receipts, status, account, rankings, analytics | `/api/me`, `/api/receipt/:id`, `/api/checkout/status` | PASS U/P/R principal/cash/tax/refund checks; P mobile admin/account views | Provider-issued tax invoice download and settlement reconciliation not integrated |
| Declined/cancelled/ambiguous checkout, cooldown | payment reconciliation, editor/return view, rate limiter | PASS U/P DO_NOT_HONOR display, safe reservation retention, 429 Retry-After; R initial expired checkout released without charge | Real provider decline matrix and cooldown wait/retry UI not exhaustive |
| Invalid/negative/fractional/huge/tampered prices, stale quote | rules, auction, request validation | PASS U cent arithmetic, limits, server totals, stale versions, immutable evidence | See U output for exact assertions |
| Concurrent buyers, double submit, multi-tab retries | transaction lock, unique reservation/payment indexes | PASS U isolated concurrent reservation/reuse and exactly-once allocation | Managed PostgreSQL multi-process concurrency BLOCKED |
| Browser closes, forged return, duplicate/out-of-order events | raw webhook, jobs, payments | PASS U/P signed events through API, worker, fresh provider retrieval; browser closed and forged return cannot deliver | Real provider-to-app webhook delivery BLOCKED; R used reconciliation |
| Payment-before-checkout-response race; DB failure | payments, auction, DB transaction | PASS U: early settlement preserved; injected allocation failure rolls back whole delivery and retry applies once | Actual managed DB outage not induced |
| Reservations, leases, crashes and reconciliation | auction, jobs, worker | PASS U late/expired/ambiguous transitions and refund retry after recorded success; persistence restart PASS | Killing a live provider request/worker at every instruction boundary not tested |
| Refund pending/completed/failed/ambiguous; disputes | payments, auction, refund attribution | PASS U mocked state transitions/attribution/dispute restoration; P admin full refund; R real full test refund | Real taxable, partial, pending/failed refunds and real disputes NOT TESTED |
| Refund history rendering | `/api/me`, `/api/admin` lateral latest-refund query | PASS P: older failed attempt plus success produces one payment row with latest status | No ledger records removed |
| Anonymous/A/B/admin/expired permissions | auth and all private API dispatch | PASS U/E/P: cross-account draft/upload/receipt/creative/quote/status/admin denial | Supabase-deployed role/storage configuration BLOCKED |
| CSRF, body limits, XSS/URLs, uploads and public data | request-body, Zod content schema, API, RLS SQL | PASS U/E/P malformed JSON, bounded chunks, active SVG denial, Origin, unauthorized reads, RLS unprivileged role; CODE REVIEW parameterized SQL/no server metadata fetch | Independent penetration test and proxy configuration not executed |
| Realtime second visitor, refresh and persistence | public versions, polling, DB | PASS E two independent contexts see takeover without camera reset; 11 tables unchanged across restart/migration replay | Prolonged offline reconnect/stale-event permutations not all executed |
| Loading/error/fallback/focus/overflow | UI, editor, scene boundary | PASS E/P axe at five widths; V actual context loss/recovery and WebGL absent at startup | Safari/Firefox, assistive technology and virtual keyboard coverage missing |
| Worker operations, failed orders, replay, suspension | `/api/admin`, jobs, moderation | PASS U/E/P server authorization, missing-target failures, suspension privacy, mobile management | Alert delivery/remote scheduler/backup restore BLOCKED |
| Production host/mode/secrets/canonical URLs | config, db, Next config, Docker/Compose | PASS U/P production simulator rejection, exact Origin, session boundaries; CODE REVIEW startup guards and private storage path | Actual TLS, container host, live credentials/acceptance not configured |

The requested exhaustive cross-product of success, cancellation, delay, network loss, expired session and safe retry **for every journey has not been fully executed**. The financial and permission invariants have stronger automated coverage than secondary share/audio/report actions. This limitation is intentional in the report, not a claim those actions passed by inspection.

## Defects repaired

| Severity | Finding and cause | Repair and regression evidence |
|---|---|---|
| Critical | Settlement could arrive while checkout creation was still awaiting the provider, then be overwritten or treated as unmatched | Preserve terminal state; bind previously unknown session only with matching immutable payment evidence. U early-settlement race passes |
| High | Recorded provider refund success followed by a crash could leave ranking allocations unchanged | Retry completes accounting even if refund is already succeeded. U crash/retry regression passes |
| High | A failed provider payment remained a generic pending checkout; failed payments need not expose successful line items | Reconcile authenticated terminal failure with failure code; protect delivered state; retain reservation until cutoff. U/P decline tests pass |
| High | Suspended artwork could remain publicly retrievable; long immutable browser caching prevented permission rechecks | Recheck eligible image/logo reference and owner/admin permission; authorization-sensitive cache policy. E public -> suspension -> 404 passes |
| High | Account draft recovery depended on the anonymous browser token; concurrent first writes could create duplicates | Account-aware lookup and transaction-bound upsert. E another-browser recovery and concurrent writes pass |
| High | Production settings could fail late or accept incomplete configuration; SDK base URL override could undermine mode separation | Validate public origin, auth/database/storage/payment/support settings before DB initialization; pin SDK environment. U/P plus CODE REVIEW |
| High | A stale worker lease holder could overwrite a newer attempt; worker request could take unbounded batches | Attempt/state-qualified completion, per-run time budget and visible persisted heartbeat. CODE REVIEW; U recovery and P jobs execute |
| Medium | Rate-limit failures appeared as generic errors and explained no cooldown | Typed 429 with Retry-After and actionable message. U/E pass |
| Medium | Invalid JSON/object input and unknown admin targets produced misleading errors or success | Explicit request shape validation and affected-row checks. E passes |
| Medium | Multiple refund attempts duplicated payment display rows and could show an obsolete status | Latest refund selected per payment, preserving all history. Final P regression passes |
| Medium | WebGL absent at startup could leave loading stuck; boundary could not reset after context loss | Capability probe before renderer, resettable scene boundary and working Try 3D again action. V actual loss and no-WebGL startup pass |
| Medium | Low-contrast fine text, weak mobile targets and inaccessible scene/map roles | Readable muted colors, 44px mobile controls, accessible groups/region, scroll/focus target and mobile map entry. E five-width axe/overflow suite passes |
| Medium | Held mobile input/keyboard state and hidden rendering could continue during interruptions | Clear joystick/keys on cancellation/blur, ignore editable elements, pause hidden canvas. E input isolation and V stopped draw calls pass |
| Medium | API/image waits could remain indefinite; stale session refresh could overwrite newer state | Bounded request/image timeouts, visible missing-art state, auth refresh generation check. CODE REVIEW; surrounding E/P passes |
| Medium | Local uploads were not isolatable; dynamic local filesystem import caused a broad production trace warning | Configurable audit upload directory and production private-storage-only read branch. E upload checks and warning-free build pass |
| Low | Share cancellation could unexpectedly copy a URL; Escape left stale deep link; reset retained zoom | Distinguish share cancellation, clear detail URL, restore normal FOV. CODE REVIEW and surrounding navigation regression |
| Low | Repeated visibility qualification generated redundant analytics traffic; worker used public host from inside Compose | Browser-day event dedupe with retry on failure; separate internal WORKER_ORIGIN. CODE REVIEW and surrounding E/P |

No financial tests were deleted or weakened. The new SQL migration **007_payment_failures.sql** only adds the failure-code field. Migration 006 remains insert-only and inventory seeding preserves existing commercial state.

## Executed evidence

- **29/29 unit/integration/inventory tests PASS**: [unit output](../artifacts/audit/unit-results.txt). Includes integer rounding/limits, returning $125 target minus $40 already applied = $85 due, per-slot isolation, concurrent reservations, evidence identity/amount/environment validation, duplicates, late payment refunds, disputes, partial-refund attribution and RLS denial. Provider behavior in U is mocked.
- **13/13 Edge browser tests PASS**: [full results](../artifacts/e2e-results.json). Includes every real billboard mesh, both legacy and expanded direct-checkout simulator journeys, second visitor updates, keyboard/collision/touch tests, upload/authorization regressions and five viewport audits.
- **Final production-build core smoke PASS**: [results](../artifacts/audit/production-smoke.json). Full creative -> quote -> hosted-checkout redirect -> forged pending return -> browser closed -> signed duplicate/out-of-order webhook -> worker -> delivery -> account -> admin refund -> declined order, plus expired/cross-account permissions and repeated refund history. **Dodo HTTP is mocked and sessions are fixtures** in this test.
- **Real Dodo test purchase/full refund PASS**: [exercise](../artifacts/audit/real-dodo-exercise.json), [reopened ledger](../artifacts/audit/real-dodo-ledger.json). Order `ae128955-e845-4ab8-ba00-26ee5cae52bd`, payment `pay_0NnVCBilzY92Z6C5nCZV3`, $1 USD principal/cash, zero tax; delivered then provider-confirmed full refund, allocation zero, reservation released. Used only the provider's published test Visa in the test checkout. First inspection checkout expired without a charge; a fresh isolated order was used. No live funds moved.
- **Real webhook delivery BLOCKED**: reopened real-test ledger contains **zero webhook events**. Reconciliation recovered payment/refund successfully. [Read-only endpoint inspection](../artifacts/audit/dodo-webhook-configuration.json) found an enabled Dodo CLI relay with all event types and a matching configured signing secret. This execution environment's CLI reports no active login; no active forwarding connection was established. A configured relay alone is not delivery evidence. Configure a durable public HTTPS endpoint and verify a provider-originated event, or establish a test relay to the isolated server and repeat delivery testing.
- **Existing test purchase preservation PASS**: [read-only comparison](../artifacts/audit/existing-dodo-payment.json) matched the earlier $10 succeeded Dodo test payment to its delivered local order, payment, applied allocation and owned creative. Only an isolated copy of the original database was opened for this comparison.
- **Original files preserved PASS**: [SHA-256 evidence](../artifacts/audit/data-preservation.json); all **2,167** protected original database/upload/configuration files unchanged before restoring the original app. Audit databases, fixtures and cookies live separately under ignored `.data/audit-*` paths. Restarting the improved original app may apply additive migration 007 and normal worker timestamps; the hash proof describes the audit isolation boundary, not a promise that a running DB never changes.
- **Persistence/migration replay PASS**: [before](../artifacts/audit/persistence-before.json) / [after](../artifacts/audit/persistence-after.json); all rows in 11 commercial/content tables hash identically across isolated database/web restart and replay of all migrations. The fixture harness creates new disposable session accounts on restart; those are not the customer ledger.
- **Lint, TypeScript and optimized build PASS**: [lint](../artifacts/audit/lint-results.txt), [types](../artifacts/audit/typecheck-results.txt), [build](../artifacts/audit/build-results.txt). Final build emits no project warnings. [Dependency audit](../artifacts/audit/dependency-audit.json): zero known npm vulnerabilities at audit time. Runtime Three Clock deprecation belongs to the installed renderer dependency; no rendering failure was observed.

The production database test used a **PGlite PostgreSQL wire adapter, pool size 1**, not a deployed Supabase server. The adapter's prepared-statement multiplexing failed with a larger pool; this is explicitly excluded from managed PostgreSQL concurrency claims. Configurable production pool sizing defaults to 8. U transaction tests run against isolated PostgreSQL semantics and validate application invariants; they do not establish remote database throughput.

## Rendered UI and scene review

At **360, 390, 768, 1366 and 1920 pixels**, the square, directory, map, rules, wrap detail, editor and sign-in were rendered and checked for horizontal overflow and axe WCAG A/AA violations. Final captured states report no violations/page errors. Initial failed contrast results are retained as `artifacts/audit/before-*-accessibility.json`. Production pending/delivered/declined/account and four mobile admin panels also have clean captured axe results. This does not replace screen-reader testing or physical-device keyboard checks.

Representative captures: [desktop opening](../artifacts/audit/production-1440-opening.png), [central tower](../artifacts/audit/production-1440-central.png), [red steps](../artifacts/audit/production-1440-steps.png), [mobile opening](../artifacts/audit/production-390-opening.png), [mobile editor](../artifacts/audit/390-editor.png), [mobile directory](../artifacts/audit/390-directory.png), [mobile failed-WebGL HTML purchase](../artifacts/audit/production-no-webgl-390.png), [admin payments](../artifacts/audit/production-admin-payments-390.png), [declined payment](../artifacts/audit/production-declined.png).

Visual inspection confirms dense, varied full-color stacks on both sides, substantial central tower coverage, and a developed TKTS composition, while pale framing, windows, supports and walking routes remain visible. Registry tests verify attached geometry, non-overlapping coplanar frames, wrap joins/scale and safe views; E selects all 72 actual meshes. No remaining overlap/floating/flicker defect was reproduced. This is a combination of programmatic geometry checks and representative visual sampling, not a manual screenshot of every possible camera angle.

Matching original density before/after captures at three views and two sizes remain in [density verification](density-update.md). No new slot geometry was added during this audit. The prior report records 38 unobstructed opening-view screen centres, above the suggested 18-25 composition target. Original screenshot attachments were not present, so repeatable authored camera positions were used, with matching sizes and overlays dismissed.

## Performance and resilience

[Raw production measurements](../artifacts/audit/production-performance.json): Windows laptop, AMD Ryzen 3 7320U/Radeon, headless Edge 153, DPR 1, medium quality, eight-second steady-state samples, house artwork. Canonical HTTPS origin was intercepted to local HTTP by Playwright; **no real WAN, TLS deployment or physical phone** was measured.

| Measurement | 1440 x 960 | 390 x 844 emulation |
|---|---:|---:|
| Mean animation frame rate | 59.24 FPS | 59.95 FPS |
| p95 frame interval | 16.9 ms | 16.9 ms |
| Median draw calls / triangles | 320 / 17,072 | 237 / 13,678 |
| Initial scene-ready observation | 3.205 s | 1.459 s |
| Initial measured GL textures / buffers | 81 / 1,398 | 72 / 1,049 |
| Heap after GC, before -> after 20 panel cycles | 18.82 -> 19.94 MB | 18.43 -> 19.15 MB |
| Textures after 20 cycles at the sampled return view | 63 -> 63 | 46 -> 46 |

Panel-cycle GPU resource counts stayed stable; the small heap change is not proof of an hours-long leak-free session. Initial decoded static bodies were **1,527,283 bytes**; all measured production JS/CSS/font assets gzip to **461,727 bytes**. Twenty-four local read-only `/api/public` requests at concurrency six passed, p50 **61.4 ms**, p95 **101.7 ms**, with the fixture pool limited to one connection. These measurements precede only the final hook-dependency cleanup and refund-list SQL adjustment; final production core smoke/build ran after those changes.

Actual `WEBGL_lose_context` -> HTML directory -> Try 3D again -> new canvas passed. A no-WebGL startup override produced working HTML detail/buy controls. Injected hidden-tab visibility stopped draw calls and restoration resumed them. Three camera views and repeated panel openings were captured. The renderer reuses/instances repeated structures, scales textures with screen size/distance and disposes replacements; API/image requests now have timeouts. Network throttling, fully uploaded inventory, hour-long creative churn, mobile GPU memory pressure, Safari/Firefox and remote query latency remain **NOT TESTED**.

## Exact launch work still required

1. Provision and verify real **Supabase PostgreSQL, email OTP and private `paper-assets` storage** using [deployment instructions](deployment.md). Execute cross-user RLS/storage, expiry/recovery and real OTP tests there. Test a backup restore and multi-process transaction concurrency. No configured production project was available in this audit.
2. Deploy to an authorized public HTTPS origin with a continuously running worker. Set `APP_ORIGIN`, database/Supabase/Dodo secrets, `SUPPORT_EMAIL`, strong shared `JOB_SECRET`, and internal `WORKER_ORIGIN`. Verify real secure cookies, proxy/body limits, webhook delivery and worker recovery. Add monitoring/alerts for failed jobs, old reservations and refund liability. No external monitoring integration is configured.
3. Replace the temporary CLI relay with `https://<canonical-host>/api/webhook` for a hosted environment. Subscribe payment/refund/dispute events, use that endpoint's signing key, preserve raw bytes/headers, deliver a real provider test event, then prove durable event/job processing with the browser closed. The current matching relay secret does not establish connectivity.
4. Run remaining provider acceptance: taxable purchase/refund, returning sponsor and competing buyer sequence, late success, provider timeout, pending/failed refund and disputes when supported. A successful $1 zero-tax full refund is narrower evidence. Verify provider invoices/credit notes for external partial refund attribution.
5. **USD cards only:** UPI requires India/INR provider routing, while this app deliberately validates USD principal. Do not merely enable UPI in checkout without designing and testing settlement-currency, ranking and refund attribution. If UPI is a launch requirement, its implementation is an additional blocker. No claim of UPI support is made.
6. Finalize actual operator identity, support, privacy/refund/retention disclosures and purge policy. Expired authentication data, anonymous drafts/unreferenced assets and processed jobs currently have no automatic purge schedule; monitor growth and implement the approved retention periods before public operation.
7. Check real phones, Safari/Firefox and screen readers on the hosted build. Test keyboard overlap, native share/download/audio and slow/failed networks. The current emulated widths are useful layout evidence, not device certification.
8. Obtain Dodo merchant acceptance for this precise virtual-advertising model before using live keys. Use separate live product/keys/webhook and clean live database/storage. `DODO_LIVE_ACCEPTANCE=confirmed-for-this-product` is an operator attestation, not provider approval. Rotate any key previously pasted into chat if it remains active; this audit did not print or replace stored secrets.

## Deployment and rollback handoff

Nothing was published. Once deployment is explicitly authorized, back up PostgreSQL and private assets, verify a restore in isolation, load production secrets, run migrations against the intended environment, then roll out matching web/worker images. Migration 007 is additive and compatible with the preceding code. Keep the previous image/tag and deployment environment available.

For rollback, pause new checkout creation, preserve the database and storage, keep/restart a compatible worker to reconcile already-started payments, and revert the application image after assessing in-flight orders. **Do not restore an old financial snapshot over new provider transactions, delete payment records, or drop migration 007 as a rollback shortcut.** Reconcile provider evidence and outstanding refunds before resuming sales. Keep test/live ledgers separate.

The reverse proxy must overwrite client-supplied forwarded-address headers with its trusted client address (for example, `X-Forwarded-For $remote_addr` for a single trusted ingress), because general anonymous rate limits use that address. Bind the web port privately, keep API responses uncached, preserve webhook raw bodies/signatures, and enforce the documented upload body limit. See [operations](operations.md) for ambiguous refunds, reconciliation limits and manual partial-tax attribution.

Audit harnesses under `scripts/audit-*` use isolated local databases/fixture sessions and are excluded from the Docker context. Private cookies, checkout URLs and database files are under ignored `.data`; do not publish that directory. Automated production smoke mocks provider HTTP only through an explicit test-process preload, never an application simulation route enabled in production.

Final local handoff: the isolated audit servers were stopped and the normal `http://localhost:3000` app and worker restored with the existing `.env.local`. `/api/health` returned `ready`, `/api/public` reported `dodo-test` and 72 slots, and the regular worker completed a run. `git diff --check` passed (Windows line-ending notices only). No commit, push or deployment was performed.
