import PaperSquare from "@/components/paper-square";
import { SLOTS, HERO } from "@/lib/registry";
import { DEMO_BILLBOARDS } from '@/lib/demo-billboards';
import { publicSnapshot } from "@/server/content";
import { origin } from "@/server/config";
import type { Metadata } from 'next';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ billboard?: string }>;
}): Promise<Metadata> {
  const { billboard } = await searchParams;
  const base = origin();
  const slot = SLOTS.find((s) => s.id === billboard);
  const brand = process.env.NEXT_PUBLIC_APP_NAME || 'Paper Square';
  if (!slot) {
    const title = `${brand} — Virtual Times Square billboards from $10`;
    const description = 'Seven days to bid on a virtual Times Square billboard. From $10. When the countdown ends, the highest bidder on each billboard stays forever.';
    const image = { url: `${base}/social/city-preview.png`, width: 1200, height: 630,
      alt: 'The illustrated Paper Square city, with colorful virtual billboards lining Times Square.' };
    return {
      metadataBase: new URL(base), alternates: { canonical: base }, title, description,
      openGraph: { type: 'website', siteName: brand, url: base, title, description, images: [image] },
      twitter: { card: 'summary_large_image', title, description, images: [image] },
    };
  }
  let name = "Your brand could be here";
  try {
    name =
      (await publicSnapshot()).slots.find((s) => s.id === billboard)?.creative
        ?.name || name;
  } catch {}
  const title = `${name} · ${slot.name} · ${brand}`;
  const description = `Put your brand on ${slot.name}, a virtual Times Square billboard. Preview the placement and see its current price. Advertising on this website only.`;
  const image = { url: `${base}/api/og/${slot.id}`, width: 1200, height: 630,
    alt: `${slot.name} · illustrated placement card` };
  return {
    metadataBase: new URL(base),
    alternates: { canonical: `${base}/?billboard=${slot.id}` },
    title,
    description,
    openGraph: {
      type: 'website', siteName: brand, url: `${base}/?billboard=${slot.id}`,
      title, description, images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
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
