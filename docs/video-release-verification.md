# Video release verification - 13 September 2026

Scope: 50 MB video uploads, 50% video premium, $10 default takeover increment, proximity audio and two purchasable demo billboards. No live charges, refunds or ownership mutations were performed.

## Executed evidence

- Financial tests exercise $50/$75 pricing, the $10 takeover minimum, slot-local returning credit, paid upgrades, no self-outbids, forged underpayments, proportional refunds, restoration of paid images, immutable fees, migration repeatability, grandfathered videos and reviewed checkout prices.
- An original 8,801,922-byte H.264/AAC test pattern crossed an isolated TUS endpoint. A PATCH deliberately failed; the actual browser client made one HEAD and retried at the acknowledged offset. Every received byte matched the source. The actual app initializer, validator, private asset access and idempotent finalization passed. This is a storage protocol fixture, not hosted Supabase acceptance.
- Web Audio analyser output was zero outside the radius, non-zero after walking closer (RMS approximately 0.005 at about 20 metres), and zero again after walking away/muting. Actual looping demo video and walking controls were exercised in headless Edge. Evidence: artifacts/media/proximity-audio.json and proximity-demo-near.png.
- Final large-upload and proximity regressions passed after lazy-loading the TUS client. Both demo clips were separately observed playing, looping and initially muted; screenshots at 1366 and 390 pixels were inspected, with visible demo labels and enabled claim actions. Evidence: artifacts/media/demo-playback.json, demo-tsq-026-1366.png and demo-tsq-009-390.png.
- Image/video draft, sign-in, payment, second-visitor and refund journeys passed in isolated simulation, including a continuous corner video and reduced-motion handling.
- All 43 unit/database checks passed. The production build, TypeScript and full ESLint run passed. The test runner emits a Three.js CommonJS deprecation warning; application Three imports use ES modules.
- Thirteen product/media/permission/upgrade/browser checks passed, including WCAG scans at 360, 390, 768, 1366 and 1920 pixels. The additional large-upload and proximity checks passed separately. A current $50 image sponsor paid exactly $25 to upgrade, retained $50 ranking, and received the video after settlement.
- The final production-build smoke script passed against isolated Supabase/Dodo HTTP fixtures: private video upload, checkout, signed duplicate/out-of-order events after closing the browser, exactly one delivery, receipts, failed payment, refunds and account/admin boundaries. All eight captured states had zero axe violations and no recorded browser errors. Evidence: artifacts/audit/production-smoke.json and production-*.png. This does not establish real provider acceptance.
- Storage SQL was repeated against an isolated PostgreSQL-compatible bucket table; broader existing MIME/size allowances were preserved and the bucket remained private. Migration 008 was repeated after fixture purchases without repricing them.

## External setup and coverage gaps

The production SQL update is prepared but not confirmed applied. This session has no connected Supabase admin dashboard or readable production database credentials. New code must not deploy before migration 008 is present.

Hosted Supabase TUS, cross-origin signed playback, real Dodo test-provider acceptance and physical Safari/iOS audio remain unverified. Provider fixtures are not real provider payments. Browser tests use Edge/Chromium on Windows, including simulated mobile/touch viewports; they do not establish physical-device performance.

Screenshots, test-only generated clips, traces and provider fixtures remain under ignored artifacts/.data directories. The two deliberately public demo excerpts are under public/demo.

## Reproduce locally

Use the isolated simulation environment described in the existing audit instructions; never point financial tests at production. Run `npm test`, `npm run lint`, `npm run build`, then the relevant Playwright files under tests/e2e with PAPER_TEST_ORIGIN set to that isolated server. The large-video test generates its test-pattern MP4 through scripts/create-video-test-fixture.mjs if absent; FFmpeg must be on PATH (or set FFMPEG_PATH). Production uses the JavaScript media validator, not FFmpeg. scripts/capture-video-demos.mjs captures both demo detail views and records actual looping playback. The provider smoke uses scripts/audit-db.mjs and scripts/audit-production-start.mjs; all provider sessions and storage remain fixtures.
