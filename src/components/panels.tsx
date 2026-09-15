"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  ImageIcon,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Creative, money, SLOTS, Snapshot } from "@/lib/registry";
import { RULES } from '@/lib/rules';
import { useAuctionClosed } from './auction-countdown';
import { api, Art, Brand, Me, MyOrder } from "./ui";
export function AccountPanel({
  me,
  snapshot,
  onNew,
  onEdit,
  onSelect,
  onOrder,
}: {
  me: Me;
  snapshot: Snapshot | null;
  onNew: () => void;
  onEdit: (b: Brand) => void;
  onSelect: (id: string) => void;
  onOrder: (o: MyOrder) => void;
}) {
  const auctionClosed = useAuctionClosed(snapshot?.auction);
  return (
    <>
      <div className="section-heading">
        <h3>Your brands & creatives</h3>
        <button className="quiet" onClick={onNew}>
          <Plus size={16} />
          New
        </button>
      </div>
      {!me.brands.length && (
        <div className="empty-state">
          <ImageIcon size={28} />
          <h3>Your first billboard starts here.</h3>
          <p>
            Create a brand, preview it in the square, and continue to payment.
          </p>
          <button className="secondary" onClick={onNew}>
            Create your first brand <ArrowRight size={16} />
          </button>
        </div>
      )}
      {me.brands.map((b) => (
        <div className="account-brand" key={b.creative_id}>
          <Art creative={b.data} art={0} ratio={1.7} />
          <div>
            <h3>{b.name}</h3>
            <span className={`status ${b.status}`}>
              {b.status === "approved"
                ? "Ready"
                : b.status === "pending"
                  ? "Saved"
                  : "Needs changes"}
            </span>
            {b.reason && <p>{b.reason}</p>}
            <p>{b.data.tagline}</p>
            <button className="text-link" onClick={() => onEdit(b)}>
              {b.status === "approved"
                ? auctionClosed ? "Edit artwork" : "Choose a placement"
                : "Edit & continue"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ))}
      <div className="section-heading">
        <h3>Your totals by placement</h3>
      </div>
      {me.totals.map((t) => (
        <div className="order-card" key={t.slot_id + t.brand_id}>
          <div>
            <strong>
              {me.brands.find((b) => b.id === t.brand_id)?.name} ·{" "}
              {SLOTS.find((s) => s.id === t.slot_id)?.name}
            </strong>
            <span className="status">
              {snapshot?.slots.find((s) => s.id === t.slot_id)?.brandId ===
              t.brand_id
                ? auctionClosed ? "Permanent winner" : "Currently displayed"
                : t.amount > 0
                  ? "Displaced"
                  : "No eligible principal"}
            </span>
          </div>
          <p>
            Applied total: <b>{money(t.amount)}</b>
          </p>
          <button className="quiet" onClick={() => onSelect(t.slot_id)}>
            {auctionClosed ? 'View billboard' : 'View, share or take the lead'} <ArrowRight size={14} />
          </button>
        </div>
      ))}
      {!me.totals.length && (
        <p className="empty-copy">
          Your applied total is tracked separately for every billboard.
        </p>
      )}
      <div className="section-heading">
        <h3>Placements & receipts</h3>
        <span>{me.orders.length}</span>
      </div>
      {!me.orders.length && (
        <p className="empty-copy">
          No checkouts yet. Every payment and refund will appear here.
        </p>
      )}
      {me.orders.map((o, i) => (
        <div className="order-card" key={o.id + i}>
          <div>
            <strong>{SLOTS.find((s) => s.id === o.slot_id)?.name}</strong>
            <span className={`status ${o.state}`}>
              {o.state.replaceAll("_", " ")}
            </span>
          </div>
          <span>
            {new Date(o.created_at).toLocaleString()}{" "}
            {o.mode === "simulation" ? "· SIMULATED" : ""}
          </span>
          <dl>
            <div>
              <dt>Before tax</dt>
              <dd>{money(o.principal ?? o.due)}</dd>
            </div>
            <div><dt>Video format fee included</dt><dd>{money(o.video_fee || 0)}</dd></div>
            <div>
              <dt>Tax</dt>
              <dd>{money(o.tax || 0)}</dd>
            </div>
            <div>
              <dt>Refunded cash</dt>
              <dd>{money(o.refunded_cash || 0)}</dd>
            </div>
          </dl>
          {o.refund_state && <p>Refund: {o.refund_state}</p>}
          <div className="button-row">
            <button className="quiet" onClick={() => onSelect(o.slot_id)}>
              View billboard <ArrowUpRight size={13} />
            </button>
            <button className="quiet" onClick={() => onOrder(o)}>
              Payment status <ArrowRight size={13} />
            </button>
            {o.payment_id && (
              <a className="quiet" href={`/api/receipt/${o.id}`} download>
                Receipt <Download size={13} />
              </a>
            )}
          </div>
        </div>
      ))}
      <div className="section-heading">
        <h3>Actual display periods</h3>
      </div>
      {me.placements.map((p, i) => (
        <div className="history-row" key={p.started_at + i}>
          <div>
            <strong>
              {p.data.name} · {SLOTS.find((s) => s.id === p.slot_id)?.name}
            </strong>
            <span>
              {new Date(p.started_at).toLocaleString()} →{" "}
              {p.ended_at
                ? new Date(p.ended_at).toLocaleString()
                : "Currently displayed"}
            </span>
          </div>
          <b>{money(p.total)}</b>
        </div>
      ))}
      {!me.placements.length && (
        <p className="empty-copy">No delivered placements yet.</p>
      )}
      <div className="section-heading">
        <h3>Measured discovery</h3>
      </div>
      <div className="metric-strip">
        <div>
          <strong>
            {me.analytics
              .filter((a) => a.kind === "view")
              .reduce((s, a) => s + a.count, 0)}
          </strong>
          <span>Qualified views</span>
        </div>
        <div>
          <strong>
            {me.analytics
              .filter((a) => a.kind === "click")
              .reduce((s, a) => s + a.count, 0)}
          </strong>
          <span>Website clicks</span>
        </div>
      </div>
      <p className="fine">
        Views require 2 seconds, sufficient on-screen size, and an unobstructed
        ray to the billboard center. Deduplicated per browser, creative and day;
        signed-in owner traffic and obvious bots are excluded. Estimates, not
        unique people.
      </p>
    </>
  );
}
export function HowItWorks({ onChoose, onRules }: { onChoose: () => void; onRules: () => void }) {
  return <div className="rules how-it-works">
    <p className="panel-intro">Seven days to bid. A place in the square forever. From $10.</p>
    {[
      ['Choose a billboard', 'Explore the square and pick your spot. Each billboard shows its current price.'],
      ['Add your artwork', 'Upload an image or video, add your website, and preview it on the billboard.'],
      ['Bid before the countdown ends', 'All billboards share one seven-day bidding window from launch. Pay securely and your artwork goes live after payment is verified. To take the lead, your paid total on that billboard must be at least $10 higher.'],
      ['Win your place forever', 'When the countdown reaches zero, bidding closes. The highest eligible bidder on each billboard stays there forever. No new bids, no next round.'],
    ].map(([heading, body], i) => <div className="rule-number" key={heading}>
      <span>0{i + 1}</span><div><h3>{heading}</h3><p>{body}</p></div>
    </div>)}
    <p className="fine">Why seven days? A short window to compete, then a lasting place for the brands that made their mark. This is advertising on our virtual square.</p>
    <p className="fine">One-time payments. Video costs 50% more; applicable tax is shown at checkout. Only payments verified and applied before the deadline count. You can be outbid during the seven days; being outbid does not automatically trigger a refund. Content rules and payment eligibility still apply to permanent winners.</p>
    <button className="primary full" onClick={onChoose}>Choose a billboard <ArrowRight size={16} /></button>
    <button className="text-link detailed-rules-link" onClick={onRules}>Read the detailed rules & privacy policy <ArrowUpRight size={14} /></button>
  </div>;
}
export function Rules({ support, paymentMode }: { support: string; paymentMode?: string }) {
  return (
    <div className="rules">
      <p className="panel-intro">
        Placement, pricing, content and privacy rules. Review the total shown
        at checkout before paying.
      </p>
      {[
        [
          "Pick your place",
          "Every billboard has its own cumulative paid ranking: your eligible contributions to that billboard. All billboards share a seven-day countdown from launch. The eligible brand with the highest total is displayed during bidding and wins that billboard permanently when the countdown ends. Opening prices start at $10 for small placements, $25 for standard and $50 for premium.",
        ],
        [
          "Make it yours",
          "Create a brand, compose or upload static artwork, and preview it on the actual placement. Continue directly to payment without manual approval. New placements appear after payment is verified. You can save artwork changes while you lead a placement without paying again.",
        ],
        [
          "Pay to take the lead",
          "A takeover requires at least $10 more than the current ranking. The exact minimum is shown before checkout and may be higher. Price changes apply to new quotes only. Video adds a separate 50% format fee. A leader cannot outbid itself, but may pay to upgrade an image to video. There is no wallet, transferable balance, subscription, automatic rebid, withdrawal, payout, resale or prize.",
        ],
        [
          "Seven days to bid. Stay forever.",
          "Placement begins only after verified payment is applied. During the seven-day window, a higher paid total can take the lead. At the deadline, each billboard locks its current eligible winner permanently; unclaimed billboards stay unclaimed. There is no next round. Winners may update eligible artwork. Content violations, refunds or disputes can remove a placement, but never reopen bidding or promote a runner-up. Visits, clicks, conversions and revenue are not guaranteed. Being outbid does not automatically refund a delivered placement; displaced brands remain in the directory.",
        ],
      ].map(([heading, body], i) => (
        <div className="rule-number" key={heading}>
          <span>0{i + 1}</span>
          <div>
            <h3>{heading}</h3>
            <p>{body}</p>
            {i === 2 && (
              <div className="rule-example">
                <span>A leader has $100. The next ranking is $110.</span>
                <p>
                  New image placement pays <b>$110</b>; video pays <b>$165</b>.<br />
                  Returning image advertiser with $40 pays <b>$70</b>.
                </p>
                <small>
                  Only spending on that same billboard counts. Taxes do not
                  increase ranking. Video costs 50% of the target ranking in addition to bidding credit, less previous eligible video fees on that same placement. Image-to-video upgrades keep the ranking unchanged and require payment of the remaining video fee. Refunds reduce bidding and format credit proportionately; refunding a video-only upgrade restores the paid image. Existing paid videos keep their original terms.
                </small>
              </div>
            )}
          </div>
        </div>
      ))}
      <h3>Reservations, payment errors & refunds</h3>
      <p>
        One checkout reserves a billboard for up to 10 minutes, plus a 2-minute
        settlement grace period. Both end at the auction deadline, even if checkout is already open.
        Payment must be verified and applied before the countdown reaches zero.
        Late payments enter the full refund workflow and cannot change a winner.
        Existing artwork stays visible. The server
        reconciles the provider before releasing an expired reservation. A stale
        or mismatched payment that cannot deliver its promised placement enters
        a full refund workflow, including applicable buyer-paid tax. Refund
        initiation is not completion.
      </p>
      <p>
        Refunds remain supported for payment errors, undelivered placements,
        applicable obligations and operator remediation. Refunded principal
        cannot support a ranking. An externally issued partial refund
        temporarily withholds up to its gross amount from eligible principal
        while the operator verifies its tax allocation. Open or lost disputes
        withhold the payment from eligibility; winning or cancelled disputes can
        restore it. Ties use the earlier applied total update, then a stable
        brand ID.
      </p>
      <h3>Moderation & removal</h3>
      <p>
        Unlawful content, impersonation, unsafe destinations,
        intellectual-property violations and abuse may lead to suspension or
        removal. Rankings are recomputed without inventing payments or rewriting
        past display periods. Any refund is a separate, traceable financial
        action. A saved edit replaces visible artwork only while that advertiser
        still leads the slot.
      </p>
      <h3>Virtual billboards, independently operated</h3>
      <p>
        You are buying advertising on this website’s own virtual billboards, not
        physical Times Square screens. We are not affiliated with Times Square
        organizations or building owners. No lifetime hosting is promised.
        Original unsold artwork is labeled house art and excluded from
        commercial rankings.
      </p>
      <h3>Privacy & measurement</h3>
      <p>
        Private information includes your email, session, drafts, uploads and
        payment records. Public information includes displayed brand details,
        destination URLs, applied totals and display history. Draft uploads
        remain private. We do not fetch submitted website metadata.
      </p>
      <p>
        Visits, directory opens, panel opens and explicit website clicks are
        separate events. Qualified billboard views require two seconds of
        visibility, sufficient on-screen size, and an occlusion check against
        the center of the screen. Tracking pauses in hidden tabs. Browser/day
        deduplication, signed-in owner filtering and obvious bot filtering
        reduce noise. This is approximate reach, not verified unique humans.
      </p>
      <h3>Support & operator details</h3>
      {support ? (
        <p>
          Contact <a href={`mailto:${support}`}>{support}</a> for privacy,
          content and payment requests. Include your order reference for payment
          support.
        </p>
      ) : (
        <div className="notice">
          Draft launch rules. Operator identity, support email,
          jurisdiction-specific terms and a retention policy must be configured
          before opening to customers.
        </div>
      )}
      <p className="fine">
        Rules version {RULES.version}. {paymentMode === 'dodo-live'
          ? 'Live payments are enabled. Checkout charges real money in USD, with applicable tax shown before payment.'
          : paymentMode === 'dodo-test' || paymentMode === 'simulation'
            ? 'This is a test environment. Checkout does not charge real money.'
            : 'Payment availability and the final total are shown at checkout.'}
      </p>
    </div>
  );
}
type AdminData = {
  failedOrders: { id: string; slot_id: string; state: string; failure_code: string | null; mode: string; cutoff_at: string }[];
  analytics: { kind: string; count: number }[];
  disputes: {
    id: string;
    payment_id: string;
    status: string;
    updated_at: string;
  }[];
  financial: Record<string, number>;
  pending: {
    id: string;
    brand_id: string;
    data: Creative;
    status: string;
    reason: string;
  }[];
  payments: {
    id: string;
    slot_id: string;
    principal: number;
    tax: number;
    cash: number;
    refunded_cash: number;
    state: string;
    mode: string;
    refund_state: string;
  }[];
  jobs: {
    id: string;
    kind: string;
    state: string;
    attempts: number;
    error: string;
  }[];
  audits: { id: string; action: string; target: string; created_at: string }[];
  reports: { id: string; slot_id: string; reason: string }[];
  settings: { paused: boolean; preset: string; workerCheckedAt?: string };
  users: { id: string; email: string; role: string; suspended: boolean }[];
};
export function AdminPanel({
  snapshot,
  notify,
  onChanged,
}: {
  snapshot: Snapshot | null;
  notify: (s: string) => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Review"),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState<{
      type: string;
      id: string;
      description: string;
      value?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api<AdminData>("admin")
        .then(setData)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await api(`admin/${path}`, body);
      await load();
      onChanged();
      notify("Change recorded.");
      setConfirm(null);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <p>{error || "Loading management…"}</p>;
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Every management action is audited. Simulation payments are excluded
          from commercial totals.
        </span>
      </div>
      <div className="segmented admin-tabs">
        {["Review", "Payments", "Inventory", "Operations"].map((t) => (
          <button
            key={t}
            className={tab === t ? "chosen" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {confirm && (
        <div
          className="confirmation"
          role="alertdialog"
          aria-label="Confirm administrative action"
        >
          <h3>Review this action</h3>
          <p>{confirm.description}</p>
          <label className="field">
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={500}
            />
          </label>
          <div className="button-row">
            <button className="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || reason.length < 10}
              onClick={() =>
                void act(
                  confirm.type,
                  confirm.type === "refund"
                    ? { paymentId: confirm.id, reason }
                    : confirm.type === "suspend"
                      ? {
                          accountId: confirm.id,
                          suspended: confirm.value,
                          reason,
                        }
                      : { id: confirm.id, approve: false, reason },
                )
              }
            >
              Confirm action
            </button>
          </div>
        </div>
      )}
      {tab === "Review" && (
        <>
          {data.pending
            .filter((c) => c.status === "pending")
            .map((c) => (
              <div className="review-card" key={c.id}>
                <Art creative={c.data} art={0} ratio={1.7} />
                <h3>{c.data.name}</h3>
                <a
                  className="text-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={c.data.url}
                >
                  {c.data.url}
                  <ExternalLink size={13} />
                </a>
                <p>{c.data.description}</p>
                <span className="fine">Version {c.id}</span>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      setConfirm({
                        type: "moderate",
                        id: c.id,
                        description:
                          "Reject this exact version and give the advertiser a useful reason. No payment has been accepted for it.",
                      })
                    }
                  >
                    Reject
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void act("moderate", {
                        id: c.id,
                        approve: true,
                        reason: "",
                      })
                    }
                  >
                    Approve exact version <Check size={16} />
                  </button>
                </div>
              </div>
            ))}
          {!data.pending.some((c) => c.status === "pending") && (
            <div className="empty-state">
              <CheckCircle2 size={32} />
              <h3>The review desk is clear.</h3>
              <p>
                New creatives go directly to checkout. Older pending submissions
                appear here.
              </p>
            </div>
          )}
          <h3>Listing reports</h3>
          {data.reports.length ? (
            data.reports.map((r) => (
              <div className="order-card" key={r.id}>
                <strong>{r.slot_id}</strong>
                <p>{r.reason}</p>
              </div>
            ))
          ) : (
            <p className="empty-copy">No reports.</p>
          )}
        </>
      )}
      {tab === "Payments" && (
        <>
          <div className="metric-strip">
            {[
              ["Collected cash", "collected_cash"],
              ["Collected tax", "collected_tax"],
              ["Refunded cash", "refunded_cash"],
              ["Applied principal", "applied_principal"],
              ["Refund liability", "refund_liability"],
            ].map(([name, key]) => (
              <div key={key}>
                <strong>{money(data.financial[key] || 0)}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
          <p className="fine">
            All-time live payments only; test and simulation money is excluded.
            Detail shows the latest 100 payments. Processor fees and net
            proceeds are unavailable until provider settlement reports are
            reconciled. Cumulative rank is a separate measure.
          </p>
          <h3>Orders needing attention</h3>
          {data.failedOrders.length === 0 && <p className="empty-copy">No failed or unresolved orders.</p>}
          {data.failedOrders.map(o => (
            <div className="audit-row" key={o.id}>
              <strong>{o.slot_id.toUpperCase()} · {o.state.replaceAll("_", " ")}</strong>
              <span>{o.mode} · {o.failure_code || "Awaiting provider reconciliation"}</span>
              <code>{o.id}</code>
            </div>
          ))}
          <h3>Recorded payments</h3>
          {data.payments.map((p) => (
            <div className="order-card" key={p.id}>
              <div>
                <strong>
                  {p.slot_id} · {money(p.cash)}
                </strong>
                <span className="status">{p.state}</span>
              </div>
              <span>
                {p.mode.toUpperCase()} · {p.id}
              </span>
              <p>
                Principal {money(p.principal)} · Tax {money(p.tax)} · Refunded{" "}
                {money(p.refunded_cash)}
                {p.refund_state ? ` · Refund ${p.refund_state}` : ""}
              </p>
              <button
                className="secondary"
                disabled={
                  p.refunded_cash >= p.cash ||
                  [
                    "queued",
                    "pending",
                    "sending",
                    "ambiguous",
                    "review",
                  ].includes(p.refund_state)
                }
                onClick={() =>
                  setConfirm({
                    type: "refund",
                    id: p.id,
                    description: `Request a full refund of ${money(p.cash)}. A confirmed refund removes its principal from ranking and may change the active billboard. Provider confirmation is required for completion.`,
                  })
                }
              >
                <RotateCcw size={14} />
                Request full refund
              </button>
              {p.refunded_cash > 0 && p.refunded_cash < p.cash && (
                <details className="refund-attribution">
                  <summary>Reconcile partial refund tax</summary>
                  <p className="fine">
                    Use the provider’s confirmed refund receipt. This adjusts
                    eligible principal; it does not issue money.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act("refund-attribution", {
                        paymentId: p.id,
                        cash: p.refunded_cash,
                        principal: Math.round(Number(f.get("principal")) * 100),
                        reference: String(f.get("reference")),
                      });
                    }}
                  >
                    <label className="field">
                      Refunded principal, USD
                      <input
                        name="principal"
                        type="number"
                        min="0"
                        max={Math.min(p.principal, p.refunded_cash) / 100}
                        step="0.01"
                        required
                      />
                    </label>
                    <label className="field">
                      Provider receipt reference & reason
                      <textarea
                        name="reference"
                        minLength={10}
                        maxLength={500}
                        required
                      />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Confirm receipt attribution
                    </button>
                  </form>
                </details>
              )}
            </div>
          ))}
          {!data.payments.length && (
            <p className="empty-copy">No recorded payments.</p>
          )}
        </>
      )}
      {tab === "Inventory" && (
        <>
          <label className="check-field">
            <input
              type="checkbox"
              checked={data.settings.paused}
              onChange={(e) =>
                void act("settings", {
                  paused: e.target.checked,
                  preset: data.settings.preset,
                })
              }
            />
            Pause all new checkouts
          </label>
          <label className="field">
            Takeover increment
            <select
              value={data.settings.preset}
              onChange={(e) =>
                void act("settings", {
                  paused: data.settings.paused,
                  preset: e.target.value,
                })
              }
            >
              <option value="quarter">Current ranking + $10</option>
              <option value="double">2× the leader (at least $10 more)</option>
            </select>
          </label>
          <p className="fine">
            Changes affect new quotes only. Purchased quotes and paid totals are
            immutable.
          </p>
          {snapshot?.slots.map((s) => (
            <div className="inventory-row" key={s.id}>
              <div>
                <strong>{SLOTS.find((x) => x.id === s.id)?.name}</strong>
                <span>{s.id}</span>
              </div>
              <label>
                Opening USD
                <input
                  aria-label={`Opening price ${s.id}`}
                  type="number"
                  defaultValue={s.opening / 100}
                  min={1}
                  max={1000}
                  onBlur={(e) => {
                    const value = Math.round(Number(e.target.value) * 100);
                    if (value !== s.opening)
                      void act("inventory", {
                        slotId: s.id,
                        available: s.available,
                        opening: value,
                      });
                  }}
                />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  if (s.brandId) {
                    setError(
                      "Paid placement removal requires account moderation with a recorded reason and refund review.",
                    );
                    return;
                  }
                  void act("inventory", {
                    slotId: s.id,
                    available: !s.available,
                    opening: s.opening,
                  });
                }}
              >
                {s.available ? "Available" : "Unavailable"}
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "Operations" && (
        <>
          <button
            className="primary full"
            disabled={busy}
            onClick={() => void act("jobs", {})}
          >
            <RotateCcw size={16} />
            Run reconciliation & queued jobs
          </button>
          <p className="fine">
            Configure the durable worker for automatic processing. Ambiguous
            financial requests are reconciled before any retry.
          </p>
          <h3>Measured activity</h3>
          <div className="metric-strip">
            {["visit", "directory", "panel", "view", "click"].map((kind) => (
              <div key={kind}>
                <strong>
                  {data.analytics.find((a) => a.kind === kind)?.count || 0}
                </strong>
                <span>
                  {
                    {
                      visit: "Website visits",
                      directory: "Directory opens",
                      panel: "Panel opens",
                      view: "Qualified views",
                      click: "Website clicks",
                    }[kind]
                  }
                </span>
              </div>
            ))}
          </div>
          <p className="fine">
            All-time browser/day deduplicated events; approximate reach, not
            unique people. Self-traffic and obvious bots are excluded.
          </p>
          <h3>Disputes</h3>
          {data.disputes.length ? (
            data.disputes.map((d) => (
              <div className="order-card" key={d.id}>
                <strong>{d.status.replaceAll("_", " ")}</strong>
                <p>
                  {d.id} · {d.payment_id}
                </p>
                <span>{new Date(d.updated_at).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="empty-copy">No recorded disputes.</p>
          )}
          <h3>Jobs requiring attention</h3>
          <p className="fine">Last completed worker run: {data.settings.workerCheckedAt ? new Date(data.settings.workerCheckedAt).toLocaleString() : "Not recorded — configure the durable worker."}</p>
          {data.jobs.map((j) => (
            <div className="order-card" key={j.id}>
              <strong>
                {j.kind} · {j.state} · attempt {j.attempts}
              </strong>
              <p>{j.error || j.id}</p>
              {j.state === "failed" && (
                <button
                  className="secondary"
                  onClick={() => void act("replay", { id: j.id })}
                >
                  Replay reconciliation
                </button>
              )}
            </div>
          ))}
          <h3>Account moderation</h3>
          {data.users.map((u) => (
            <div className="inventory-row" key={u.id}>
              <div>
                <strong>{u.email}</strong>
                <span>
                  {u.role} · {u.suspended ? "suspended" : "active"}
                </span>
              </div>
              {u.role !== "admin" && (
                <button
                  className="secondary"
                  onClick={() =>
                    setConfirm({
                      type: "suspend",
                      id: u.id,
                      value: !u.suspended,
                      description: `${u.suspended ? "Restore" : "Suspend"} this account. Suspension removes eligibility and recomputes affected billboards. Review refunds separately. Financial history is preserved.`,
                    })
                  }
                >
                  {u.suspended ? "Restore" : "Suspend"}
                </button>
              )}
            </div>
          ))}
          <h3>Audit trail</h3>
          {data.audits.map((a) => (
            <div className="audit-row" key={a.id}>
              <strong>{a.action}</strong>
              <span>{new Date(a.created_at).toLocaleString()}</span>
              <code>{a.target}</code>
            </div>
          ))}
        </>
      )}
    </>
  );
}
