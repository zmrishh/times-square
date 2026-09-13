# Paper Square visual refresh — 13 September 2026

The interface now uses self-hosted Geist and Geist Mono through `next/font`, replacing the Arial/Georgia hierarchy with stronger headings, readable labels and consistent form typography. A citrus accent, ink shadows, welcome-card entrance, button press feedback and clearer selected navigation make exploration more inviting. The paper architecture and colorful artwork remain the visual center.

## Scope

- `src/app/layout.tsx`: optimized variable fonts and presentation stylesheet.
- `src/app/square-refresh.css`: shared typography, navigation, welcome, directory, details, editor, account, loading and mobile styles; reduced-motion rules.
- `src/components/paper-square.tsx`: welcome copy and arrow size only. Existing handlers, state, inventory, advertiser artwork, checkout and payment logic are unchanged.
- On phones, the decorative compass is hidden and walking controls appear after the welcome card is dismissed, avoiding overlapping instructions.

## Executed verification

- Production build including TypeScript: passed.
- ESLint for modified TSX files: passed.
- Existing `tests/e2e/product.spec.ts`: 4 passed against a separate local simulation database. Covers direct checkout for standard and wraparound placements, uploaded creative, second-visitor takeover, refund, mobile navigation/fallback, private uploads and forged requests.
- Edge desktop emulation at 360, 390, 768, 1366 and 1920 pixels: 17 welcome, directory, editor and sign-in states checked. No browser page errors, horizontal page overflow, or axe WCAG A/AA violations in the inspected states.
- Final production build on a local server, with isolated database/provider fixtures: desktop 1366×900 and mobile 390×844 passed. Both served 72 slots, opened directory and billboard details, loaded Geist, and had no page errors, overflow or axe violations. Entrance animation runs normally and is disabled under reduced motion.
- Screenshots inspected directly; mobile compass/instruction overlap corrected and recaptured against the production build.

## Evidence and limits

Local screenshots and JSON evidence are under ignored `artifacts/refresh/`: `visual-results.json`, `production-smoke.json`, `production-1366.png` and `production-390.png`. The earlier deployed appearance is captured in `artifacts/audit/vercel-origin-fix.png`.

Financial regression results use simulation, not real provider transactions. Production-build smoke uses local fixtures. Physical iOS/Android devices and Safari were not tested. This visual change does not establish readiness of the outstanding SMTP, hosted storage, worker or Dodo live configuration.

For visual rollback, revert the refresh commit and redeploy; no database migration is involved.
