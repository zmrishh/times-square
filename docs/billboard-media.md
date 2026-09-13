# Billboard image and video uploads

The editor offers **Image / logo** and **Looping video**. New creatives start with an upload; there is no template option. Brand details appear in the detail panel rather than on top of the supplied media. Existing purchased template versions, IDs, ownership, financial records and creative assignments remain readable and render unchanged.

Each placement shows its reduced aspect ratio and recommended even pixel dimensions. Recommendations respect the video pixel-area limit, including square and portrait placements. One continuous asset spans a wraparound slot, with shared UV mapping and a single video texture/player. New uploads use full-screen cover cropping; horizontal and vertical crop controls match the editor and the square. Transparent logos use the selected background color.

## Accepted media

- Static PNG/JPEG/WebP, up to 4,000,000 bytes, 64–6000 px per side, at most 16 MP. Server decoding strips image metadata and stores optimized WebP.
- H.264 MP4, up to 4,000,000 bytes, 30 seconds, 60 fps, 64–1920 px per side and at most 2,073,600 pixels. Baseline, Main and High 8-bit profiles are supported. Export other formats before uploading.
- The browser decodes a real first frame before upload. The server parses and bounds video tracks, dimensions, duration and packet count/data, then remuxes only H.264 video with fast-start placement. Audio and container tags are omitted. The accompanying poster is independently decoded and validated.
- The upload request, including its bounded poster, fits below Vercel's function request-body limit. There is no native FFmpeg runtime requirement. [Mediabunny packet sources](https://mediabunny.dev/guide/media-sources), [Vercel function limits](https://vercel.com/docs/functions/limitations).

## Privacy and playback

Media stays private while being drafted, including posters and all byte-range requests. The existing signed-in ownership checks apply before a creative can use either asset. Payment settlement publishes the video and poster through the same asset authorization path as images. Suspended brands/accounts cannot expose their assets through that path.

Videos loop muted and inline. The editor and detail panel have native playback controls and a manual play fallback. Directory/account thumbnails use posters. The square allocates at most three nearby, front-facing, unobstructed video players (two on coarse-pointer devices), using one player for both sides of a wrap. Distant screens use posters. Opening a panel pauses square playback; background tabs pause and disposed screens release textures and video sources. System reduced-motion changes apply immediately, and the existing ambient-motion setting also stops square videos.

## Deployment setup

No database migration or change to advertiser records is required. The existing private Supabase bucket must accept `image/webp` and `video/mp4`, with a per-object limit of at least 4 MB. Run [setup-media-storage.sql](../scripts/setup-media-storage.sql) in the configured Supabase project if the bucket is missing or has an image-only restriction. Use the configured custom name if `SUPABASE_STORAGE_BUCKET` differs from `paper-assets`. The server service-role key performs storage operations; do not grant anonymous direct storage access or make the bucket public.

Hosted Supabase upload acceptance remains a separate integration check: the current session cannot access that project's dashboard or read Vercel's write-only credentials. Local and production-build tests use isolated storage/provider fixtures, not customer data. Dodo live activation is unchanged.

## Executed evidence

- `npm test`: 36 passed, including real MP4 demux/remux, omitted audio/tags, invalid media, all 72 ratio recommendations, crop transforms and byte-range edge cases. Existing financial invariants and legacy creative coverage pass.
- `tests/e2e/audit.spec.ts`, `product.spec.ts`, `media.spec.ts`: 12 passed against a fresh local simulation database. Covers image and video upload → sign-in/draft recovery → payment → another visitor → refund, flat and wraparound video textures, actual time progression and loop reset, private poster/range access, reduced motion, mobile/fallback and permissions.
- Edge viewport checks at 360, 390, 768, 1366 and 1920 px passed with no serious/critical axe findings. The mobile video editor passed all checked axe rules. Physical iOS/Safari playback has not been verified.
- Production build/TypeScript and targeted ESLint passed. The pre-existing Three CJS warning arises from the TS test runner; the production bundle uses ESM.
- Production-mode fixture checks exercised MP4 upload via the actual API, private/public media access, browser checkout, signed webhook settlement, duplicate/out-of-order events, refunds and declined-payment returns. Provider and Supabase HTTP responses were isolated fixtures. Browser multipart upload itself was exercised in the development E2E suite; the production harness uploads the same fixture programmatically to avoid cross-host CDP file-body truncation.
- Final production smoke passed with zero browser errors and zero serious/critical accessibility findings across payment returns, account and four mobile admin panels. Corrected selected-tab hover contrast. Repeated fixture runs select an unused decline-test slot to respect existing reservation grace periods. Storage setup SQL passed repeat execution and preservation checks against an isolated PostgreSQL-compatible bucket table.
- Local evidence: `artifacts/media/mobile-video-editor.png`, `mobile-wrap-video.png`, `artifacts/video-playing-tsq-036.png`, `artifacts/e2e-results.json`; generated evidence stays ignored by Git.

The MP4 fixture in `tests/fixtures/loop.mp4` is an original one-second FFmpeg test-pattern/sine-wave clip, generated solely for tests. No sponsor, upload or payment is fabricated on the public site.

Rollback requires care once video creatives have been purchased: retain video rendering and asset authorization when reverting unrelated UI changes. Reverting to an image-only release would prevent those videos from displaying; no rollback should delete their records.
