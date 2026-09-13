import { ImageResponse } from "next/og";
import { publicSnapshot } from "@/server/content";
import { SLOTS, HOUSE } from "@/lib/registry";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slot = SLOTS.find((s) => s.id === id);
  if (!slot) return new Response("Not found", { status: 404 });
  const state = (await publicSnapshot()).slots.find((s) => s.id === id);
  const c = state?.creative,
    art = HOUSE[slot.art % HOUSE.length];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f5f1e5",
        display: "flex",
        padding: "45px",
        flexDirection: "column",
        fontFamily: "sans-serif",
        color: "#244356",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
        }}
      >
        <span>Paper Square / {slot.name}</span>
        <span>VIRTUAL BILLBOARD</span>
      </div>
      <div
        style={{
          display: "flex",
          background: c?.bg || art.bg,
          color: c?.fg || art.fg,
          marginTop: 32,
          flex: 1,
          padding: 36,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 24 }}>
          {c?.name || "Your brand could be here"}
        </div>
        <div style={{ fontSize: 62, fontWeight: 700, marginTop: 18 }}>
          {(c?.headline || art.name).replaceAll("\n", " ")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          marginTop: 25,
        }}
      >
        <span>{slot.location}</span>
        <span>Illustrated placement card · not a live 3D render</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=60" },
    },
  );
}
