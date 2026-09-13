# Paper Square scene plan

Second-edition scene changes and reference review are documented in [the density update](density-update.md). Its authored inventory now contains 72 slots; the first-edition world convention below remains the basis for the camera and landmark locations.

Reference review: 2026-09-12. All geometry, signs, and house creative are original. Reference photographs are not shipped.

## Sources and inspected behavior
- https://www.timessquarenyc.org/ — official neighborhood directory; One Times Square, TKTS, Marriott Marquis, Renaissance, and Broadway/46th–47th entries.
- https://gaming.ny.gov/system/files/documents/2025/05/05.02.25.caesarspalacetimessquare_dsow.pdf — public project/site-plan reference for Broadway, Seventh Avenue, and 1515 Broadway.
- https://en.wikipedia.org/wiki/One_Astor_Plaza and https://en.wikipedia.org/wiki/1540_Broadway — relative architectural placement and silhouettes.
- https://elpais.com/elviajero/2025-01-01/mucho-que-ver-y-hacer-en-times-square.html — street-level red-steps photographic reference, viewed through image search.
- https://doodleshooter.vercel.app/ — rendered in headless Edge; inspected its menu, ink styling and displayed movement instructions. The automated Start interaction timed out, so in-game movement was not successfully inspected. No supplied screenshot existed in the project folder.
- https://hyrox.marclou.com/ — rendered the spatial sponsorship scene and opened its “How it works?” panel. Its closed-bidding state and stated automatic-refund model were inspected. No checkout, tattoo/body purchase or race claim was performed. Paper Square instead implements the brief's cumulative, delivered-advertising model.
- https://outbid.lol/ and /rules — public rankings and rules inspected via rendered text and Edge screenshots; no checkout performed. Our per-slot rules are the explicit brief, not a copy of theirs.

## World convention
One unit approximates one metre. X is east, Y up, negative Z north. Central W45th is Z=0; W42nd approximately +105, W47th -85. North/south distances are compressed to approximately 38m per block to keep a walkable browser scene. East-west facades are moved inward to preserve street-canyon sightlines at human eye height. This is an interpretive architectural model, not a survey or exact current advertising inventory.

Seventh Avenue is the straight corridor. Broadway cuts diagonally across it from northwest to southeast. The pedestrian bowtie follows the junction. One Times Square terminates the southward view near W43rd; its narrow stacked sign tower and rooftop ball are dominant. Duffy Square and its red TKTS steps occupy the northern triangle, with Two Times Square / Renaissance behind. Marriott Marquis's broad, recessed stepped facade lies west at W45th–46th. One Astor Plaza lies west at W44th–45th. 1540 Broadway with its stepped crown lies east at W45th; 1530 and 1500 Broadway continue south. 2 Times Square gets grouped perpendicular screens.

Hero: pedestrian plaza near W46th, looking south toward One Times Square. Eye height 1.72m, FOV 65 degrees, modest upward pitch. Safe viewpoints are defined beside each facade, never inside its collision footprint. Reset returns to the hero. All live surfaces attach to buildings; house/unavailable screens are distinguished from paid occupancy.

## Original assets
Architecture: procedural boxes, wedge, window grids, setback roofs, cornices, scaffolding, streets, furniture, modeled steps and miniature ambient people/taxis. Navy edges and lightly hatched facade textures; pale fog. No postprocessing or expensive shadows. Billboard pixels use unlit sRGB materials, separate from sketch textures. House art is original typographic graphic design explicitly labeled HOUSE ART, without fabricated paid totals. Canvas typography uses a shared renderer for preview and scene textures.

## Budgets and verification
Initial compressed transfer target <10 MB; reusable geometry/materials, canvas facade textures, no external model downloads. Low/medium/high DPR 1/1.4/1.8; bounded camera; visibility-aware animation; static mode for reduced motion. Final measured observations and screenshots are recorded in verification.md. Hardware-independent FPS is not promised.
