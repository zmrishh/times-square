"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Type,
  Upload,
} from "lucide-react";
import {
  Creative,
  Slot,
  Snapshot,
  money,
  slotAspect,
  slotWidth,
} from "@/lib/registry";
import { api, Art, Me } from "./ui";
type Props = {
  slot: Slot;
  snapshot: Snapshot | null;
  me: Me;
  creative: Creative;
  setCreative: (c: Creative) => void;
  brandId: string | undefined;
  setBrandId: (id: string | undefined) => void;
  approvedId: string;
  setApprovedId: (id: string) => void;
  onView: () => void;
  onAuth: () => void;
  onReady: () => void;
  onChangePlacement: () => void;
  onCheckout: (o: {
    id: string;
    state: string;
    due: number;
    target: number;
    mode: string;
  }) => void;
};
export function CreativeEditor(p: Props) {
  const { slot, creative: c, me } = p;
  const checkoutRef = useRef<HTMLDivElement>(null);
  const isLeading = Boolean(
    p.brandId &&
    p.snapshot?.slots.some((s) => s.id === slot.id && s.brandId === p.brandId),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(""),
    [target, setTarget] = useState(""),
    [accepted, setAccepted] = useState(false),
    [quote, setPrice] = useState<{
      key: string;
      minimum: number;
      existing: number;
      target: number;
      due: number;
    } | null>(null);
  const quoteKey = `${p.approvedId}:${slot.id}:${target}`;
  const price = quote?.key === quoteKey ? quote : null;
  const action = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const change = <K extends keyof Creative>(key: K, value: Creative[K]) => {
    p.setCreative({ ...c, [key]: value });
    p.setApprovedId("");
    setSaved("Saving draft…");
    setAccepted(false);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      void api("draft", { creative: c, slotId: slot.id, brandId: p.brandId })
        .then(() => setSaved("Draft saved privately"))
        .catch(() => setSaved("Unable to save draft"));
    }, 600);
    return () => clearTimeout(timer);
  }, [c, slot.id, p.brandId]);
  useEffect(() => {
    if (!p.approvedId || isLeading) return;
    let live = true;
    const t = setTimeout(() => {
      void api<{
        minimum: number;
        existing: number;
        target: number;
        due: number;
      }>("quote", {
        creativeId: p.approvedId,
        slotId: slot.id,
        ...(target ? { target: Math.round(Number(target) * 100) } : {}),
      })
        .then((r) => {
          if (live) {
            setPrice({ ...r, key: quoteKey });
            setError("");
          }
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setPrice(null);
          }
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [p.approvedId, slot.id, target, p.snapshot?.version, isLeading, quoteKey]);
  useEffect(() => {
    if (p.approvedId || error)
      checkoutRef.current?.scrollIntoView({ block: "start" });
  }, [p.approvedId, error]);
  const upload = (f: File, key: "logo" | "image") =>
    action(async () => {
      const form = new FormData();
      form.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      change(key, d.url);
    });
  return (
    <>
      <div className="editor-placement">
        <MapPin size={18} />
        <div>
          <strong>{slot.name}</strong>
          <span>
            {slot.location} · {slotWidth(slot)}:{slot.segments[0].height}
          </span>
        </div>
        <button className="quiet" onClick={p.onChangePlacement}>
          Change
        </button>
      </div>
      <div className="step-indicator">
        <span className="done">
          1 <small>Placement</small>
        </span>
        <i />
        <span className="current">
          2 <small>Your creative</small>
        </span>
        <i />
        <span>
          3 <small>Review & pay</small>
        </span>
      </div>
      {me.brands.length > 0 && (
        <label className="field">
          Reuse a brand
          <select
            value={p.approvedId || ""}
            onChange={(e) => {
              const b = me.brands.find((b) => b.creative_id === e.target.value);
              if (!b) return;
              p.setCreative(b.data);
              p.setBrandId(b.id);
              p.setApprovedId(b.status === "approved" ? b.creative_id : "");
              setAccepted(false);
            }}
          >
            <option value="">Create a new creative</option>
            {me.brands.map((b) => (
              <option value={b.creative_id} key={b.creative_id}>
                {b.name} ·{" "}
                {b.status === "approved"
                  ? "Ready"
                  : b.status === "pending"
                    ? "Saved"
                    : "Needs changes"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="segmented">
        <button
          className={c.mode === "template" ? "chosen" : ""}
          onClick={() => change("mode", "template")}
        >
          <Type size={15} />
          Template
        </button>
        <button
          className={c.mode === "upload" ? "chosen" : ""}
          onClick={() => change("mode", "upload")}
        >
          <ImageIcon size={15} />
          Upload artwork
        </button>
      </div>
      <Art creative={c} art={slot.art} ratio={slotAspect(slot)} safe />
      <button className="preview-link" onClick={p.onView}>
        <Building2 size={16} />
        See it on your actual billboard <ArrowUpRight size={16} />
      </button>
      <div className="form-grid">
        <label className="field">
          Brand name <span>40 characters</span>
          <input
            value={c.name}
            maxLength={40}
            placeholder="Your company or project"
            onChange={(e) => change("name", e.target.value)}
          />
        </label>
        <label className="field">
          Website <span>HTTPS</span>
          <input
            type="url"
            value={c.url}
            maxLength={500}
            placeholder="https://yourbrand.com"
            onChange={(e) => change("url", e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        Tagline
        <input
          value={c.tagline}
          maxLength={80}
          placeholder="A little introduction to what you do"
          onChange={(e) => change("tagline", e.target.value)}
        />
      </label>
      <label className="field">
        About your brand
        <textarea
          value={c.description}
          rows={3}
          maxLength={400}
          placeholder="What makes you, you?"
          onChange={(e) => change("description", e.target.value)}
        />
        <span>{c.description.length}/400</span>
      </label>
      <div className="form-grid">
        <label className="field">
          Category
          <select
            value={c.category}
            onChange={(e) => change("category", e.target.value)}
          >
            {["Technology", "Design", "Culture", "Food & drink", "Other"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          Social profile <span>Optional</span>
          <input
            type="url"
            value={c.social}
            maxLength={500}
            placeholder="https://…"
            onChange={(e) => change("social", e.target.value)}
          />
        </label>
      </div>
      <label className="upload-zone">
        <Upload size={20} />
        <strong>
          {c.mode === "template"
            ? c.logo
              ? "Replace your logo"
              : "Add your logo"
            : c.image
              ? "Replace artwork"
              : "Upload finished artwork"}
        </strong>
        <span>
          Static PNG, JPEG or WebP · up to 5 MB
          <br />
          64–6000 px · 16 MP maximum
        </span>
        <input
          type="file"
          aria-label={c.mode === "template" ? "Upload logo" : "Upload artwork"}
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) =>
            e.target.files?.[0] &&
            void upload(
              e.target.files[0],
              c.mode === "template" ? "logo" : "image",
            )
          }
        />
      </label>
      {c.mode === "template" ? (
        <>
          <label className="field">
            Headline <span>90 characters</span>
            <textarea
              rows={2}
              value={c.headline}
              maxLength={90}
              onChange={(e) => change("headline", e.target.value)}
            />
          </label>
          <label className="field">
            Subline <span>Optional · 80 characters</span>
            <input
              value={c.subline}
              maxLength={80}
              onChange={(e) => change("subline", e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            Artwork fit
            <select
              value={c.fit}
              onChange={(e) => change("fit", e.target.value as Creative["fit"])}
            >
              <option value="contain">Fit whole image</option>
              <option value="cover">Fill screen (crop shown above)</option>
            </select>
          </label>
          {c.fit === "cover" && (
            <div className="form-grid">
              <label className="field">
                Horizontal crop
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={c.cropX}
                  onChange={(e) => change("cropX", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Vertical crop
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={c.cropY}
                  onChange={(e) => change("cropY", Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </>
      )}
      <div className="color-fields">
        <label>
          Background
          <input
            type="color"
            value={c.bg}
            onChange={(e) => change("bg", e.target.value)}
          />
          <span>{c.bg.toUpperCase()}</span>
        </label>
        <label>
          Text
          <input
            type="color"
            value={c.fg}
            onChange={(e) => change("fg", e.target.value)}
          />
          <span>{c.fg.toUpperCase()}</span>
        </label>
      </div>
      <p className="fine">
        Preview and billboard share one renderer. Logos retain their
        proportions. Save your artwork, check the price, and pay to place it.
      </p>
      <div ref={checkoutRef}>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {!p.approvedId ? (
          <>
            <div className="notice">
              <CheckCircle2 size={18} />
              <span>
                Go straight to checkout. Your new placement appears after
                payment is confirmed. No manual approval needed.
              </span>
            </div>
            <button
              className="primary full"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api("draft", {
                    creative: c,
                    slotId: slot.id,
                    brandId: p.brandId,
                  });
                  if (!me.account) {
                    p.onAuth();
                    return;
                  }
                  const ready = await api<{
                    creativeId: string;
                    brandId: string;
                  }>("creatives", {
                    creative: c,
                    ...(p.brandId ? { brandId: p.brandId } : {}),
                  });
                  p.setBrandId(ready.brandId);
                  p.setApprovedId(ready.creativeId);
                  p.onReady();
                })
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}{" "}
              {me.account
                ? isLeading
                  ? "Save artwork"
                  : "Continue to payment"
                : "Sign in to continue"}
              <ArrowRight size={17} />
            </button>
            <span className="save-note">{saved}</span>
          </>
        ) : isLeading ? (
          <div className="notice">
            <CheckCircle2 size={18} />
            <span>
              Your artwork is saved. You already lead this placement, so no
              additional payment is needed.
            </span>
            <button className="text-link" onClick={p.onView}>
              View billboard
            </button>
          </div>
        ) : (
          <div className="checkout-review">
            <div className="approved-label">
              <CheckCircle2 size={17} />
              Your creative is ready for checkout
            </div>
            <label className="field">
              Target ranking in USD <span>Optional higher amount</span>
              <input
                type="number"
                min={(price?.minimum || 0) / 100}
                max="10000"
                step="1"
                value={target}
                placeholder={
                  price ? String(price.minimum / 100) : "Calculating…"
                }
                onChange={(e) => {
                  setTarget(e.target.value);
                  setPrice(null);
                  setAccepted(false);
                }}
              />
            </label>
            <div className="price-box">
              <div>
                <span>Your previous applied total</span>
                <strong>{money(price?.existing || 0)}</strong>
              </div>
              <div>
                <span>Your total ranking</span>
                <strong>{price ? money(price.target) : "—"}</strong>
              </div>
              <div className="due">
                <span>You pay now</span>
                <strong>{price ? money(price.due) : "—"}</strong>
              </div>
            </div>
            <p className="fine">
              USD before applicable tax. Dodo shows tax at checkout; it does not
              increase ranking.
            </p>
            <div className="purchase-terms">
              <p>
                You are buying advertising on this website’s{" "}
                <strong>virtual billboard only</strong>. This does not place
                your ad on physical Times Square screens.
              </p>
              <p>
                Featured until outbid or removed under the rules.{" "}
                <strong>
                  No minimum display time, visits, clicks or results are
                  guaranteed.
                </strong>{" "}
                Being outbid does not automatically refund a delivered
                placement. Payment errors and undelivered placements remain
                eligible for refunds.
              </p>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I understand and accept these placement terms and the
                  published rules.
                </span>
              </label>
            </div>
            <button
              className="primary full"
              disabled={!accepted || !price || busy}
              onClick={() =>
                void action(async () => {
                  const o = await api<{
                    id: string;
                    state: string;
                    due: number;
                    target: number;
                    mode: string;
                    url: string;
                  }>("checkout", {
                    creativeId: p.approvedId,
                    slotId: slot.id,
                    target: price!.target,
                    accepted: true,
                  });
                  if (o.mode === "simulation") p.onCheckout(o);
                  else if (o.url) location.assign(o.url);
                  else p.onCheckout(o);
                })
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}{" "}
              {p.snapshot?.mode === "simulation"
                ? "Continue to payment simulation"
                : `Pay ${price ? money(price.due) : ""} with Dodo`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
