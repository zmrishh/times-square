# Verification record

**Historical baseline.** The current [production audit](production-audit.md) supersedes the counts and provider limitations below: 29 automated unit/integration checks, 13 browser scenarios, final production smoke, and a real Dodo test purchase/full refund now pass. The audit report separately lists unverified production services and real webhook delivery.

**This is the first-edition baseline.** See [expanded-square verification](density-update.md) for the current 72-slot scene, migration evidence and matching before/after captures.

Verified locally on September 12–13, 2026 (Asia/Calcutta). The app is running at `http://localhost:3000` with the local simulator and a durable worker. No deployment or live charge was performed.

## Automated checks

- **19 passing financial/request/database tests** (`npm test`). Covers integer rounding and limits; $125 target less $40 previous contribution = $85 due; slot isolation; approval/ownership; concurrent reservations; retry reuse; duplicate payment identity; mismatched amount/currency/customer/business/environment/product/quantity; signed/invalid official-SDK webhook payloads; full/late refunds; dispute restoration; partial-refund attribution; no-op reconciliation; ambiguous provider creation; out-of-order failure; public-data leakage; immutable quote/creative/audit data; bounded chunked bodies; and RLS denial under an unprivileged database role.
- **4 passing browser scenarios** in installed Microsoft Edge. The full advertiser draft → local OTP → exact-version approval → simulation checkout → second-browser takeover → confirmed refund flow passed. The navigation scenario exercises walking, typing isolation, drag/click separation, explicit pointer-lock entry/Escape exit, all 15 deep-link viewpoints and collision with the steps. Mobile directory/search/back navigation and non-3D buying entry work without horizontal overflow. Security checks cover CSRF rejection, unsupported SVG, actual PNG-to-WebP upload, cross-browser private-asset denial, claimed-asset privacy after logout, private draft logout and unauthorized receipts/admin access.
- **Production build and TypeScript pass.** Routes `/`, `/api/[...path]` and `/api/og/[id]` compile successfully. All direct dependency versions are pinned and `package-lock.json` retained.
- **ESLint and `git diff --check` pass.** Git may print Windows line-ending conversion notices; these are not whitespace errors.
- Desktop/mobile visual capture reports **zero page errors**. This is not a claim of testing every browser or every provider failure combination. Automated API tests use local PostgreSQL semantics; production Supabase policies still need verification in the configured project.

`artifacts/e2e-results.json` and `artifacts/lint.json` contain tool results. The financial test output is reproducible with `npm test`; all provider network behavior in those tests is simulated or mocked. No actual Dodo test transaction occurred.

## Visual review

Inspected the actual 1440×960 desktop and 390×844 mobile renders, plus the northern steps view, detail/editor panels and a second visitor's takeover. Checks included separate full-color billboards, consistent flat/3D composition, paper/navy facades, One Times Square's stacked tower, red steps, screen frames, panel fit, mobile safe areas and readable payment disclosure.

Screenshots:

- [Desktop square](../artifacts/desktop-square.png)
- [TKTS/red-steps view](../artifacts/north-steps.png)
- [Actual placement and creative editor](../artifacts/desktop-editor.png)
- [Desktop directory](../artifacts/desktop-directory.png)
- [Mobile square](../artifacts/mobile-square.png)
- [Mobile directory](../artifacts/mobile-directory.png)
- [Delivered simulated payment](../artifacts/payment-delivered.png)
- [Second visitor sees takeover](../artifacts/second-visitor-takeover.png)
- [Confirmed simulated refund](../artifacts/payment-refunded.png)

The environment is an original, compressed architectural interpretation, not a surveyed/current photorealistic reconstruction. The reference review and intentional scale/layout simplifications are in `scene-plan.md`. The wraparound screen maps one continuous image across its two segments; text near the corner can continue onto the perpendicular face. The downloadable postcard captures actual canvas pixels; OG cards are labeled illustrations.

## Measured performance

Host: Windows, AMD Ryzen 3 7320U with Radeon Graphics, 8 logical cores. Browser: headless Edge 153.0.4234.32, AMD Direct3D11 renderer, device pixel ratio 1. Eight-second development-mode requestAnimationFrame samples, medium preset, house-art scene. See [raw measurements](../artifacts/performance.json).

- 1440×960: **52.1 FPS mean**, 16.9 ms p95 frame interval, 441 visible draw calls, about 14,700 triangles. Initial ready/network-idle observation: 2.91 seconds.
- 390×844 viewport emulation on the **same laptop GPU**: **59.1 FPS mean**, 16.9 ms p95 frame interval, 327 visible draw calls, about 10,742 triangles. Ready/network-idle observation: 2.78 seconds. This is not a physical-phone measurement.
- Captured first scene resource bodies: approximately **1.48 MB** in development, comfortably below the initial 10 MB budget for house art. Network speed was local; these timings are not internet-load predictions.
- Conservative gzip sum of all production JS/CSS/font assets, including routes not initially loaded: approximately **0.46 MB**. Geometry/facade/house textures are procedural and transfer no model files. Uploaded advertiser artwork adds real image traffic; the result is not a promise for a fully populated image-heavy scene.
- Instancing facade floor bands reduced observed desktop draw calls from 566 to 441 (about 22%). It did not materially improve mean FPS in this sample. The desktop 60 FPS aspiration is not fully met on this host; low quality is available. Physical midrange-phone and hosted production measurements remain required.

## External acceptance still required

Supabase production authentication/storage/RLS and backup restore; real Dodo test checkout, tax, signed-webhook delivery and confirmed full refund; provider-confirmed partial-refund tax receipts; merchant acceptance before live mode; operator support/identity/privacy/retention decisions; host worker monitoring; and physical-device/hosted performance acceptance. `docs/deployment.md` gives the exact environment, product, webhook, storage and worker configuration. The Docker deployment has not been run on a remote host.

The source and local end-to-end product are implemented. This record does **not** certify production readiness or claim that simulation validated the real provider.

## Direct checkout update ? 2026-09-13

The advertiser flow now saves validated artwork and proceeds directly to pricing and payment, without an operator approval action. The existing status vocabulary, placement IDs, purchases and immutable versions are preserved. Older verification entries above describe the earlier approval-based flow.

Validation: all 24 database/inventory tests passed; all four product browser scenarios passed against an isolated simulation database on port 3001. Template artwork on tsq-013 and uploaded artwork with an empty hidden template headline on tsq-072 both completed sign-in ? direct checkout ? verified simulated display ? second visitor ? refund. Uploaded artwork returned 404 to a second visitor before payment and 200 after display. Ownership, legacy rejected/pending version denial, invalid URLs, signed webhooks, mobile panels and private-data access checks passed. Lint and the production build passed. No Dodo charge or refund was issued in these checks.

The normal localhost:3000 app remains configured for Dodo test mode. Browser payment tests require simulation mode and accept PAPER_TEST_ORIGIN for an isolated server; PAPER_TEST_ORIGIN also selects a separate .next-e2e build directory. Screenshots: artifacts/direct-checkout-tsq-013.png and artifacts/direct-checkout-tsq-072.png.
