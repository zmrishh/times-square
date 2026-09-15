"use client";
import { requestErrorMessage } from "@/lib/api-client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Video,
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
import { placementFormat, MAX_MEDIA_BYTES,MAX_VIDEO_BYTES } from "@/lib/media";
import { videoPoster } from "@/lib/video-poster";
import { uploadVideo } from '@/lib/upload-video';
import { nextMinimum,videoPrice } from '@/lib/rules';
import { api, Art, Me } from "./ui";
import { useAuctionClosed } from './auction-countdown';
type Props = {
  slot: Slot;
  snapshot: Snapshot | null;
  me: Me;
  creative: Creative;
  setCreative: Dispatch<SetStateAction<Creative>>;
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
  const auctionClosed = useAuctionClosed(p.snapshot?.auction);
  const { slot, creative: c, me } = p;
  const format = placementFormat(slot);
  const video = c.mode === "video";
  const checkoutRef = useRef<HTMLDivElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const [retryFile,setRetryFile]=useState<File|null>(null);
  const [uploadProgress,setUploadProgress]=useState('');
  const publicSlot=p.snapshot?.slots.find(s=>s.id===slot.id);
  const startingPrice=nextMinimum(publicSlot?.total || 0,publicSlot?.opening || slot.opening,p.snapshot?.preset);
  useEffect(() => () => uploadController.current?.abort(), []);
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
      videoFee:number;
      rankingDue:number;
      videoCredit:number;
      upgrade:boolean;
    } | null>(null);
  const quoteKey = `${p.approvedId}:${slot.id}:${target}`;
  const price = quote?.key === quoteKey ? quote : null;
  const action = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(requestErrorMessage(e));
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
    if (!p.approvedId || auctionClosed) return;
    let live = true;
    const t = setTimeout(() => {
      void api<{
        minimum: number;
        existing: number;
        target: number;
        due: number;
        videoFee:number;
        rankingDue:number;
        videoCredit:number;
        upgrade:boolean;
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
  }, [p.approvedId, slot.id, target, p.snapshot?.version, isLeading, quoteKey, auctionClosed]);
  useEffect(() => {
    if (p.approvedId || error)
      checkoutRef.current?.scrollIntoView({ block: "start" });
  }, [p.approvedId, error]);
  const upload = (f: File) =>
    action(async () => {
      const controller = new AbortController();
      uploadController.current?.abort();
      uploadController.current = controller;
      setRetryFile(f);
      if (f.size > (video?MAX_VIDEO_BYTES:MAX_MEDIA_BYTES))
        throw new Error(video?'Upload a video up to 50 MB.':'Upload an image up to 4 MB.');
      setUploadProgress('Preparing preview...');
      let d:{kind:string;url:string;poster?:string};
      if(video) d=await uploadVideo(f,await videoPoster(f),controller.signal,setUploadProgress);
      else {
        const form=new FormData();form.append('file',f);
        const r=await fetch('/api/upload',{method:'POST',body:form,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
        const response=await r.json().catch(()=>({error:'Upload interrupted. Please retry.'}));
        if(!r.ok)throw new Error(response.error);
        d=response;
      }
      if (d.kind !== (video ? "video" : "image"))
        throw new Error(
          "Choose the matching image or video option, then upload again.",
        );
      controller.signal.throwIfAborted();
      setRetryFile(null);
      setUploadProgress('');
      p.setCreative((latest) => ({
        ...latest,
        mode: video ? "video" : "upload",
        image: d.url,
        poster: d.poster || "",
        logo: "",
        fit: "cover",
        cropX: 50,
        cropY: 50,
      }));
      p.setApprovedId("");
      setAccepted(false);
      setSaved("Saving draft…");
    });
  const chooseMedia = (mode: "upload" | "video") => {
    if (busy || c.mode === mode) return;
    p.setCreative({
      ...c,
      mode,
      image: "",
      poster: "",
      logo: "",
      fit: "cover",
    });
    p.setApprovedId("");
    setAccepted(false);
  };
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
      <div className="media-spec">
        <span className="eyebrow">YOUR BILLBOARD FORMAT</span>
        <strong>
          {format.label} <small>aspect ratio</small>
        </strong>
        <span>
          Recommended: {format.width} × {format.height} px
        </span>
        {slot.segments.length > 1 && (
          <p>
            Upload one continuous design. It wraps across the entire corner.
          </p>
        )}
      </div>
      <div className="segmented" aria-label="Creative format">
        <button
          disabled={busy}
          aria-pressed={!video}
          className={!video ? "chosen" : ""}
          onClick={() => chooseMedia("upload")}
        >
          <ImageIcon size={15} /> Image / logo
        </button>
        <button
          disabled={busy}
          aria-pressed={video}
          className={video ? "chosen" : ""}
          onClick={() => chooseMedia("video")}
        >
          <Video size={15} /> Looping video
        </button>
      </div>
      <p className="media-pricing"><strong>Image {money(startingPrice)} · Video {money(videoPrice(startingPrice))}</strong><br />Video adds a 50% format fee. Existing bidding and video credits are applied at checkout. Before tax.</p>
      {c.mode === "template" && (
        <p className="notice">
          This is a previously saved design. Upload an image or video to replace
          it.
        </p>
      )}
      <label className={`upload-zone ${busy ? "upload-busy" : ""}`}>
        {busy ? (
          <LoaderCircle className="spin" size={20} />
        ) : (
          <Upload size={20} />
        )}
        <strong>
          {busy
            ? uploadProgress || "Preparing your upload…"
            : c.image
              ? "Replace your upload"
              : video
                ? "Upload your video"
                : "Upload your image or logo"}
        </strong>
        <span>
          {video
            ? "H.264 MP4 · up to 30 seconds · 50 MB · 60 fps"
            : "PNG, JPEG or WebP · up to 4 MB"}
          <br />
          {video
            ? "64–1920 px per side · up to 1080p area · optional AAC audio"
            : "64–6000 px per side · up to 16 megapixels"}
        </span>
        <input
          key={video ? "video" : "image"}
          disabled={busy}
          type="file"
          aria-label={video ? "Upload video" : "Upload artwork"}
          accept={video ? "video/mp4" : "image/png,image/jpeg,image/webp"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {busy && uploadProgress && <div className="upload-feedback" role="status"><span>{uploadProgress}</span><button className="quiet" onClick={()=>uploadController.current?.abort()}>Cancel upload</button></div>}
      {!busy && error && retryFile && <button className="quiet" onClick={()=>void upload(retryFile)}>Retry upload</button>}
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
      {c.image && (
        <>
          <p className="fine">
            Your upload fills the whole billboard. Different ratios crop at the
            edges; adjust the framing below. No text or logo overlay is added.
          </p>
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
        </>
      )}
      {!video && (
        <div className="color-fields">
          <label>
            Background for transparent logos
            <input
              type="color"
              value={c.bg}
              onChange={(e) => change("bg", e.target.value)}
            />
            <span>{c.bg.toUpperCase()}</span>
          </label>
        </div>
      )}
      <p className="fine">
        Brand details appear when someone opens your billboard. Videos loop;
        audio fades in nearby after visitors enable sound. Reduced-motion visitors see the preview frame.
      </p>
      <div ref={checkoutRef}>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {auctionClosed && !isLeading ? <div className="notice">Bidding has ended. The highest bidders now hold their billboards permanently.</div> : !p.approvedId ? (
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
              disabled={busy || !c.image || c.mode === "template"}
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
                  ? auctionClosed ? "Save artwork" : "Review changes"
                  : "Continue to payment"
                : "Sign in to continue"}
              <ArrowRight size={17} />
            </button>
            <span className="save-note">{saved}</span>
          </>
        ) : isLeading && (auctionClosed || price?.due === 0) ? (
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
            {!isLeading && <label className="field">
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
            </label>}
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
                <span>Bidding credit added</span>
                <strong>{price ? money(price.rankingDue) : "—"}</strong>
              </div>
              {video && <div>
                <span>Video format fee (50%)</span>
                <strong>{price ? money(price.videoFee) : "—"}</strong>
              </div>}
              {video && Boolean(price?.videoCredit) && <div><span>Previous video credit applied</span><strong>{money(price!.videoCredit)}</strong></div>}
              <div className="due">
                <span>You pay now</span>
                <strong>{price ? money(price.due) : "—"}</strong>
              </div>
            </div>
            <p className="fine">
              USD before applicable tax. Dodo shows tax at checkout; it does not
              increase ranking. Video format fees also do not increase ranking.
              {isLeading && ' Your paid image stays displayed until the video upgrade payment is confirmed.'}
            </p>
            <div className="purchase-terms">
              <p>
                You are buying advertising on this website’s{" "}
                <strong>virtual billboard only</strong>. This does not place
                your ad on physical Times Square screens.
              </p>
              <p>
                Bidding runs for seven days from launch. The highest eligible paid total on each billboard at the deadline stays forever, subject to the content rules. Payment must be verified and applied before the countdown ends; late payments enter the refund workflow.{" "}
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
                    expectedDue:price!.due,
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
