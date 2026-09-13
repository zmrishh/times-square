# Master build prompt: walkable Times Square billboard bidding

Build the complete application described below. Working name: **Paper Square**. Keep the name, domain and copy configurable.

You are acting as a senior creative developer, 3D environment artist, product designer and full-stack engineer. Deliver a working, polished product with real persistence and a complete Dodo Payments test-mode integration. Start implementing after a short plan. Continue through integration, verification and fixes. Do not stop at a scaffold, landing page, mock dashboard or implementation proposal.

Make sensible implementation decisions and document them. Ask only when a missing answer materially changes the product or an external action actually requires authorization. Missing credentials should not stop local development: implement the integration, provide a clearly labeled simulation mode, and identify the exact configuration still required. Never claim a simulated integration was tested against the real provider.

## 1. Product and references

Create an explorable, three-dimensional reconstruction of the recognizable central Times Square streetscape. Visitors walk around for free, discover companies on the buildings' billboards, inspect an advertiser, and visit its website. Advertisers compete for particular billboard surfaces through paid takeovers.

The core loop is: explore the square → notice a billboard → inspect the company or placement → preview your brand there → pay to take the lead → see the billboard change → share its exact location → another advertiser can outbid you.

References:

- https://doodleshooter.vercel.app/ for convincing first-person movement and cohesive ink-on-paper art direction. Use the supplied screenshot if available.
- https://hyrox.marclou.com/ for turning a recognizable 3D object into discoverable, purchasable sponsorship surfaces.
- https://outbid.lol/ and https://outbid.lol/rules for public paid rankings, clear prices, sponsor discovery and cumulative paid ranking mechanics.
- https://www.timessquarenyc.org/ for geographic and visual reference. Research additional current street-level photographs and maps as needed.

Inspect references using available tools. Say which interactions you could actually inspect. Reconstruct the underlying ideas with original code and assets; do not copy proprietary source code or extract assets without permission.

This product sells advertising on this website's own virtual billboards. It does not place ads on physical Times Square screens. State that clearly in the advertiser flow, checkout description and rules. It is independently operated, without implied affiliation with Times Square organizations or building owners.

## 2. Visual direction and geographic fidelity

Use a hand-drawn architectural Times Square rendered as an actual navigable 3D environment:

- Warm ivory paper, deep blue ink, lightly imperfect outlines, restrained crosshatching, subtle paper grain and soft atmospheric depth.
- Full-color sponsor artwork inside the billboard frames. Preserve logos' actual colors, sharpness and proportions. Keep the sketch treatment off the advertising content.
- A predominantly pale, readable city with selective accent colors, including recognizable red steps and occasional yellow taxis.
- Dense, recognizable building silhouettes, layered signage, varied screen heights and shapes, street furniture, pavement markings and carefully placed environmental details.
- Small, lightweight ambient pedestrians and vehicles following sensible routes. These are decorative animation, not real online visitors.
- Restrained motion. Avoid shaky outlines, flashing ads, excessive grain, unreadable hatching, uncontrolled bloom or heavy camera bob.
- Crisp, understated interface typography. Use handwriting only for short optional environmental details, never payment forms or prices.

The environment must read as Times Square even with every advertiser removed. Prioritize the real street arrangement, landmark silhouettes, relative scale, sightlines, Broadway/Seventh Avenue relationship, pedestrian plazas, Duffy Square/TKTS steps and the One Times Square billboard tower. Use a coherent central area approximately spanning West 42nd to West 47th Streets, with background geometry beyond it where useful.

Create a reference-backed scene plan before building the detailed environment. Record the reference URLs, access dates, landmark positions and intentional simplifications. Set one consistent world scale and orientation. Select a hero camera from the researched layout that immediately reveals the square's identity and several desirable advertising surfaces.

Place sellable screens on modeled counterparts of actual billboard-bearing facades. Match their approximate position, orientation, scale and shape from references. Do not scatter floating rectangles around a generic city. Create wide, portrait, stacked and corner/wraparound screen variants where the reference supports them. Group segments of one wraparound display into one advertising slot.

