"use client";
import dynamic from "next/dynamic";
import {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  Compass,
  X,
  MapPin,
  UserRound,
  RotateCcw,
  Play,
  Footprints,
  VolumeX,
  Volume2,
  Settings2,
  MousePointer2,
  Share2,
  Download,
  Flag,
  Search,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Mail,
  LoaderCircle,
  LogOut,
  LocateFixed,
} from "lucide-react";
import {
  Creative,
  EMPTY_CREATIVE,
  money,
  SLOTS,
  Snapshot,
  slotAspect,
  slotWidth,
} from "@/lib/registry";
import { nextMinimum } from "@/lib/rules";
import type { SceneCommand } from "./square-scene";
import { Art, api, Me, emptyMe, IconButton } from "./ui";
import { CreativeEditor } from "./creative-editor";
import { AdminPanel, Rules, AccountPanel } from "./panels";
const Scene = dynamic(() => import("./square-scene"), { ssr: false });
type Panel =
  | "detail"
  | "directory"
  | "map"
  | "rules"
  | "editor"
  | "account"
  | "auth"
  | "admin"
  | "checkout"
  | "settings"
  | "report"
  | null;
type Checkout = {
  id: string;
  state: string;
  due: number;
  target: number;
  mode: string;
  slot_id?: string;
  failure_code?: string | null;
  cutoff_at?: string;
};
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}
export default function PaperSquare() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [me, setMe] = useState<Me>(emptyMe),
    [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<string | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [fallback, setFallback] = useState(false),
    [intro, setIntro] = useState(true),
    [quality, setQuality] = useState("medium"),
    [reduced, setReduced] = useState(false),
    [sound, setSound] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [mapLocation, setMapLocation] = useState(""),
    [category, setCategory] = useState("All"),
    [tab, setTab] = useState("placements"),
    [command, setCommand] = useState<SceneCommand>({ type: "reset", nonce: 0 }),
    [creative, setCreative] = useState<Creative>({ ...EMPTY_CREATIVE }),
    [brandId, setBrandId] = useState<string>(),
    [approvedId, setApprovedId] = useState(""),
    [preview, setPreview] = useState(false),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [localCode, setLocalCode] = useState(""),
    [afterAuth, setAfterAuth] = useState<Panel>("account"),
    [checkout, setCheckout] = useState<Checkout | null>(null),
    [report, setReport] = useState("");
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const changed = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", changed);
    return () => document.removeEventListener("pointerlockchange", changed);
  }, []);
  const joystick = useRef({ x: 0, y: 0 }),
    panelRef = useRef<HTMLElement>(null),
    version = useRef(-1),
    audio = useRef<AudioContext | null>(null),
    noise = useRef<AudioBufferSourceNode | null>(null);
  const slot = SLOTS.find((s) => s.id === selected) || SLOTS[0],
    state = snapshot?.slots.find((s) => s.id === slot.id),
    hovered = SLOTS.find((s) => s.id === hover),
    hoverState = snapshot?.slots.find((s) => s.id === hover),
    simulation = snapshot?.mode === "simulation";
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  const refresh = useCallback(async () => {
    const data = await api<Snapshot>("public");
    if (data.version < version.current) return;
    version.current = data.version;
    setSnapshot((prev) =>
      prev
        ? {
            ...data,
            slots: data.slots.map((s) => {
              const old = prev.slots.find((p) => p.id === s.id);
              return old?.version === s.version && old.reserved === s.reserved
                ? old
                : s;
            }),
          }
        : data,
    );
  }, []);
  const authRead = useRef(0);
  const refreshMe = useCallback(async () => {
    const generation = ++authRead.current;
    const m = await api<Me>("me");
    if (generation === authRead.current) setMe(m);
    return m;
  }, []);
  const tracked = useRef(new Set<string>());
  const currentSnapshot = useRef(snapshot);
  useEffect(() => { currentSnapshot.current = snapshot; }, [snapshot]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const track = useCallback((kind: string, slotId = "square") => {
    const creativeId = currentSnapshot.current?.slots.find(s => s.id === slotId)?.creativeId || "house";
    const key = `${new Date().toISOString().slice(0, 10)}:${kind}:${slotId}:${creativeId}`;
    if (!document.hidden && !tracked.current.has(key)) {
      tracked.current.add(key);
      void api("analytics", { kind, slotId }).catch(() => tracked.current.delete(key));
    }
  }, []);
  const cmd = useCallback(
    (type: SceneCommand["type"], id?: string) =>
      setCommand({ type, id, nonce: Date.now() }),
    [],
  );
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setPanel("detail");
      setPreview(false);
      setIntro(false);
      history.pushState({}, "", `/?billboard=${id}`);
      track("panel", id);
    },
    [track],
  );
  const onReady = useCallback(() => setReady(true), []),
    onFallback = useCallback(() => {
      setFallback(true);
      setReady(true);
      setPanel("directory");
    }, []),
    onView = useCallback((id: string) => track("view", id), [track]);
  const close = () => {
    setPanel(null);
    setPreview(false);
    if (panel === "detail") {
      setSelected(null);
      history.pushState({}, "", "/");
    }
  };
  const open = (p: Panel) => {
    setPanel(p);
    setIntro(false);
    setError("");
    if (p === "directory" || p === "map") setMapLocation("");
    if (p === "directory") track("directory");
  };
  const editor = (id = slot.id) => {
    setSelected(id);
    cmd("view", id);
    setPanel("editor");
    setPreview(true);
    setIntro(false);
  };
  // Browser preferences and URL state are read after hydration, then synchronized by events.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    void refreshMe().catch(() => {});
    void api<{ data: { creative: Creative; brandId?: string } } | null>("draft")
      .then((d) => {
        if (d?.data.creative) {
          setCreative(d.data.creative);
          setBrandId(d.data.brandId);
        }
      })
      .catch(() => {});
    track("visit");
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 5000);
    setQuality(localStorage.getItem("paper-quality") || "medium");
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (sessionStorage.getItem("paper-intro")) setIntro(false);
    const sync = () => {
      const u = new URL(location.href),
        s = u.searchParams.get("billboard"),
        o = u.searchParams.get("checkout");
      if (s) {
        if (SLOTS.some((x) => x.id === s)) {
          setSelected(s);
          setPanel("detail");
          cmd("view", s);
          setIntro(false);
        } else {
          setPanel("directory");
          notify("That placement is no longer available.");
        }
      } else if (o) {
        setCheckout({
          id: o,
          state: "pending",
          due: 0,
          target: 0,
          mode: "unknown",
        });
        setPanel("checkout");
        setIntro(false);
      } else {
        setSelected(null);
        setPanel(null);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("popstate", sync);
    };
  }, [refresh, refreshMe, track, cmd, notify]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!panel) return;
    joystick.current = { x: 0, y: 0 };
    const previous = document.activeElement as HTMLElement;
    const t = setTimeout(() => panelRef.current?.focus(), 20);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        setPreview(false);
        if (panel === "detail") {
          setSelected(null);
          history.pushState({}, "", "/");
        }
      }
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
      previous?.focus?.();
    };
  }, [panel]);
  const checkoutId = checkout?.id,
    accountId = me.account?.id;
  useEffect(() => {
    if (panel !== "checkout" || !checkoutId || !accountId) return;
    let active = true;
    const update = () =>
      api<Checkout>("checkout/status", { orderId: checkoutId })
        .then((o) => {
          if (active) {
            setCheckout(o);
            if (["delivered", "refunded", "refund_pending"].includes(o.state)) {
              void refresh();
              void refreshMe();
            }
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void update();
    const t = setInterval(() => {
      if (!document.hidden) void update();
    }, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [panel, checkoutId, accountId, refresh, refreshMe]);
  const toggleSound = () => {
    if (sound) {
      noise.current?.stop();
      void audio.current?.close();
      setSound(false);
      return;
    }
    const c = new AudioContext();
    audio.current = c;
    const buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate),
      d = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + Math.random() * 0.03 - 0.015) / 1.02;
      d[i] = last;
    }
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0.05;
    source.connect(gain).connect(c.destination);
    source.start();
    noise.current = source;
    setSound(true);
  };
  useEffect(() => {
    const pause = () => {
      if (document.hidden) void audio.current?.suspend();
      else if (sound) void audio.current?.resume();
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [sound]);
  const share = async () => {
    const url = `${location.origin}/?billboard=${slot.id}`;
    if (navigator.share)
      try {
        await navigator.share({ title: `${slot.name} · Paper Square`, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    try {
      await navigator.clipboard.writeText(url);
      notify("Billboard link copied.");
    } catch {
      notify(url);
    }
  };
  const postcard = () => {
    try {
      const scene = document.querySelector(
        ".scene canvas",
      ) as HTMLCanvasElement | null;
      if (!scene || fallback)
        throw new Error("Open the 3D view to download its postcard.");
      const c = document.createElement("canvas");
      c.width = scene.width;
      c.height = scene.height + 100;
      const g = c.getContext("2d")!;
      g.fillStyle = "#f5f1e5";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(scene, 0, 0);
      g.fillStyle = "#234153";
      g.font = "22px Arial";
      g.fillText(
        `Paper Square / ${slot.name} · Virtual billboard`,
        30,
        c.height - 57,
      );
      g.font = "15px Arial";
      g.fillText(`${location.origin}/?billboard=${slot.id}`, 30, c.height - 26);
      const a = document.createElement("a");
      a.download = `paper-square-${slot.id}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
      notify("Current 3D view saved as a postcard.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const title: Record<NonNullable<Panel>, string> = {
    detail: slot.name,
    directory: "Around the square",
    map: "Find your corner",
    rules: "A little square. Clear rules.",
    editor: "Make your mark",
    account: "Your corner of the square",
    auth: "Welcome to the square",
    admin: "Square management",
    checkout: "Your placement",
    settings: "Make yourself comfortable",
    report: "Report this listing",
  };
  return (
    <main className="paper-app">
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => {
            close();
            cmd("reset");
          }}
          aria-label="Paper Square home"
        >
          <span className="logo-mark">
            <Building2 size={25} strokeWidth={1.5} />
          </span>
          <span>{snapshot?.name || "Paper Square"}</span>
        </button>
        <nav aria-label="Main navigation">
          <button className={!panel ? "nav-active" : ""} onClick={close}>
            Explore
            <span className="tiny-dot" />
          </button>
          <button
            className={panel === "directory" ? "nav-active" : ""}
            onClick={() => open("directory")}
          >
            Directory
          </button>
          <button
            className={panel === "map" ? "nav-active" : ""}
            onClick={() => open("map")}
          >
            Map
          </button>
        </nav>
        <div className="header-right">
          <button className="how-link" onClick={() => open("rules")}>
            How it works <ArrowUpRight size={14} />
          </button>
          <button
            className="primary header-cta"
            onClick={() => {
              setTab("placements");
              setCategory("All");
              open("directory");
            }}
          >
            Get a billboard <ArrowUpRight size={16} />
          </button>
          <IconButton
            label="Your account"
            onClick={() => {
              if (me.account) open("account");
              else {
                setAfterAuth("account");
                open("auth");
              }
            }}
          >
            <UserRound size={19} />
          </IconButton>
        </div>
      </header>
      <div
        className="scene"
        role="region"
        aria-label="Interactive three-dimensional Times Square"
      >
        <SceneBoundary key={fallback ? "fallback" : "scene"} onError={onFallback}>
          {!fallback && (
            <Scene
              slots={snapshot?.slots || []}
              selected={selected || hover}
              preview={preview ? creative : undefined}
              paused={!!panel}
              quality={quality}
              reduced={reduced}
              command={command}
              joystick={joystick}
              onSelect={select}
              onHover={setHover}
              onReady={onReady}
              onFallback={onFallback}
              onView={onView}
              onStatus={notify}
            />
          )}
        </SceneBoundary>
        {(!ready || fallback) && (
          <div className="scene-loading">
            <Building2 size={38} />
            <p>
              {fallback
                ? "Every corner is still within reach."
                : "Drawing a little Times Square…"}
            </p>
            <span>
              {fallback
                ? `Browse all ${SLOTS.length} placements in the directory.`
                : "One city. A world of possibilities."}
            </span>
            {fallback && (
              <button className="primary" onClick={() => open("directory")}>
                Open directory <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="paper-grain" aria-hidden="true" />
      {locked && (
        <div className="reticle" aria-hidden="true">
          +
        </div>
      )}
      <div className="scene-caption">
        <span className="live-dot" />
        MANHATTAN, REIMAGINED <span className="caption-divider">/</span>
        <span className="caption-secondary">40.7580° N · 73.9855° W</span>
      </div>
      {simulation && (
        <div className="mode-badge">
          LOCAL EDITION <span>Simulated payments</span>
        </div>
      )}
      {!panel && intro && (
        <section className="intro-card">
          <button
            className="intro-close"
            aria-label="Dismiss introduction"
            onClick={() => {
              setIntro(false);
              sessionStorage.setItem("paper-intro", "1");
            }}
          >
            <X size={15} />
          </button>
          <span className="eyebrow">BIG IDEAS. HAPPY ACCIDENTS.</span>
          <h1>
            Small brands.
            <br />
            <em>Big presence.</em>
          </h1>
          <p>
            Take a stroll. Find your next favorite.
            <br />
            A little Times Square for the internet.
          </p>
          <button
            className="intro-link"
            onClick={() => {
              setIntro(false);
              cmd("tour");
            }}
          >
            Take a little look around <ArrowRight size={19} />
          </button>
          <div className="intro-foot">
            <MousePointer2 size={13} />
            <span>Drag to look · WASD to walk · Click a billboard</span>
          </div>
        </section>
      )}
      {!panel && !intro && (
        <div className="location-chip">
          <MapPin size={15} />
          <div>
            <strong>{selected ? slot.location : "Duffy Square"}</strong>
            <span>
              {preview
                ? "YOUR CREATIVE · LIVE PREVIEW"
                : "A LITTLE TIMES SQUARE FOR THE INTERNET"}
            </span>
          </div>
          {preview && (
            <button onClick={() => open("editor")}>
              Back to editor <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
      {!panel && hovered && (
        <div className="billboard-tooltip">
          <span className="eyebrow">
            {hovered.id.toUpperCase()} ·{" "}
            {hoverState?.creative ? "ON THE BILLBOARD" : "AVAILABLE TO CLAIM"}
          </span>
          <strong>{hoverState?.creative?.name || hovered.name}</strong>
          <span>{hoverState?.creative?.tagline || hovered.location}</span>
          <div>
            {hoverState?.total
              ? `Leading at ${money(hoverState.total)}`
              : `Claim from ${money(hoverState?.opening || hovered.opening)}`}
            <ArrowUpRight size={16} />
          </div>
        </div>
      )}
      <div className={`explore-tools ${panel ? "tools-muted" : ""}`}>
        <IconButton
          label="Reset view"
          onClick={() => {
            cmd("reset");
            setSelected(null);
          }}
        >
          <RotateCcw size={17} />
        </IconButton>
        <IconButton
          label="Guided tour"
          onClick={() => {
            close();
            cmd("tour");
            setIntro(false);
          }}
        >
          <Play size={17} />
        </IconButton>
        <IconButton
          label="Walk mode"
          onClick={() => {
            close();
            cmd("walk");
            setIntro(false);
          }}
        >
          <Footprints size={18} />
        </IconButton>
        <span />
        <IconButton
          label={sound ? "Mute ambient sound" : "Enable ambient sound"}
          onClick={toggleSound}
        >
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </IconButton>
        <IconButton
          label="Quality and controls"
          onClick={() => open("settings")}
        >
          <Settings2 size={17} />
        </IconButton>
      </div>
      {!panel && (
        <>
          <div className="compass">
            <span>N</span>
            <Compass size={34} strokeWidth={1} />
            <small>LOOK AROUND</small>
          </div>
          <div className="touch-controls">
            <div
              className="joystick"
              role="group"
              aria-label="Movement joystick"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const b = e.currentTarget.getBoundingClientRect();
                joystick.current = {
                  x: (e.clientX - b.left - b.width / 2) / (b.width / 2),
                  y: (e.clientY - b.top - b.height / 2) / (b.height / 2),
                };
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const b = e.currentTarget.getBoundingClientRect();
                joystick.current = {
                  x: Math.max(
                    -1,
                    Math.min(
                      1,
                      (e.clientX - b.left - b.width / 2) / (b.width / 2),
                    ),
                  ),
                  y: Math.max(
                    -1,
                    Math.min(
                      1,
                      (e.clientY - b.top - b.height / 2) / (b.height / 2),
                    ),
                  ),
                };
              }}
              onPointerUp={() => (joystick.current = { x: 0, y: 0 })}
              onPointerCancel={() => (joystick.current = { x: 0, y: 0 })}
            >
              <span>
                <Plus size={22} />
              </span>
            </div>
            <span>Drag to look</span>
          </div>
        </>
      )}
      <footer className="scene-footer">
        <span>Independent ideas. An iconic address.</span>
        <button onClick={() => open("rules")}>
          Virtual billboards. Real possibilities. <ArrowUpRight size={12} />
        </button>
        <button
          onClick={() => {
            setTab("placements");
            setCategory("All");
            open("directory");
          }}
        >
          <span className="live-dot" />
          {snapshot?.slots.filter(
            (s) => s.available && !s.brandId && !s.reserved,
          ).length ?? SLOTS.length}{" "}
          unclaimed / {SLOTS.length} placements <ArrowRight size={14} />
        </button>
      </footer>
      {panel && (
        <>
          <div className="drawer-scrim" onClick={close} />
          <aside
            className={`drawer ${["directory", "map", "admin", "account"].includes(panel) ? "drawer-wide" : ""}`}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const nodes = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex='0']",
                ),
              );
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (
                e.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === e.currentTarget)
              ) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow">
                  {panel === "detail"
                    ? `${slot.id.toUpperCase()} / ${slot.tier.toUpperCase()} PLACEMENT`
                    : "PAPER SQUARE"}
                </span>
                <h2 id="panel-title">{title[panel]}</h2>
              </div>
              <IconButton label="Close panel" onClick={close}>
                <X size={20} />
              </IconButton>
            </div>
            <div className="drawer-body" tabIndex={0}>
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              {panel === "detail" && (
                <>
                  <Art
                    creative={state?.creative}
                    art={slot.art}
                    ratio={slotAspect(slot)}
                  />
                  <div className="placement-caption">
                    <MapPin size={14} />
                    {slot.location}
                    <span>
                      {slotWidth(slot)} × {slot.segments[0].height} m
                      {slot.segments.length > 1 ? " · Wraparound" : ""}
                    </span>
                  </div>
                  {state?.creative ? (
                    <>
                      <div className="brand-heading">
                        <div
                          className="brand-monogram"
                          style={{
                            background: state.creative.bg,
                            color: state.creative.fg,
                          }}
                        >
                          {state.creative.name[0]}
                        </div>
                        <div>
                          <h3>{state.creative.name}</h3>
                          <a
                            href={state.creative.url}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            onClick={() => track("click", slot.id)}
                          >
                            {new URL(state.creative.url).hostname}
                            <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </div>
                      <p>
                        {state.creative.description || state.creative.tagline}
                      </p>
                      <a
                        className="primary full"
                        href={state.creative.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        onClick={() => track("click", slot.id)}
                      >
                        Visit website <ArrowUpRight size={16} />
                      </a>
                      {state.creative.social && (
                        <a
                          className="text-link"
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          href={state.creative.social}
                        >
                          Social profile <ArrowUpRight size={14} />
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="empty-placement">
                      <span className="pill">HOUSE ART · AVAILABLE</span>
                      <h3>A big canvas for your next big thing.</h3>
                      <p>
                        This original house artwork is keeping your spot warm.
                        Preview your brand right here in the square.
                      </p>
                    </div>
                  )}
                  <div className="price-box">
                    <div>
                      <span>
                        {state?.total
                          ? "Current paid ranking"
                          : "Opening ranking"}
                      </span>
                      <strong>
                        {money(state?.total || state?.opening || slot.opening)}
                      </strong>
                    </div>
                    <div>
                      <span>Next minimum ranking</span>
                      <strong>
                        {money(
                          nextMinimum(
                            state?.total || 0,
                            state?.opening || slot.opening,
                            snapshot?.preset,
                          ),
                        )}
                      </strong>
                    </div>
                  </div>
                  {state?.reserved && (
                    <div className="notice">
                      <Clock size={16} />
                      Another checkout is being resolved. The current artwork
                      stays visible.
                    </div>
                  )}
                  <button
                    className="primary full"
                    disabled={state?.available === false || state?.reserved}
                    onClick={() => {
                      setApprovedId("");
                      editor();
                    }}
                  >
                    {state?.available === false
                      ? "Unavailable"
                      : state?.brandId
                        ? "Outbid this brand"
                        : "Claim this billboard"}
                    <ArrowUpRight size={17} />
                  </button>
                  <p className="fine">
                    One payment. Featured until outbid. Virtual advertising on
                    this website only.
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => {
                        cmd("view", slot.id);
                        setPanel(null);
                      }}
                    >
                      <LocateFixed size={16} />
                      View placement
                    </button>
                    <button className="secondary" onClick={() => void share()}>
                      <Share2 size={16} />
                      Share
                    </button>
                    <IconButton
                      label="Download current view as postcard"
                      onClick={postcard}
                    >
                      <Download size={17} />
                    </IconButton>
                  </div>
                  <div className="section-heading">
                    <h3>Paid history</h3>
                    <span>{state?.history.length || 0} placements</span>
                  </div>
                  {state?.history.length ? (
                    state.history.map((h, i) => (
                      <div className="history-row" key={h.at + i}>
                        <div>
                          <strong>{h.name}</strong>
                          <span>
                            {new Date(h.at).toLocaleDateString()} ·{" "}
                            {h.until ? "Displaced" : "On display"}
                          </span>
                        </div>
                        <b>{money(h.total)}</b>
                      </div>
                    ))
                  ) : (
                    <p className="empty-copy">
                      A fresh start. No paid placements yet.
                    </p>
                  )}
                  <p className="fine">
                    Outbid brands stay in the directory. Their applied spending
                    on this billboard counts toward a later takeover. No
                    automatic refund for being outbid.
                  </p>
                  <button className="quiet" onClick={() => open("report")}>
                    <Flag size={13} />
                    Report this listing
                  </button>
                </>
              )}
              {(panel === "directory" || panel === "map") && (
                <>
                  <p className="panel-intro">
                    {SLOTS.length} little stages. Find the one that feels like
                    you.
                  </p>
                  {panel === "directory" && (
                    <button className="secondary full" onClick={() => open("map")}>
                      <MapPin size={16} /> View placement map
                    </button>
                  )}
                  <div className="segmented">
                    {[
                      ["placements", "Billboards"],
                      ["brands", "Brands"],
                      ["leaderboard", "Leaderboard"],
                    ].map(([id, t]) => (
                      <button
                        key={id}
                        className={tab === id ? "chosen" : ""}
                        onClick={() => {
                          setTab(id);
                          setCategory("All");
                        }}
                      >
                        {t}
                        {id === "placements" && <span>{SLOTS.length}</span>}
                      </button>
                    ))}
                  </div>
                  {panel === "map" && (
                    <div
                      className="square-map"
                      role="group"
                      aria-label="Map of billboard locations"
                    >
                      <span className="map-north">N ↑</span>
                      <div className="avenue" />
                      <div className="broadway" />
                      <span className="map-label map-broadway">BROADWAY</span>
                      <span className="map-label map-avenue">7TH AVENUE</span>
                      {["47", "46", "45", "44", "43", "42"].map((s, i) => (
                        <div
                          className="map-street"
                          key={s}
                          style={{ top: `${12 + i * 15}%` }}
                        >
                          <span>W {s} ST</span>
                        </div>
                      ))}
                      <div className="map-steps">TKTS</div>
                      {Array.from(
                        new Set(SLOTS.map((s) => s.location.split(" · ")[0])),
                      ).map((location) => {
                        const group = SLOTS.filter(
                          (s) => s.location.split(" · ")[0] === location,
                        );
                        const s = group[0];
                        return (
                          <button
                            key={s.id}
                            className="map-pin"
                            style={{
                              left: `${50 + s.segments[0].position[0] * 1.15}%`,
                              top: `${15 + (s.segments[0].position[2] + 100) * 0.36}%`,
                            }}
                            title={`${location} · ${group.length} placements`}
                            aria-label={`Show ${group.length} placements at ${location}`}
                            onClick={() => {
                              setTab("placements");
                              setCategory("All");
                              setMapLocation(location);
                              setSearch("");
                            }}
                          >
                            {group.length}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search directory"
                      placeholder={
                        tab === "placements"
                          ? "Find a billboard or location"
                          : "Search independent brands"
                      }
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setMapLocation("");
                      }}
                    />
                  </label>
                  <div className="filter-row">
                    {mapLocation && (
                      <button onClick={() => setMapLocation("")}>
                        {mapLocation} · Show all locations
                      </button>
                    )}
                    {(tab === "placements"
                      ? ["All", "Premium", "Standard", "Small"]
                      : [
                          "All",
                          "Technology",
                          "Design",
                          "Culture",
                          "Food & drink",
                          "Other",
                        ]
                    ).map((c) => (
                      <button
                        className={category === c ? "selected" : ""}
                        key={c}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {tab === "placements" ? (
                    <div className="placement-grid">
                      {SLOTS.filter(
                        (s) =>
                          (!mapLocation ||
                            s.location.split(" · ")[0] === mapLocation) &&
                          `${s.name} ${s.location}`
                            .toLowerCase()
                            .includes(search.toLowerCase()) &&
                          (category === "All" || s.tier === category),
                      ).map((s) => {
                        const st = snapshot?.slots.find((x) => x.id === s.id);
                        return (
                          <button
                            className="placement-card"
                            key={s.id}
                            onClick={() => {
                              select(s.id);
                              cmd("view", s.id);
                            }}
                          >
                            <Art
                              creative={st?.creative}
                              art={s.art}
                              ratio={slotAspect(s)}
                              thumbnail
                            />
                            <div className="card-title">
                              <strong>{s.name}</strong>
                              <ArrowUpRight size={17} />
                            </div>
                            <span>{s.location}</span>
                            <div className="card-bottom">
                              <span>
                                {st?.available === false
                                  ? "Unavailable"
                                  : st?.brandId
                                    ? st.creative?.name
                                    : "Available"}
                              </span>
                              <b>
                                {money(st?.total || st?.opening || s.opening)}
                                <small>
                                  {st?.total ? " leading" : " to start"}
                                </small>
                              </b>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <p className="fine">
                        {tab === "leaderboard"
                          ? "Ranked by net applied principal across all slots, not revenue for a reporting period."
                          : "Displaced advertisers remain discoverable here."}
                      </p>
                      {snapshot?.directory
                        .filter(
                          (b) =>
                            b.creative.name
                              .toLowerCase()
                              .includes(search.toLowerCase()) &&
                            (category === "All" ||
                              b.creative.category === category),
                        )
                        .sort((a, b) => b.total - a.total)
                        .map((b, i) => (
                          <div className="directory-brand" key={b.id}>
                            <span className="rank">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div
                              className="brand-monogram"
                              style={{
                                background: b.creative.bg,
                                color: b.creative.fg,
                              }}
                            >
                              {b.creative.name[0]}
                            </div>
                            <div>
                              <h3>{b.creative.name}</h3>
                              <p>{b.creative.tagline}</p>
                              <a
                                className="text-link"
                                href={b.creative.url}
                                target="_blank"
                                rel="noopener noreferrer sponsored"
                              >
                                {new URL(b.creative.url).hostname}
                                <ArrowUpRight size={13} />
                              </a>
                              {(b.paidSlots || b.slots).map((id) => (
                                <button
                                  className="quiet"
                                  key={id}
                                  onClick={() => {
                                    select(id);
                                    cmd("view", id);
                                  }}
                                >
                                  {b.slots.includes(id)
                                    ? "On"
                                    : "Previously on"}{" "}
                                  {SLOTS.find((s) => s.id === id)?.name}{" "}
                                  <ArrowRight size={13} />
                                </button>
                              ))}
                            </div>
                            <b>{money(b.total)}</b>
                          </div>
                        ))}
                      {!snapshot?.directory.length && (
                        <div className="empty-state">
                          <Building2 size={34} />
                          <h3>The first chapter is still yours.</h3>
                          <p>
                            Advertisers appear after payment is applied. House
                            artwork isn’t a paid sponsor.
                          </p>
                          <button
                            className="secondary"
                            onClick={() => {
                              setTab("placements");
                              setCategory("All");
                            }}
                          >
                            Find a billboard <ArrowRight size={15} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="section-heading">
                    <h3>
                      {simulation
                        ? "Recent simulated takeovers"
                        : "Recent takeovers"}
                    </h3>
                  </div>
                  {(snapshot?.slots || [])
                    .flatMap((s) =>
                      s.history
                        .filter((h) => h.kind === "takeover")
                        .map((h) => ({ ...h, slotId: s.id })),
                    )
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .slice(0, 5)
                    .map((h) => (
                      <button
                        className="history-row full"
                        key={h.slotId + h.at}
                        onClick={() => {
                          select(h.slotId);
                          cmd("view", h.slotId);
                        }}
                      >
                        <div>
                          <strong>{h.name}</strong>
                          <span>
                            {SLOTS.find((s) => s.id === h.slotId)?.name} ·{" "}
                            {new Date(h.at).toLocaleDateString()}
                          </span>
                        </div>
                        <b>{money(h.total)}</b>
                      </button>
                    ))}
                  {!(snapshot?.slots || []).some((s) =>
                    s.history.some((h) => h.kind === "takeover"),
                  ) && (
                    <p className="empty-copy">
                      Takeovers appear only after a payment is applied.
                    </p>
                  )}
                  <div className="directory-note">
                    <Compass size={22} />
                    <p>
                      Explore at your own pace.
                      <br />
                      <span>
                        Every placement can be purchased here without 3D
                        navigation.
                      </span>
                    </p>
                  </div>
                </>
              )}
              {panel === "rules" && <Rules support={snapshot?.support || ""} />}
              {panel === "editor" && (
                <CreativeEditor
                  slot={slot}
                  snapshot={snapshot}
                  me={me}
                  creative={creative}
                  setCreative={setCreative}
                  brandId={brandId}
                  setBrandId={setBrandId}
                  approvedId={approvedId}
                  setApprovedId={setApprovedId}
                  onView={() => {
                    setPanel(null);
                    cmd("view", slot.id);
                  }}
                  onAuth={() => {
                    setAfterAuth("editor");
                    open("auth");
                  }}
                  onReady={() => {
                    void refreshMe();
                    void refresh();
                  }}
                  onChangePlacement={() => open("directory")}
                  onCheckout={(o) => {
                    setCheckout(o);
                    setPreview(false);
                    history.pushState({}, "", `/?checkout=${o.id}`);
                    open("checkout");
                  }}
                />
              )}
              {panel === "auth" && (
                <>
                  <div className="auth-illustration">
                    <Mail size={35} strokeWidth={1} />
                  </div>
                  <p className="panel-intro">
                    Your ideas deserve a place here.
                    <br />
                    Sign in with a one-time email code.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(async () => {
                        if (!sent) {
                          const r = await api<{ localCode?: string }>(
                            "auth/send",
                            { email },
                          );
                          setSent(true);
                          setLocalCode(r.localCode || "");
                        } else {
                          await api("auth/verify", { email, code });
                          await refreshMe();
                          setSent(false);
                          setCode("");
                          setPanel(afterAuth);
                          notify(
                            "You’re signed in. Your draft is right where you left it.",
                          );
                        }
                      });
                    }}
                  >
                    <label className="field">
                      Email address
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setSent(false);
                        }}
                        placeholder="you@yourbrand.com"
                      />
                    </label>
                    {sent && (
                      <label className="field">
                        One-time code
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="000000"
                        />
                      </label>
                    )}
                    {localCode && sent && (
                      <div className="notice">
                        <span>
                          <strong>Local email simulation</strong>
                          <br />
                          Your development code is <b>{localCode}</b>. No email
                          was sent.
                        </span>
                      </div>
                    )}
                    <button className="primary full" disabled={busy}>
                      {busy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : sent ? (
                        "Verify & continue"
                      ) : (
                        "Send sign-in code"
                      )}
                      <ArrowRight size={17} />
                    </button>
                  </form>
                  <p className="fine">
                    Your email is private and never appears in the directory.
                    Your draft is preserved through sign-in.
                  </p>
                  {simulation && (
                    <p className="fine local-note">
                      Local operator account: operator@paper.local. Development
                      login is disabled in production.
                    </p>
                  )}
                </>
              )}
              {panel === "account" && (
                <>
                  <div className="account-strip">
                    <div className="brand-monogram">
                      <UserRound size={23} />
                    </div>
                    <div>
                      <strong>{me.account?.email}</strong>
                      <span>Advertiser account</span>
                    </div>
                    <IconButton
                      label="Sign out"
                      onClick={() =>
                        void action(async () => {
                          await api("auth/logout", {});
                          authRead.current++;
                          setMe(emptyMe);
                          setCreative({ ...EMPTY_CREATIVE });
                          setBrandId(undefined);
                          setApprovedId("");
                          setPreview(false);
                          open("auth");
                        })
                      }
                    >
                      <LogOut size={18} />
                    </IconButton>
                  </div>
                  {me.account?.role === "admin" && (
                    <button
                      className="secondary full"
                      onClick={() => open("admin")}
                    >
                      <ShieldCheck size={17} />
                      Open square management <ArrowRight size={17} />
                    </button>
                  )}
                  <AccountPanel
                    snapshot={snapshot}
                    me={me}
                    onNew={() => {
                      setCreative({ ...EMPTY_CREATIVE });
                      setBrandId(undefined);
                      setApprovedId("");
                      editor();
                    }}
                    onEdit={(b) => {
                      setCreative(b.data);
                      setBrandId(b.id);
                      setApprovedId(
                        b.status === "approved" ? b.creative_id : "",
                      );
                      editor();
                    }}
                    onSelect={(id) => {
                      select(id);
                      cmd("view", id);
                    }}
                    onOrder={(o) => {
                      setCheckout(o);
                      open("checkout");
                    }}
                  />
                </>
              )}
              {panel === "admin" && (
                <AdminPanel
                  snapshot={snapshot}
                  notify={notify}
                  onChanged={() => {
                    void refresh();
                    void refreshMe();
                  }}
                />
              )}
              {panel === "checkout" && (
                <>
                  <div
                    className={`checkout-icon ${checkout?.state === "delivered" ? "success" : ""}`}
                  >
                    {checkout?.state === "delivered" ? (
                      <CheckCircle2 size={42} />
                    ) : (
                      <Clock size={42} />
                    )}
                  </div>
                  <h3 className="checkout-title">
                    {checkout?.state === "delivered"
                      ? "You’re up in the square."
                      : checkout?.state === "refunded"
                        ? "Your refund is confirmed."
                        : checkout?.state === "refund_pending"
                          ? "Your refund is being arranged."
                          : checkout?.state === "expired"
                            ? "This reservation has expired."
                            : checkout?.state === "failed"
                              ? "The payment was declined."
                              : "One step closer to the big screen."}
                  </h3>
                  {!me.account ? (
                    <>
                      <p>
                        Sign in to see the server-confirmed status of your
                        checkout.
                      </p>
                      <button
                        className="primary full"
                        onClick={() => {
                          setAfterAuth("checkout");
                          open("auth");
                        }}
                      >
                        Sign in <ArrowRight size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="panel-intro">
                        {checkout?.state === "delivered"
                          ? "Your payment was applied and the placement delivered. It remains featured until another eligible brand takes the lead."
                          : checkout?.state === "refund_pending"
                            ? "This payment could not deliver its promised placement. A full refund is queued. Follow its confirmed status here."
                            : checkout?.state === "refunded"
                              ? "The confirmed refund has been reconciled with your ranking."
                              : checkout?.state === "failed"
                                ? `No placement was granted. ${checkout.failure_code === "DO_NOT_HONOR" ? "The issuer declined this attempt. Contact your bank or use a different payment method." : "The payment provider reported a failed attempt."} Your reservation remains protected until ${checkout.cutoff_at ? new Date(checkout.cutoff_at).toLocaleTimeString() : "its cutoff"}. Check your dashboard before starting another payment.`
                                : "The server checks payment status. Returning to this page alone does not grant a billboard."}
                      </p>
                      {checkout?.mode === "simulation" && (
                        <div className="notice">
                          <ShieldCheck size={19} />
                          <span>
                            <strong>Payment simulation</strong>
                            <br />
                            No money is charged. This exercises the local
                            reservation, allocation and refund workflow.
                          </span>
                        </div>
                      )}
                      <div className="price-box">
                        <div>
                          <span>Your total ranking</span>
                          <strong>{money(checkout?.target || 0)}</strong>
                        </div>
                        <div className="due">
                          <span>
                            {checkout?.state === "delivered"
                              ? "Applied payment"
                              : "Pay now, before tax"}
                          </span>
                          <strong>{money(checkout?.due || 0)}</strong>
                        </div>
                      </div>
                      {checkout?.mode === "simulation" &&
                        ["checkout", "pending"].includes(checkout.state) && (
                          <button
                            className="primary full"
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                await api("checkout/simulate", {
                                  orderId: checkout.id,
                                });
                                setCheckout(
                                  await api<Checkout>("checkout/status", {
                                    orderId: checkout.id,
                                  }),
                                );
                                await refresh();
                                await refreshMe();
                              })
                            }
                          >
                            {busy ? (
                              <LoaderCircle className="spin" size={17} />
                            ) : (
                              <CheckCircle2 size={17} />
                            )}
                            Simulate successful payment
                          </button>
                        )}
                      {checkout?.state === "delivered" && (
                        <button
                          className="primary full"
                          onClick={() => {
                            const id = checkout.slot_id || slot.id;
                            select(id);
                            cmd("view", id);
                          }}
                        >
                          See your billboard <ArrowUpRight size={17} />
                        </button>
                      )}
                      <button
                        className="secondary full"
                        onClick={() => {
                          void refreshMe();
                          open("account");
                        }}
                      >
                        Open advertiser dashboard <ArrowRight size={17} />
                      </button>
                    </>
                  )}
                </>
              )}
              {panel === "settings" && (
                <>
                  <p className="panel-intro">
                    A comfortable pace. A clear view.
                  </p>
                  <label className="field">
                    Scene quality
                    <select
                      value={quality}
                      onChange={(e) => {
                        setQuality(e.target.value);
                        localStorage.setItem("paper-quality", e.target.value);
                      }}
                    >
                      <option value="low">Low · lighter on your device</option>
                      <option value="medium">Medium · balanced</option>
                      <option value="high">High · sharper details</option>
                    </select>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={reduced}
                      onChange={(e) => setReduced(e.target.checked)}
                    />
                    Reduce ambient motion
                  </label>
                  <button className="secondary full" onClick={toggleSound}>
                    {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    Ambient sound {sound ? "on" : "off"}
                  </button>
                  <div className="section-heading">
                    <h3>A little field guide</h3>
                  </div>
                  <div className="control-guide">
                    {[
                      ["W A S D", "Walk and strafe"],
                      ["↑ ↓", "Walk forward and back"],
                      ["← →", "Turn left and right"],
                      ["Drag", "Look around · click to inspect"],
                      ["ESC", "Exit Walk mode or close a panel"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <kbd>{key}</kbd>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="fine">
                    Wheel to gently zoom. Walk mode captures your pointer only
                    after you select it. Panels pause movement. On touch
                    screens: left joystick to move, drag the scene to look.
                  </p>
                  <button
                    className="secondary full"
                    onClick={() => {
                      if (fallback) {
                        setReady(false);
                        setFallback(false);
                        setPanel(null);
                        cmd("reset");
                      } else {
                        setFallback(true);
                        setPanel("directory");
                      }
                    }}
                  >
                    {fallback ? "Try 3D again" : "Use directory without 3D"} <ArrowRight size={16} />
                  </button>
                </>
              )}
              {panel === "report" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      await api("report", { slotId: slot.id, reason: report });
                      setReport("");
                      setPanel("detail");
                      notify("Report recorded for operator review.");
                    });
                  }}
                >
                  <p>Tell the operator what needs attention on {slot.name}.</p>
                  <label className="field">
                    Reason
                    <textarea
                      required
                      minLength={10}
                      maxLength={500}
                      rows={5}
                      value={report}
                      onChange={(e) => setReport(e.target.value)}
                    />
                  </label>
                  <button className="primary full" disabled={busy}>
                    Submit report <Flag size={16} />
                  </button>
                </form>
              )}
            </div>
            <div className="drawer-footer">
              <span>
                <ShieldCheck size={13} />
                An independent virtual square.
              </span>
              <button onClick={() => open("rules")}>
                Rules & privacy <ArrowUpRight size={12} />
              </button>
            </div>
          </aside>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error && !panel && (
        <div className="toast error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
