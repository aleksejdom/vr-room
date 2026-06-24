import { db } from "@/lib/db";
import { tours } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicTourViewer } from "@/components/viewer/PublicTourViewer";

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
  return { title: `${tour.name} – VR Rooms` };
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

  return (
    <div className="h-screen w-full bg-black">
      <PublicTourViewer tour={serialized} showBranding />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeTour(tour: any) {
  return {
    id: tour.id,
    name: tour.name,
    slug: tour.slug,
    startSceneId: tour.startSceneId,
    scenes: tour.scenes.map((s: any) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      initialYaw: s.initialYaw ?? 0,
      initialPitch: s.initialPitch ?? 0,
      panoramaImage: s.panoramaImage
        ? { url: s.panoramaImage.url, thumbnailUrl: s.panoramaImage.thumbnailUrl }
        : null,
      hotspots: s.hotspots.map((h: any) => ({
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
      })),
    })),
  };
}
