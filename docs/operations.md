# Operations and recovery

## Payment state and reconciliation

`orders` preserves an immutable quote, exact validated creative, rule snapshot and slot version. A reservation lasts 10 minutes plus a 2-minute settlement grace period. At cutoff, verified provider state must be consulted before the slot is recycled. Payments received after cutoff are recorded as undelivered and scheduled for a full refund, even when the slot happens to be free. Existing artwork stays visible during checkout.

Creation transitions from reserved to initializing before calling Dodo. An unknown creation outcome becomes ambiguous; retries do not create another checkout. Reconciliation fetches the stored session or searches matching product/time payment records for its metadata. It stops and raises operator attention after 500 records rather than pretending an exhaustive search succeeded.

The payment ID is the business-operation deduplication key. The event ID independently deduplicates webhook delivery. The server checks business/environment, order/session, customer/email, product/quantity, USD, subtotal and tax. It atomically records one allocation, recomputes one eligible leader, ends/starts display history and enqueues publication. Five-second versioned public polling changes only affected creative references and leaves the visitor's camera alone.

## Worker and alerts

Run `npm run worker` continuously or schedule authenticated POST `/api/jobs`. Jobs have persisted two-minute leases, bounded exponential retries and visible failed states after five attempts. Admin → Operations provides queue inspection, manual processing and replay of failed reconciliation. Public publication jobs are acknowledgements for the snapshot/polling path; no email notification sending is configured.

Recent Dodo orders are reconciled on a five-minute cadence for 30 days; active reservations are checked more frequently. Webhooks handle older refunds/disputes. Compare older unsettled/disputed provider records in an operator reconciliation run—do not rely on the 30-day scan as a lifetime audit. Failed jobs and undelivered/refund liabilities must be monitored by your host's alerting integration; no email/Slack alert credentials are configured in this repository.

## Refunds and disputes

Admin → Payments requests a full refund with an explicit reason/confirmation. One open intent per payment is allowed. Before sending a refund, recovery checks the known refund ID and provider metadata for the persisted intent ID. Claiming the intent is atomic and SDK automatic mutation retries are disabled. A pending/review refund does not count as completed. A failed or ambiguous refund remains actionable; never blindly reset it to queued.

For an ambiguous provider request, use the Dodo dashboard/refund detail endpoint to establish whether it exists. If it does, record the provider ID on the existing intent under a recorded operator maintenance procedure and replay reconciliation. If it definitively does not, document provider confirmation and requeue the same intent with an audited change. Do not issue a second independent refund as a guess. Recovering an unknown payment/order association likewise requires provider evidence, never allocation invention.

Confirmed gross refunds reduce cash reporting; refunded principal reduces that slot's ranking. Open/lost disputes withhold the payment entirely from eligibility. Won/cancelled disputes restore only its remaining unrefunded principal. Repeated identical adjustments are no-ops. Account/content suspension recomputes leaders while preserving payment records and past display periods.

The Dodo refund detail type provides gross amount without a separate partial-refund tax allocation. The app requests full refunds, for which attribution is exact. For an **external partial refund**, it conservatively withholds up to the refunded gross from eligible principal and creates an operator-review job. In Admin → Payments → Reconcile partial refund tax, enter the provider-confirmed refunded principal and receipt reference. The server refreshes provider evidence, validates the observed cash and tax bounds, records an audit entry and recomputes eligibility. An attribution applies only while the confirmed refunded cash remains the same; a later refund requires a new reconciliation. This receipt-backed step must be exercised against actual provider documentation/receipts before accepting externally issued partial refunds in production.

Admin totals separate all-time live collected cash, collected tax, refunded cash, applied unrefunded/undisputed principal and outstanding full-refund cash liability. Applied principal includes delivered allocations from subsequently moderated brands; public eligibility is a separate projection. Dodo test and simulation money are excluded. Processor fees/net proceeds require provider settlement reports and are intentionally not inferred from ranking. Downloadable app receipts are private accounting records; Dodo's issued invoice/credit note is the tax document.

## Access, privacy and retention

All database and object-storage access flows through authenticated server handlers. Public snapshots contain only previously displayed brand details, applied totals and history. Financial IDs/emails/drafts never appear there. Session and anonymous-draft cookies contain opaque random values; only hashes are stored. Mutations require the exact configured Origin, except verified provider webhooks and bearer-authenticated worker jobs.

Body streams are bounded before buffering, including requests without Content-Length. Uploads reject active content and re-encode only validated static PNG/JPEG/WebP. Shared immutable creative data cannot be edited in place. Advertiser URLs are HTTPS links displayed as destinations, not fetched by the server.

Views require two seconds of center-ray visibility and sufficient projected area; deliberate clicks and panel/directory opens are separate events. Counts are browser/day/creative deduplicated, obvious bots and signed-in owners excluded. They are estimates, not verified humans. Analytics history can be deleted/aggregated under the operator's eventual retention policy; audit/payment obligations require a separate retention decision. The code does not invent a jurisdiction, business identity or automatic deletion schedule before those decisions are configured.

Before launch define and implement an operator-approved purge schedule for expired sessions/challenges, old anonymous drafts/unreferenced assets, rate-limit rows, processed jobs/events and granular analytics, preserving legally required financial/audit records. Until configured, data is retained. Display that policy to customers and monitor storage growth. Backups must be encrypted and access-restricted.

## Direct checkout

New creative versions pass server validation and ownership checks and are immediately eligible for checkout. The legacy `approved` status now also represents checkout-ready versions; existing IDs and financial records are not migrated or rewritten. The audit event is `creative.saved`, with no fabricated operator review. Legacy pending/rejected versions remain unchanged; their owner can save a new version and continue. New artwork is published only on paid display. Saving an edit updates placements the brand still leads, without charging again; displaced brands need a new verified payment to take over. The directory uses previously displayed versions, keeping unpaid replacement artwork private.
