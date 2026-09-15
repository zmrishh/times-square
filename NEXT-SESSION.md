# Handoff ? September 15, 2026

## Current objective and result

The user requested live checkout verification, simpler How it works copy,
Twitter/Open Graph previews, and a clear $10 offer beside the main CTA.
Read-only provider/ledger verification confirms an existing live checkout and
payment succeeded for TSQ-013, with matching amount/tax, processed payment
webhook, allocation and display history. No new charge or refund was made.
The stale public disabled-payment warning is replaced by payment-mode-aware
copy. How it works has four short steps; detailed rules remain separate.
The header and introductory purchase CTA explain the virtual billboard offer.
Homepage previews use a real 1200×630 city screenshot, and homepage/billboard
links both have complete Open Graph and Twitter metadata.

The final branded domain is still awaiting the user's answer. Vercel lists
`zmrish.com`, but no choice for this site's branded domain was supplied. Do not
guess or change Auth/checkout/webhook origins without that choice. Canonical
and social URLs follow the configured `APP_ORIGIN` (currently the public Vercel
URL below). Google login remains configured in Supabase; SMTP is not needed.
Never print credentials from environment files.

Verification scripts: `verify-live-payments.mjs` (read-only hosted/provider
check), `verify-launch-local.mjs` (isolated UI checks plus screenshot capture),
and `verify-launch-ui.mjs` (`PAPER_TEST_ORIGIN` selects local/live site).
Evidence is in `artifacts/audit/live-payment-verification.json` and
`artifacts/launch`. Desktop 1366px, tablet 820px and touch mobile 390px passed;
no horizontal overflow or page errors. Twitterbot HTML includes all preview
tags in its head and both linked images return HTTP 200. Local typecheck,
focused lint and production build passed. Bank payouts, live refunds and
separate merchant-approval correspondence were not checked.
The same UI/metadata checks passed on the public production URL after promotion
to `dpl_GqoHt8MLBFrZTDUena9gzqUxa9Pu`; the launch screenshots and JSON now reflect
that live run. Payment configuration and recent scheduled worker checks passed
during deployment. Branded-domain selection is the only outstanding user input.

## Live deployment

- Website: https://newyorkcity-kappa.vercel.app
- Vercel project: `timessquare`, team: `zmrishhs-projects`.
- Promoted deployment: `dpl_GqoHt8MLBFrZTDUena9gzqUxa9Pu`
- Deployment URL: https://timessquare-ixbeu5dfp-zmrishhs-projects.vercel.app
- Production presents **Continue with Google** instead of an email form.
- Local simulation retains the development email-code form.
- Google OAuth credentials stay in Supabase; no SMTP or Resend key is needed
  for Google login. The user has a Resend key but has not supplied it here.

## Entry media and red staircase update — September 15

The user reported images/videos appearing only after walking, asked to remove
the moving capsule people, and requested a better red staircase. The live
baseline showed scene readiness before any media request: `/api/public` only
arrived after hydration, followed by posters and video. The page now supplies
the public snapshot from the server and preloads nearby image/poster sources.
Billboards render an initial 512px texture before adaptive resolution updates;
video eligibility is evaluated on its first frame. Scene readiness waits for
the initial in-frame billboard textures or video frames. Slow media requests
complete without camera movement. Existing inventory polling remains active.

Removed all 36 animated capsule figures, retaining taxis and the fixed Duffy
monument. Rebuilt the TKTS staircase as 27 solid ruby-red steps with highlighted
edges, glass side balustrades, slender rails, TKTS signs and a pale base.
Updated its walking collision bounds to match the wider structure.

`node scripts/verify-entry-local.mjs` runs an isolated development server and
checks desktop/mobile entry with no input, deliberately held media requests,
and reduced-motion posters. It also captures the steps. All three cases passed
with no browser errors. Evidence: `artifacts/media/entry-scene-checks.json`,
`entry-fixed-*.png`, and `red-steps-updated.png`. `verify-entry-scene.mjs` can
also run against `PAPER_TEST_ORIGIN` for read-only deployed verification.

All 57 unit/integration tests, typecheck, focused ESLint, production build,
read-only payment/worker deployment checks and candidate health passed. This
update was promoted to production as `dpl_26Y8y7xi5zgbZ8coPQhhRTBQz2kj`.
The same no-input browser checks passed on the public production URL, including
touch mobile with held media requests and reduced motion; no page errors.
The evidence JSON and screenshots now contain the production run. Loading still
depends on network speed; the fix preloads artwork and prevents premature scene
readiness rather than promising instantaneous downloads.

## TSQ-007 video and bidding audit ? deployed September 15

The user supplied the Steve Jobs 2007 iPhone introduction clip in `artifacts`
and requested it on TSQ-007, The corner. Live readback confirmed this placement
was unclaimed with a $50 opening ranking. The full 54.6-second H.264/AAC clip
was remuxed without re-encoding to `public/demo/iphone-2007-introduction.mp4`;
its poster is `public/demo/iphone-2007-introduction.webp`. It is house/demo
artwork in `DEMO_BILLBOARDS`, automatically superseded by paid creative.
No paid placement or fake ranking was created. The original source is intact.

The user also requested verification of takeover rules. Current production
preset is `quarter`, which means current ranking plus $10. The optional `double`
preset had a sub-$10 edge case: its increment could fall below $10. Fixed
`nextMinimum` to use at least $10 in both presets, with matching rules copy.
Existing quotes/payments were not repriced or modified.

All 57 tests passed, including new `tests/bidding-policy.test.ts` scenarios for
an occupied TSQ-007: rejecting $109.99 against $100; competing $110 reservations;
incumbent remains until settlement; a returning $100 contributor pays $20 to
reach $120 after a $110 rival; duplicate settlement; self-bid rejection; and
placement-local credit. Also tested a one-cent remaining ranking after a refund
under the double preset, requiring $10.01 rather than $0.02. Existing refund,
dispute, tax/video-fee, invalid-provider-evidence, and expiry tests pass.