Build all major billboard structures needed for the selected streetscape. Initially activate about 15 especially visible surfaces for bidding. Make additional surfaces explicitly house art or unavailable inventory rather than fake sold placements. Every active slot needs a stable ID, human-readable location, dimensions, aspect ratio, geometry mapping, collision-safe viewing camera and opening price.

Use original procedural/modelled architecture or properly licensed models and textures. Keep asset sources and licenses in the repository. Use reference material to guide geometry; do not embed third-party street-view captures or branded ads as unlicensed scenery. Be honest about approximations. A generic block-city with a Times Square label does not meet the brief.

## 3. First visit and movement

Open directly into the square, with a lightweight loading/poster state and a small dismissible introduction:

“A little Times Square for the internet. Explore the billboards. Put your brand on one.”

Keep the city dominant. Provide a compact header, Explore/Map or Directory control, How it works, Advertise, account access, reset view, quality settings and optional sound. No mandatory login for exploration or sponsor links. Sound starts off.

Support these controls, explained briefly on first use:

| Input | Behavior |
| --- | --- |
| W / S | Walk forward / backward |
| A / D | Strafe left / right |
| Up / Down arrows | Walk forward / backward |
| Left / Right arrows | Turn left / right |
| Mouse drag in the scene | Look around with the cursor still available |
| Optional explicit Walk mode | Pointer-lock mouse look with a subtle center reticle |
| Mouse wheel over the active scene | Gently adjust a bounded viewing zoom/FOV |
| Escape | Release pointer lock and close the active transient view appropriately |
| Touch | Left movement joystick, right drag to look, tap to inspect |

Use human eye height, comfortable walking speed, pitch limits, ground constraints, simple collisions and reliable reset/respawn. Movement must not pass through buildings or leave the modeled streetscape. Avoid the expense of a full physics system unless needed.

Default to cursor-friendly exploration because this is also a shopping interface. In pointer-lock mode, inspect the billboard targeted by the reticle; clicking it releases pointer lock and opens its details. Pointer lock must require an explicit user gesture and recover gracefully if unsupported.

Opening any drawer, modal, input or checkout flow suspends movement. Ignore movement shortcuts while typing. Clear held keys on blur, tab hiding and pointer-lock changes. Dragging the scene must not accidentally click a billboard. Scrolling a form or overlay must never move the camera.

On mobile, use safe-area-aware controls and a bottom sheet. Ensure joysticks, look gestures and billboard taps do not conflict. Also offer a guided camera tour and a fully usable HTML directory so visitors can discover and buy placements without first-person navigation.

## 4. Billboard discovery

Billboards are real scene surfaces with artwork bound to a slot ID. Use accurate picking/raycasting and occlusion. A billboard behind a building or facing away must not respond through the obstruction.

Hovering in cursor mode, or targeting in Walk mode, gently highlights the frame and shows a compact tooltip with company name, short tagline and current leading amount. An empty slot shows its opening price.

Clicking or tapping opens a persistent detail panel with:

- Company name, logo, destination domain, description and optional social link.
- Visit website, share location and view placement actions.
- Billboard name, preview, current paid ranking, next minimum ranking and the viewer's actual checkout amount where relevant.
- Clear “Claim this billboard” or “Outbid this brand” action.
- Public paid history and an explanation of what happens when the current advertiser is displaced.
- A report-listing action.

Make the tooltip subordinate to the clickable panel. Clicking a billboard inspects it; opening the advertiser's external site is a separate deliberate action. Use safe external-link attributes and display the destination domain.

Each slot has a stable deep link such as /?billboard=tsq-007. Loading it moves to a verified safe viewpoint, highlights that billboard and opens its panel. Support browser back/forward and graceful handling of removed or unavailable slots.

Updates propagate to other visitors without resetting their camera or rebuilding the entire scene. Swap only changed artwork and data. Use a restrained takeover animation and an optional factual activity feed based solely on committed payments.

## 5. Advertiser flow and creative editor

Let a visitor select a billboard and build a draft before signing in. Preserve the selected slot, artwork and form state through authentication and payment redirects.

Use a short flow: select placement → create or select brand → preview artwork → submit for approval when required → review exact price and rules → pay → confirmed placement.

