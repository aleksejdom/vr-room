import { db } from "@/lib/db";
import { tours } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import type { Metadata } from "next";
import { PublicTourViewer } from "@/components/viewer/PublicTourViewer";
import type { Hotspot } from "@/types/tour";

// Immer frisch rendern: DB-Queries sind für den Router unsichtbar, sonst
// würde die Seite in Produktion gecacht und gespeicherte Startansichten,
// Hotspots etc. erst nach einem Redeploy sichtbar.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tour = await db.query.tours.findFirst({
    where: eq(tours.slug, slug),
    columns: { name: true, status: true },
  });
  if (!tour || tour.status !== "published") return { title: "Tour nicht gefunden" };
  return { title: `${tour.name} – VR-Rooms by Domowets` };
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

export default async function PublicTourPage({ params }: Props) {
  const { slug } = await params;
  const tour = await getTourBySlug(slug);

  if (!tour || tour.status !== "published") notFound();

  const serialized = serializeTour(tour);

  // Startpanorama schon mit dem HTML anstoßen, statt erst nach Hydration.
  // PSV lädt per fetch() → as:"fetch" + crossOrigin, damit der Preload matcht.
  const startScene =
    serialized.scenes.find((s) => s.id === serialized.startSceneId) ?? serialized.scenes[0];
  if (startScene?.panoramaImage) {
    preload(startScene.panoramaImage.url, { as: "fetch", crossOrigin: "anonymous" });
  }

  return (
    <div className="h-screen w-full bg-black">
      <PublicTourViewer tour={serialized} showBranding />
    </div>
  );
}

type TourWithScenes = NonNullable<Awaited<ReturnType<typeof getTourBySlug>>>;

function serializeTour(tour: TourWithScenes) {
  return {
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
      initialZoom: s.initialZoom ?? 50,
      horizonTilt: s.horizonTilt ?? 0,
      horizonRoll: s.horizonRoll ?? 0,
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
}
