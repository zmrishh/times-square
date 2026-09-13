"use client";
import { ReactNode, useEffect, useRef } from "react";
import { Creative } from "@/lib/registry";
import { renderCreative } from "@/lib/creative-renderer";
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: "no-store", signal: AbortSignal.timeout(30000) }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Please try again.");
  return d;
}
export type Brand = {
  id: string;
  name: string;
  creative_id: string;
  data: Creative;
  status: string;
  reason: string | null;
  suspended: boolean;
};
export type MyOrder = {
  id: string;
  slot_id: string;
  target: number;
  due: number;
  state: string;
  mode: string;
  created_at: string;
  expires_at: string;
  checkout_url: string;
  payment_id?: string;
  principal?: number;
  tax?: number;
  cash?: number;
  refunded_cash?: number;
  refund_state?: string;
};
export type Me = {
  account: { id: string; email: string; role: string } | null;
  brands: Brand[];
  orders: MyOrder[];
  totals: { slot_id: string; brand_id: string; amount: number }[];
  placements: {
    slot_id: string;
    total: number;
    kind: string;
    started_at: string;
    ended_at: string | null;
    data: Creative;
  }[];
  analytics: { slot_id: string; kind: string; count: number }[];
};
export const emptyMe: Me = {
  account: null,
  brands: [],
  orders: [],
  totals: [],
  placements: [],
  analytics: [],
};
export function Art({
  creative,
  art,
  ratio = 1.5,
  safe = false,
  thumbnail = false,
}: {
  creative?: Creative | null;
  art: number;
  ratio?: number;
  safe?: boolean;
  thumbnail?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const c = document.createElement("canvas");
    const draw = () =>
      void renderCreative(
        c,
        creative || null,
        art,
        Math.round((thumbnail ? 384 : 1000) * Math.min(1, ratio)),
        Math.round((thumbnail ? 384 : 1000) * Math.min(1, 1 / ratio)),
      ).then(() => {
        if (!live || !ref.current) return;
        ref.current.width = c.width;
        ref.current.height = c.height;
        ref.current.getContext("2d")!.drawImage(c, 0, 0);
      });
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          draw();
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [creative, art, ratio, thumbnail]);
  return (
    <div className="art" style={{ aspectRatio: ratio }}>
      <canvas
        ref={ref}
        aria-label={
          creative
            ? `${creative.name} billboard preview`
            : "Original house artwork · placement available"
        }
      />
      {safe && (
        <div className="safe-area">
          <span>Safe area</span>
        </div>
      )}
    </div>
  );
}
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