Collect company/product name, HTTPS website URL, short tagline, description, logo, optional finished billboard artwork, background/text colors and optional social profile. Suggest useful character limits and enforce them consistently. Allow multiple brands per advertiser account and reuse of an approved brand.

Provide two artwork modes:

1. Template: compose logo, headline, optional short subline and domain within the selected screen's dimensions.
2. Uploaded creative: accept an image, show crop/fit controls and an explicit safe area, and preview the exact billboard aspect ratio.

Show both a large flat preview and the creative on the actual 3D placement. Use the same layout/rendering definition for preview and final texture, including line wrapping and font loading. Never stretch a logo, crop without showing the crop, or allow text to silently overflow.

Start with static PNG/JPEG/WebP uploads, documented byte/pixel limits and server-side validation/re-encoding. Reject active content and unsupported SVG/HTML. Strip metadata and generate optimized display variants. Keep unfinished uploads private; only approved derivatives become publicly readable. Do not accept arbitrary remote image URLs as a shortcut.

Store immutable creative versions. Approve the exact version and destination used by checkout. Default launch mode requires admin approval before payment for new or changed content, so a paying customer is not left awaiting creative review. Once approved, retrieve a fresh price before checkout. Existing approved artwork remains visible while an advertiser submits an edit. Apply approved edits only if that advertiser still leads the slot.

## 6. Explicit bidding rules

Implement ONE coherent model for v1: a separate cumulative paid ranking for each billboard. This is a deliberate product choice inspired by Outbid. Do not mix it with HYROX-style automatic refunds or silently invent another auction model.

- The eligible brand with the highest applied paid total for a slot occupies that slot.
- A new brand pays the full amount needed to lead that slot.
- A returning brand's previous applied spending on that same slot counts toward its ranking; it pays only the difference to its new target total.
- Spending on one billboard never counts toward another. There is no transferable balance, wallet, withdrawal, prize, resale or payout to advertisers.
- No recurring subscription, seasonal reset or automatic rebidding in v1.
- Proposed opening prices are $10 for small screens, $25 for standard screens and $50 for premium screens. These are editable launch assumptions, not validated pricing claims.
- Default increment: the greater of $5 or 25% of the current leading total, rounded up to a whole dollar. Keep the increment policy centralized and configurable; support a 2x takeover preset without duplicating the payment implementation.
- An advertiser may choose a higher target total within configured processor-safe limits. All quotes and calculations are server-authoritative.
- The current leader can edit its approved creative but cannot outbid itself to manufacture activity.
- A placement begins only after verified successful payment and atomic application of that payment. It remains featured until another eligible brand takes the lead or it is removed under the published rules.
- Being outbid does not automatically refund a successfully delivered placement. The displaced brand stays in the sponsor directory and that slot's paid history, with its accumulated total available for a later takeover.
- There is no guaranteed minimum billboard display time, visitor count, click count or revenue outcome. Explain this plainly immediately before payment, alongside the amount being charged. Do not hide it solely in terms.
- Refunds for payment errors, undelivered placements, applicable obligations and admin remediation remain supported. Do not describe payments as unconditionally non-refundable.
- Never promise lifetime hosting or physical Times Square exposure.

Example: the current leader has $100 on a slot. The next minimum ranking is $125. A new brand pays $125 before applicable tax. A displaced brand that already has $40 applied on that same slot pays $85 before tax to reach $125. Display “Your total ranking: $125” separately from “You pay now: $85.”

Use integer USD cents for bid accounting. Taxes, fees and unrelated payments do not increase ranking. Disable discounts and unexpected currency conversion in v1 unless reconciliation explicitly supports them. Snapshot the pricing/rules version on every quote. Configuration changes must not rewrite a purchased quote or reduce existing paid totals.

## 7. Dodo Payments integration

Use Dodo Payments as requested. Read current official documentation and SDK types before implementing. Useful entry points:

- https://docs.dodopayments.com/llms.txt
- https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout
- https://docs.dodopayments.com/developer-resources/checkout-session
- https://docs.dodopayments.com/developer-resources/webhooks
- https://docs.dodopayments.com/api-reference/refunds/post-refunds
- https://docs.dodopayments.com/miscellaneous/merchant-acceptance

