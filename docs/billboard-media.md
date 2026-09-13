# Billboard media, pricing and demo clips

The editor offers Image / logo and Looping video, with exact aspect ratio, recommended dimensions and full-screen crop controls. One continuous creative spans corner displays. Existing purchased templates remain readable; new advertisers are not offered templates.

## Media and storage

- Images: PNG/JPEG/WebP up to 4,000,000 bytes, 64-6000 px per side, at most 16 MP. Sharp validates, removes metadata and stores WebP.
- Video: H.264 MP4 up to 50,000,000 bytes, 30 seconds, 60 fps, 64-1920 px per side and at most 2,073,600 pixels. Baseline/Main/High 8-bit video; optional AAC-LC mono/stereo audio at 8-48 kHz.
- The browser extracts a real poster. The server bounds both tracks, removes source tags and remuxes fast-start MP4. No FFmpeg runtime is required in production.
- Videos upload directly to private Supabase storage using signed, path-specific TUS tokens. Six-MiB chunks retry and resume after interruptions. The TUS client loads only when uploading. Large request bodies never pass through Vercel; the legacy small-upload endpoint remains bounded for older clients.
- Finalization verifies the owner, actual size, media and poster before registering assets. Fenced processing leases and attempt-specific objects protect retries. Successful repeated finalization returns the same IDs. Durable cleanup handles expired sources and interrupted attempts.
- Images and small videos use the authorized proxy. Videos over 4 MB receive a non-cacheable redirect to a 15-minute signed storage URL after authorization. Supabase serves ranges directly. A previously issued signed URL remains usable until expiry.

Sources: [Supabase resumable and signed uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [file limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [Vercel limits](https://vercel.com/docs/functions/limitations).

## Pricing

The default takeover minimum is current ranking plus $10. The optional admin double preset remains available for new quotes. Historical quote snapshots are unchanged.

Video adds a separate 50% format fee: a $50 ranking costs $50 for an image or $75 for video, before tax. A $50 leader can be replaced at $60 ranking: $60 image or $90 video for a new advertiser. Only bidding contributions improve ranking. Returning bidding and video credit are isolated to that same brand and placement.

A current image sponsor with $50 ranking pays $25 to upgrade to video, with no extra ranking. Saving a video cannot bypass payment; the paid image remains displayed until authenticated settlement. Refunds proportionately reduce bidding and format credit; refunding a video-only upgrade restores the paid image. Older paid videos are grandfathered. Checkout verifies the reviewed amount before creating payment. Receipts separate video fees from ranking contributions.

## Playback and audio

Visitors enable nearby billboard audio with the sound control or the demo's Walk closer action. Within 24 metres of a billboard's ground projection, audio fades in smoothly, reaching its capped maximum within 5 metres. It pans left/right and stays silent behind the screen, behind an occluding building, or outside the radius. Generated ambient noise was removed.

At most three desktop/two coarse-pointer decoders are active. Nearby audible screens can displace farther players; distant screens use posters. Wraps share one texture, player and audio source. Panels, hidden tabs, mute and reduced motion stop or silence world playback. Disposal releases sources, textures and audio nodes. Editor/details use native controls and start muted; thumbnails use posters.

## Demo inventory

The site owner's supplied OpenAI and Cluely files became labelled 30-second excerpts with normalized AAC audio. Original files remain unchanged under ignored artifacts.

- tsq-026, Marquis skyline: OpenAI preview.
- tsq-009, The daily: Cluely preview.

These are house overlays on available, unowned slots. Both are purchasable; paid creatives automatically replace demos. No brands, payments, fake bids or sponsors are created. Watermarks and detail copy identify demos. Public excerpts and posters are deliberately included under public/demo.

## Deployment and rollback

Before deploying, run [production-video-upgrade.sql](../scripts/production-video-upgrade.sql) in the configured Supabase SQL Editor. It combines migration 008 and the repeatable private WebP/MP4 bucket update to 50 MB. Adjust paper-assets if a custom bucket is configured. The project's global storage limit must also permit 50 MB. Do not make the bucket public.

Continue the authenticated POST worker at least once per minute for reconciliation and cleanup. The API declares a 120-second maximum duration; confirm the hosting plan supports it. Dodo merchant acceptance/live configuration remain separate.

After new payments exist, rollback must retain fee-aware settlement and refund handling. Do not remove financial columns, media or ownership records. See [verification](video-release-verification.md) for executed results and external setup status.
