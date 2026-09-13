# Expanded Paper Square

Implemented September 13, 2026. **72 distinct purchasable slots, 57 added.** The two multi-mesh wraparounds each count as one slot. The original IDs `tsq-001` through `tsq-015`, their dimensions and commercial associations are preserved. Slot 15's viewing position moved outside the expanded tower footprint.

## Reference review and composition

Reviewed the Times Square Alliance's [advertising inventory and photographs](https://www.timessquarenyc.org/business-community/advertisement-sponsorships), including its [southward square photograph](https://cdn.prod.website-files.com/66026f9a23bc03c74d23035a/671818c624d466e90e5d025a_Advertising%20Screens.avif), and an [EarthCam street-level view beside TKTS](https://www.earthcam.com/hof/newyork/timessquare/1773777617107_90.jpg). The south view shows layered wide displays, tall portraits and shopfront signage; the TKTS view shows large corner displays and substantial advertising frontage around the steps. These informed the authored geometry rather than an attempt to reproduce current advertisers or exact real-world inventory. Reference images are not served by the product.

Side buildings move six metres toward the corridor. Human eye height remains 1.72 m and initial FOV remains 65 degrees. Collision geometry follows the revised buildings and tower piers. Marquis, Astor, 1540/1530/1500 Broadway and the north landmark each have different compositions of portraits, galleries, tickers, marquees and return-wall displays. The tower gains two advertising piers, a low ribbon and a supported rooftop screen. North Star screens occupy the west elevation beside the red steps so they face visitors instead of being obscured by the next building.

Original house artwork combines ten illustrated motifs with 24 typographic treatments and the existing palette. Every house image is labeled **HOUSE ART · UNSOLD**. Only unclaimed, single-surface ticker art animates; reduced-motion and hidden-tab states stop it. Availability and prices come from real inventory. No advertisers, money or activity were invented.

## Inventory and rendering

- Registry-driven selection, location names, dimensions, previews, directory entries and deep links apply to every slot. Map pins represent building clusters and expose the individual placements in a filtered list, avoiding overlapping pins for stacked screens.
- A single continuous UV interval spans each wraparound's physically connected segments. Both use equal pixels per metre; uploaded artwork retains the existing contain/cover controls. Detail dimensions show the combined width.
- Migration 006 inserts missing IDs only. It was replayed twice against the existing local database with the app stopped. Hashes of the original 15 slots and all existing brands, creatives, orders, payments, allocations, totals, history and refunds were unchanged. See [migration evidence](../artifacts/density/migration-verification.json). Subsequent explicitly labeled browser simulations create their own test transactions.
- Billboard frames and mounting supports use one instanced mesh. Pavement markings also use an instanced mesh; existing floor-band and pedestrian instancing remains.
- GPU artwork uses 256/512/1024-pixel longest-side levels according to screen size and distance; inspected/previewed artwork can use 1536. Replacement textures are disposed after the new material commits. Uploaded assets have authorization-preserving 256/512/1024/2048 derivatives. Directory thumbnails render only when near the scroll viewport, at a 384-pixel maximum dimension.

## Matching visual captures

No screenshot attachments were available in the conversation or workspace. The substitute comparison uses three repeatable existing camera positions: opening `[-4,1.72,-49]`, central `[1,1.72,34]`, and steps `[3,1.72,-46]`. Both passes use the same initial lens and look directions, the same fixed drag for the steps, device scale 1, reduced motion, and dismissed intro/detail overlays. Captures are 1440×960 and 390×844.

- Opening: [before](../artifacts/density/before/1440-opening.png) / [after](../artifacts/density/after/1440-opening.png).
- Central tower: [before](../artifacts/density/before/1440-central.png) / [after](../artifacts/density/after/1440-central.png).
- Red steps: [before](../artifacts/density/before/1440-steps.png) / [after](../artifacts/density/after/1440-steps.png).
- Mobile opening: [before](../artifacts/density/before/390-opening.png) / [after](../artifacts/density/after/390-opening.png).
- Mobile central: [before](../artifacts/density/before/390-central.png) / [after](../artifacts/density/after/390-central.png).
- Mobile steps: [before](../artifacts/density/before/390-steps.png) / [after](../artifacts/density/after/390-steps.png).

Reproduce with `node scripts/density-capture.mjs after`. The before captures are retained; do not overwrite them after changing the geometry.

## Final checks and measurements

- **24 passing financial/inventory tests**. Includes repeatable migration over populated commercial tables, stable IDs, safe camera positions, positive dimensions, façade/frame overlap detection, architectural attachment, unobstructed viewing positions, and continuous wraparound edge mapping.
- **Seven passing Edge browser scenarios**. Every one of the 72 actual screen meshes was hovered, clicked and deep-linked; all 72 viewing positions, walking, drag separation, pointer lock and steps collision were exercised. Map cluster filtering, a new wrap's actual-scene preview and mobile joystick movement passed. Both legacy `tsq-013` and new `tsq-072` completed draft → sign-in → approval → simulated payment → second visitor → refund. Image derivative dimensions and private-asset denial passed. [Browser results](../artifacts/e2e-results.json).
- **Production build, TypeScript, ESLint and whitespace checks pass.** After the final two visual corrections, the financial/geometry suite and build/lint were rerun, and all six screenshots were recaptured.
- Inspected all six matching before/after views, plus [the new wrap preview](../artifacts/density/wrap-preview.png). The opening camera detects **38 unobstructed screen centres**, including supporting ticker bands, versus roughly ten visible billboards in the initial image. This exceeds the suggested 18–25 opening-view range; the additional surfaces are attached, substantial pieces of the visible clusters. Both sides, the tower piers and the red-steps flank are visibly denser. The 72 slots use 74 artwork meshes, with no extra inventory counted for wrap segments or environmental signs.
- The final captures report **zero page errors**. Frame-overlap and attachment checks found no remaining failures. Texture sizing preserves thin ticker aspect ratios even at the lowest resolution. The Astor flagship was moved along its façade to keep its full width supported.
- Performance on this Windows laptop's Ryzen 3 7320U/Radeon GPU, headless Edge 153, DPR 1, medium preset, eight-second steady-state samples after dismissing the intro: **1440×960: 58.7 FPS, 16.8 ms p95, 320 draw calls, 17,072 triangles**; **390×844: 59.1 FPS, 16.8 ms p95, 237 draw calls, 13,678 triangles**. The mobile run is viewport emulation on the laptop, not a physical phone. [Raw performance](../artifacts/density/performance-after.json).
- Matching opening-view draw calls decrease from **441 to 320** on desktop and **327 to 237** on mobile emulation. Initial local resource bodies are about 1.53 MB; all production JS/CSS/font assets gzip to 460,607 bytes. These are house-art measurements; a square populated with uploaded advertising has additional image traffic. No remote deployment or live payment was performed.