Typecheck, focused lint, build, health, and read-only live payment/worker checks
passed. The video plays in both panel preview and 3D scene on desktop and mobile,
locally and on production. No real test purchase or refund was made.
Evidence: `artifacts/audit/bidding-policy-checks.json` and
`artifacts/media/demo-playback.json` (latest is live).
Commands: `node scripts/verify-corner-video.mjs` for isolated playback;
`PAPER_DEMO_SLOT=tsq-007` restricts `scripts/capture-video-demos.mjs` to this slot.

## Profile recognition fix ? deployed September 15, 08:33 UTC

The user reported that the profile icon requested sign-in after Google login.
The old handler relied on the cached `me.account` immediately, even when session
loading had not completed or failed. It also only refreshed on focus during the
old email-link flow. The profile now opens an account-loading panel, refreshes
`/api/me`, and asks for sign-in only after a successful anonymous response.
Errors offer retry; focus, visibility, and pageshow refresh account state. A
signed-in user sees their initial in the header avatar. Login completed in a
second tab is recognized on focus, and cross-tab sign-out is also recognized.

The Google button now uses a white pill shape, Google's official gradient logo
(`public/google-g.png`), self-hosted Google Sans, focus/hover states, and loading
feedback. Styles are isolated in `src/components/google-sign-in.module.css`.

Validation: 8 focused unit tests, typecheck, ESLint, production build, and health
passed. The expanded isolated browser fixture passed profile loading delays,
reopening, failed lookup/retry, cross-tab login/logout, and explicit sign-out,
in addition to the earlier Google/draft/checkout scenarios. The deployed UI also
passed delayed profile recognition using a mocked account response, and the
real Google redirect still reached the Google sign-in page. This did not use the
user's Google account or inspect their cookies. Google Sans emitted a harmless
build warning about missing fallback font metrics; the font loads correctly.

## Authentication behavior

- POST `/api/auth/google` checks origin, rate-limits starts, saves a browser-bound
  PKCE verifier in an HttpOnly cookie, and returns the Supabase authorize URL.
- Google redirects to `https://mgbchdkttxrrjywqgybh.supabase.co/auth/v1/callback`.
- Supabase returns to the site's `/auth/callback`, which verifies the Google
  identity, creates the HttpOnly app session, and restores the destination.
- Existing app accounts are matched by verified email, preserving their records.
- The editor draft is saved before leaving. Cancellation retains the destination;
  retry waits for the saved draft to load before writing it again.
- Provider access/refresh tokens are not stored in browser storage.
- Old email callbacks still work when their browser verifier is available.
  The previous email resend fixes are also included in this deployment.
- Default Supabase email remains limited to two sends/hour and project-team
  addresses. It is no longer the production sign-in UI.

## Validation

- All 55 automated tests passed; type checking and focused ESLint passed.
- The isolated browser fixture passed Google button, PKCE exchange, saved draft
  and billboard restoration, cancellation/retry, HttpOnly session cleanup,
  invalid callback, cross-origin start rejection, mobile UI, and checkout return.
  Report: `artifacts/audit/google-sign-in-flow.json`.
- Vercel production build and candidate health passed. Read-only build checks
  confirmed the live payment schema/product and active scheduled worker.
- Live mobile Google button and the actual Supabase-to-Google redirect passed.
  Google accepted the OAuth configuration and displayed its sign-in page.
  Report: `artifacts/audit/google-sign-in-live.json`.
- **Still needs the user:** complete a real Google account sign-in, including
  returning to a saved draft. No automated test entered Google credentials or
  completed real consent. Google audience/testing restrictions have not been
  checked for other users; configure test users or public audience as needed.

Useful checks:

```powershell
npx tsx --test tests/auth-provider.test.ts tests/api-client.test.ts
npm run typecheck
node scripts/verify-google-sign-in.mjs
node scripts/configure-supabase-auth.mjs
node scripts/verify-google-live.mjs
```

The isolated browser script starts and cleans up its own app/provider processes
and uses no hosted data or payments. `verify-email-link.mjs` tests the old UI and
is no longer the production browser acceptance command.

Primary files: `src/server/google-auth.ts`, `src/server/email-link.ts`,
`src/server/auth.ts`, `src/app/auth/callback/route.ts`,
`src/app/api/[...path]/route.ts`, `src/components/paper-square.tsx`.
Setup details: `docs/auth-setup.md`.

## Access and preservation

- Supabase project: `mgbchdkttxrrjywqgybh`.
- The ignored `.env.supabase-admin` contains the management token and project
  URL. Use privately; never print or commit their values.
- Vercel runtime secrets are sensitive; blank exports do not imply missing
  settings. Never overwrite them based on an empty export.
- Live Dodo payments use `paper_live` and private `paper-assets-live`; tests use
  `public` and `paper-assets` in the same project. Preserve this separation and
  the active minute-by-minute worker.
- The workspace still contains many uncommitted earlier deployed changes.
  Do not reset, clean, or revert them. They include entrance music, GTA/iPhone
  billboards, welcome animation, connection recovery, and live-payment setup.
- Sound is enabled by default with a mute option. Do not add an entry button.
- Read installed Next.js docs before editing its APIs.

Deployment pattern after checks:

```powershell
vercel deploy --prod --skip-domain --yes --build-env PAPER_APPLY_VIDEO_UPGRADE=0 --build-env PAPER_PROVISION_LIVE=0 --build-env PAPER_CHECK_PAYMENT_DEPLOYMENT=1
vercel promote <checked-deployment-url> --yes
```
