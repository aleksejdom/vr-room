import { db } from "@/lib/db";
import { tours } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { headers } from "next/headers";
import { PublicTourViewer } from "@/components/viewer/PublicTourViewer";
import type { Hotspot } from "@/types/tour";

// Immer frisch rendern — siehe tour/[slug]/page.tsx
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getTourBySlug(slug: string) {
  return db.query.tours.findFirst({
    where: eq(tours.slug, slug),
    with: {
      scenes: {
        with: {
          panoramaImage: true,
          hotspots: { orderBy: (h, { asc }) => [asc(h.order)] },
        },
        orderBy: (s, { asc }) => [asc(s.order)],
      },
      embedSettings: true,
    },
  });
}

export default async function EmbedPage({ params }: Props) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug);

  if (!tour || tour.status !== "published") notFound();

  // Domain restriction check
  if (tour.allowedDomains && tour.allowedDomains.length > 0) {
    const headersList = await headers();
    const referer = headersList.get("referer") ?? "";
    const isAllowed = tour.allowedDomains.some((d) => referer.includes(d));
    if (!isAllowed && referer !== "") {
      return (
        <div className="h-screen flex items-center justify-center bg-black text-white/50 text-sm">
          Einbettung für diese Domain nicht erlaubt.
        </div>
      );
    }
  }

  const serialized = {
    id: tour.id,
    name: tour.name,
    slug: tour.slug,
    startSceneId: tour.startSceneId,
    scenes: tour.scenes.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      initialYaw: s.initialYaw ?? 0,
      initialPitch: s.initialPitch ?? 0,
      panoramaImage: s.panoramaImage
        ? {
            url: `/api/media/${s.panoramaImage.storageKey}`,
            thumbnailUrl: `/api/media/${s.panoramaImage.storageKey}`,
          }
        : null,
      hotspots: s.hotspots.map((h) => ({
        id: h.id,
        sceneId: h.sceneId,
        type: h.type,
        pitch: h.pitch,
        yaw: h.yaw,
        label: h.label,
        iconType: h.iconType ?? "arrow",
        iconColor: h.iconColor ?? "#ffffff",
        order: h.order ?? 0,
        content: h.content,
      }) as Hotspot),
    })),
  };

  // Startpanorama schon mit dem HTML anstoßen, statt erst nach Hydration.
  // PSV lädt per fetch() → as:"fetch" + crossOrigin, damit der Preload matcht.
  const startScene =
    serialized.scenes.find((s) => s.id === serialized.startSceneId) ?? serialized.scenes[0];
  if (startScene?.panoramaImage) {
    preload(startScene.panoramaImage.url, { as: "fetch", crossOrigin: "anonymous" });
  }

  return (
    <html>
      <body style={{ margin: 0, padding: 0, overflow: "hidden", background: "black" }}>
        <div style={{ width: "100vw", height: "100vh" }}>
          <PublicTourViewer tour={serialized} showBranding={false} isEmbed />
        </div>
      </body>
    </html>
  );
}