Use a correctly configured one-time Pay What You Want product with a server-created checkout session and an explicit cart amount. The public bid form chooses a target total, but the server computes the amount actually payable. Do not expose a mutable payment URL as the source of truth, create a product for every bid, or use subscriptions for these purchases.

Keep credentials and webhook secrets server-side. Include environment examples, test/live separation, product configuration steps, webhook setup and a canonical application origin. Construct return URLs from trusted deployment configuration. Production payment/auth redirects must never point at localhost, 127.0.0.1 or an arbitrary request-supplied host.

Store internal quote, listing, slot and checkout IDs before redirecting. Add non-sensitive correlation metadata supported by Dodo. The payment-success return page reads the authenticated user's server-side status. A URL parameter, browser callback or client response must never grant a billboard.

Validate provider payment identity, environment/business, customer binding, product/line items, expected subtotal, currency and quantity against the stored quote. Account for taxes separately. Use verified webhooks and authenticated server-side reconciliation as financial evidence.

Dodo's merchant-acceptance policy includes restrictions on gaming/virtual-goods environments and certain business models. This explorable advertising product must be described honestly for review. Implement the complete test-mode integration now; enable live charging only after the operator has confirmed acceptance for this exact product. Do not rename or conceal functionality to bypass a restriction. Outbid using Dodo does not establish approval for this application.

## 8. Payment correctness and competing checkouts

Treat successful payment and billboard ownership as separate states that must be reconciled safely.

Before checkout, validate authentication, content approval and the proposed target. Acquire a short database-backed reservation for this slot and its current version. Store an immutable quote with the advertiser's existing total, target, amount due, approved creative version and expiry. A slot can have at most one active checkout reservation. Rate-limit reservations so someone cannot indefinitely block inventory.

Keep database transactions short. Do not hold a row lock open while calling Dodo. Persist intent first, perform external calls outside the transaction and reconcile the result. Repeated clicks or retries must reuse or safely resolve the same checkout intent.

While a reservation is active, keep the existing sponsor visible and show competing buyers a clear temporary checkout state. Release abandoned reservations through durable scheduled work. Reconcile provider status before recycling an expired reservation, including a bounded settlement grace period. Define the cutoff explicitly.

On verified success, use a database transaction to check the quote/reservation/version again, record the payment once, update that brand's applied total, assign the leader, record history and enqueue public updates/notifications. There must never be two active leaders for the same slot.

If a stale, expired, mismatched or superseded checkout nevertheless collects money and cannot deliver its promised placement, do not silently keep the money or place the brand on another screen. Record the undelivered payment and arrange a full refund, including the buyer-paid tax treatment supported by Dodo. Show accurate pending/refunded/failed states and alert the operator when intervention is required.

Use raw request-body webhook verification with the official SDK's verified path. Reject invalid signatures. Deduplicate both event IDs and business operations by payment ID; different events about one payment must not apply the amount twice. Handle duplicates, out-of-order events and retries without regressing final state.

Persist verified events durably before acknowledging them. Use a durable outbox/job mechanism for processing, emails, refunds and realtime publication. Do not use unawaited background promises or in-memory queues as the sole implementation on serverless hosting.

Separate checkout, payment, placement and refund state machines. Refund initiation is not refund completion. Handle failed refunds, partial/full refunds, disputes and chargebacks. Define how refunded principal reduces an applied paid total and atomically recomputes the eligible leader; do not leave refunded money supporting a rank. Show suspended/disputed listings consistently and prevent dishonest history rewriting.

Run periodic reconciliation for stuck checkouts, unprocessed paid orders, missed events and refunds. Use provider idempotency where documented. If an external request times out with an ambiguous result, reconcile before repeating a financial mutation. Implement retry limits and an actionable failure queue.

## 9. Architecture, persistence and access

