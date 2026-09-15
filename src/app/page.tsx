import PaperSquare from "@/components/paper-square";
import { SLOTS, HERO } from "@/lib/registry";
import { DEMO_BILLBOARDS } from '@/lib/demo-billboards';
import { publicSnapshot } from "@/server/content";
import { origin } from "@/server/config";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ billboard?: string }>;
}) {
  const { billboard } = await searchParams;
  const base = origin();
  const slot = SLOTS.find((s) => s.id === billboard);
  if (!slot)
    return {
      metadataBase: new URL(base),
      alternates: { canonical: base },
      title: `${process.env.NEXT_PUBLIC_APP_NAME || "Paper Square"} — A little Times Square for the internet`,
    };
  let name = "Your brand could be here";
  try {
    name =
      (await publicSnapshot()).slots.find((s) => s.id === billboard)?.creative
        ?.name || name;
  } catch {}
  return {
    metadataBase: new URL(base),
    alternates: { canonical: `${base}/?billboard=${slot.id}` },
    title: `${name} · ${slot.name} · Paper Square`,
    description: `Explore ${slot.location} in Paper Square. Advertising on this website's virtual billboard only.`,
    openGraph: {
      images: [
        {
          url: `${base}/api/og/${slot.id}`,
          width: 1200,
          height: 630,
          alt: `${slot.name} · illustrated placement card, not a live 3D render`,
        },
      ],
      title: `${name} · ${slot.name}`,
    },
  };
}
export const dynamic = 'force-dynamic';

export default async function Page() {
  // Ship public inventory with the page instead of waiting for hydration and
  // another round trip before requesting any billboard media.
  const snapshot = await publicSnapshot().catch(() => null);
  const media = snapshot?.slots.flatMap(state => {
    const creative = state.creative || (state.available && !state.brandId ? DEMO_BILLBOARDS[state.id] : undefined);
    const slot = SLOTS.find(slot => slot.id === state.id)!;
    const source = creative?.mode === 'video' ? creative.poster : creative?.image;
    return source ? [{ source, distance: Math.hypot(slot.look[0] - HERO.position[0], slot.look[2] - HERO.position[2]) }] : [];
  }).sort((a, b) => a.distance - b.distance).slice(0, 8) || [];
  return <>
    {[...new Set(media.map(m => m.source))].map(source => <link key={source} rel="preload" as="image" crossOrigin="anonymous"
      href={source.startsWith('/api/assets/') ? `${source}?size=512` : source} />)}
    <PaperSquare initialSnapshot={snapshot} />
  </>;
}
