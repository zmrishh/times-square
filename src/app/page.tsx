import PaperSquare from "@/components/paper-square";
import { SLOTS } from "@/lib/registry";
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
export default function Page() {
  return <PaperSquare />;
}