Inspect an existing repository first and preserve useful conventions. For a new project, default to a compatible current TypeScript/React/Next.js stack, Three.js with React Three Fiber and Drei, PostgreSQL, and Supabase for authentication/storage where appropriate. Use a small durable job solution suitable for the selected hosting. Verify compatible versions, pin dependencies and retain the lockfile. Avoid unnecessary services.

Keep the scene, billboard registry, creative renderer, auction rules, payment adapter and persistence logic modular. The camera/game loop must not depend on React rerenders for every frame. The 3D view consumes public state; it never determines financial truth.

Provide migrations, seeds and explicit relationships for accounts/roles, brands, creative versions/moderation, billboard definitions, per-slot brand totals, quotes/reservations, checkout orders, payments, applied payment allocations, placement history, webhook events, refunds/disputes, outbox jobs, analytics aggregates and admin audit records. Combine tables when appropriate without losing financial traceability.

Use constraints for single leaders/reservations, unique provider payment IDs, unique processed operations, foreign keys and valid monetary values. Enforce ownership and admin roles server-side on every sensitive operation. If using Supabase, enable and test RLS and storage policies. Never ship a service-role key to the browser.

Public APIs and realtime subscriptions expose only approved sponsor information, slot state and intentionally public bid history. They must not leak emails, checkout metadata, payment identifiers, private assets or admin events. Handle reconnects, stale snapshots and out-of-order public updates with monotonic versions.

Do not use localStorage as the database. It may store movement preferences or an anonymous draft reference, not verified payments, ownership or authoritative bid totals.

## 10. Accounts, dashboards and administration

Use low-friction email authentication and optionally Google sign-in. Preserve drafts and return destinations across sign-in. Protect redirects and account recovery. No public admin registration or client-editable admin role.

Advertiser dashboard: brands and approved/pending creatives, current and displaced placements, totals by slot, receipts, payment/refund status, actual display periods, measured views/clicks, edit creative, return to billboard, rebid and download/share placement image. Show meaningful empty, pending, rejected and error states.

Admin dashboard: creative approval/rejection with reasons, brand/user moderation, inventory availability, opening prices/increment configuration, payment/refund/dispute records, reservation cleanup, replay/reconciliation actions, analytics and an immutable audit trail. Provide a global pause for new checkouts while exploration remains available. Warn about consequences before a real refund or paid-placement removal.

An admin cannot invent paid history, mark a real order paid without provider evidence or silently change financial ownership. Refund/removal workflows must recompute eligible rankings and publish the correct result. Keep demo and house placements explicitly labeled and excluded from commercial metrics.

## 11. Discovery, sharing and measurement

Build a searchable, accessible sponsor directory with category filters, active-placement indicators and links to the exact billboard. An outbid sponsor remains discoverable there. Provide a compact map/slot list, recent real takeovers and a leaderboard based on clearly defined net applied spending.

Add a share action that opens the native share sheet or copies a link, plus a downloadable screenshot/postcard showing the real creative on its actual billboard. Make asset delivery compatible with canvas export. Include brand/slot-specific social previews with correct text and honest artwork; do not claim a live 3D render if a fallback image is used. Do not auto-post or auto-contact anyone.

Track visits, qualified billboard views, panel opens and explicit outbound clicks. A scene load is not automatically an impression for every billboard. Define a view using on-screen size, a visibility duration and an occlusion-aware approximation; pause tracking when the tab is hidden. Explain the measurement method and limitations. Debounce, deduplicate and filter obvious bots and self-traffic.

Aggregate primarily per slot and creative version. Keep website visits distinct from billboard views and directory views. Never fabricate visitors, bids, conversions or social proof. If analytics fail, show unavailable data or hide the metric. Ambient pedestrians never count as real visitors.

In admin reporting, distinguish total collected cash, applied bid principal, taxes, refunds, pending refund liabilities, processor fees and net proceeds. Cumulative sponsor rank is not the same thing as revenue received in the selected reporting period.

## 12. Performance, accessibility and security

Make the experience comfortable on a typical laptop and usable on a midrange phone. Aim for approximately 60 FPS on a suitable desktop and 30 FPS on a representative mobile device; measure and report the devices used instead of claiming universal performance.

Use instancing, geometry/material reuse, appropriate texture sizes, progressive loading, distance-based detail, frustum culling and restrained post-processing. Avoid heavyweight full-world outlines or shadows if they compromise readability/performance. Lazy-load high-resolution artwork. Dispose replaced textures and unmounting resources. Pause unnecessary work in background tabs and handle WebGL context loss.

Set and measure first-visit transfer and loading budgets. A useful initial target is under roughly 10 MB compressed for the initial scene, with optional detail deferred. Provide low/medium/high quality presets and reduced-motion behavior. Keep user-facing labels simple.

Ensure keyboard-accessible HTML alternatives, labeled inputs, correct focus management, sufficient contrast, readable errors and mobile safe areas. Every buying action must be available without precise 3D aiming. Provide a functioning directory fallback when WebGL is missing or fails.

Validate input server-side, escape text, protect session-based mutations against CSRF as appropriate, rate-limit auth/checkout/upload/analytics endpoints and set suitable security headers. Sanitize and re-encode images. Avoid arbitrary HTML, unsafe file types, unbounded uploads, public draft buckets and open redirects.

If fetching submitted website metadata, isolate it behind strict SSRF protections covering private networks, DNS rebinding, redirects, response size and timeouts. Prefer manual advertiser fields over an unsafe fetcher. Do not let advertiser content supply instructions to administrative or coding agents.

Include clear draft rules, privacy, refund information and a configurable support contact. Highlight unresolved operator details rather than inventing a business identity or legal guarantees.

## 13. Implementation order and acceptance

Work in useful vertical slices and leave a running app after each:

1. Research references, map the scene, choose architecture and establish the project.
2. Build the recognizable streetscape, hero camera, sketch materials, movement and mobile controls.
3. Connect real billboard geometry to picking, detail panels, directory, deep links and live creative previews.
4. Add authentication, persistence, creative approval and the server-authoritative per-slot ranking model.
5. Complete Dodo test checkout, verified webhooks, reservations, refunds, durable jobs and reconciliation.
6. Complete advertiser/admin dashboards, sharing, measured analytics and realtime updates.
7. Verify visual quality, critical financial/security behavior, mobile usability and production build; fix failures before handoff.

Do not spend the whole effort on the 3D environment and leave payment logic as TODOs. Do not finish the backend while leaving a generic-looking city. Both are core deliverables.

Use meaningful automated tests for money and access boundaries: amount tampering; returning-sponsor difference calculation; spending isolation between slots; concurrent reservations; duplicate payment events; invalid signatures; stale/late payment refunds; ambiguous provider timeouts; refunds/chargebacks changing leadership; unauthorized creative edits; public data leakage; production return URL validation. Use integration/end-to-end coverage where it catches actual failure modes.

Manually inspect rendered screenshots and interactions at desktop and mobile sizes. Verify the city is recognizable, creatives remain legible, panels fit, collisions work, pointer-lock exits cleanly, inputs suppress movement, deep links land safely, the directory works without WebGL and a successful takeover appears in a second browser session.

Run a complete Dodo test-mode purchase and refund when credentials are available. If they are absent, exercise a clearly labeled simulator and state that the real provider test remains outstanding. Never expose simulation endpoints or admin shortcuts in production. Demo fixtures must not become fake paid sponsors on a live deployment.

Deliver the application source, assets/license notes, migrations/seeds, environment example, setup/run instructions, test results, screenshots and deployment instructions for the chosen host. Include the required durable worker/scheduler, auth callback URLs, Dodo product/webhook/return URL setup, storage policies and operational recovery steps. Provide a concrete preview when the environment supports it. Do not enable live payments or publish externally without the applicable authorization.

End with a concise handoff stating what works, what was tested, the preview or run command, and the exact remaining external setup. Do not call the product production-ready if any payment, persistence, access-control or visual acceptance requirement is incomplete.

The quality bar: a visitor immediately recognizes Times Square, enjoys exploring it, understands what each brand does and can find the exact billboard worth paying for. The advertiser sees the actual creative before purchase and pays a clearly explained amount. Every successful charge is traceable to a delivered placement or a tracked refund, and the visual experience remains smooth and distinctive.
