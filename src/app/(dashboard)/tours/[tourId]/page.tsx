import { getTour } from "@/lib/actions/tours";
import { notFound } from "next/navigation";
import { TourEditor } from "@/components/editor/TourEditor";

export default async function TourEditorPage({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await params;
  const tour = await getTour(tourId);
  if (!tour) notFound();

  const serialized = {
    id: tour.id,
    projectId: tour.projectId,
    name: tour.name,
    slug: tour.slug,
    status: tour.status as "draft" | "published" | "archived",
    startSceneId: tour.startSceneId,
    password: tour.password,
    publishedAt: tour.publishedAt?.toISOString() ?? null,
    createdAt: tour.createdAt.toISOString(),
    updatedAt: tour.updatedAt.toISOString(),
    embedSettings: tour.embedSettings
      ? {
          id: tour.embedSettings.id,
          tourId: tour.embedSettings.tourId,
          defaultWidth: tour.embedSettings.defaultWidth ?? "100%",
          defaultHeight: tour.embedSettings.defaultHeight ?? "600px",
          showControls: tour.embedSettings.showControls ?? true,
          showTitle: tour.embedSettings.showTitle ?? true,
          showFullscreen: tour.embedSettings.showFullscreen ?? true,
          autoRotate: tour.embedSettings.autoRotate ?? false,
          autoRotateSpeed: tour.embedSettings.autoRotateSpeed ?? 1,
          gyroEnabled: tour.embedSettings.gyroEnabled ?? true,
        }
      : null,
    scenes: tour.scenes.map((s) => ({
      id: s.id,
      tourId: s.tourId,
      name: s.name,
      order: s.order,
      initialYaw: s.initialYaw ?? 0,
      initialPitch: s.initialPitch ?? 0,
      initialZoom: s.initialZoom ?? 50,
      horizonTilt: s.horizonTilt ?? 0,
      horizonRoll: s.horizonRoll ?? 0,
      ambientAudio: s.ambientAudio ?? null,
      panoramaImage: s.panoramaImage
        ? {
            id: s.panoramaImage.id,
            sceneId: s.panoramaImage.sceneId,
            storageKey: s.panoramaImage.storageKey,
            url: `/api/media/${s.panoramaImage.storageKey}`,
            thumbnailUrl: `/api/media/${s.panoramaImage.storageKey}`,
            width: s.panoramaImage.width,
            height: s.panoramaImage.height,
            fileSize: s.panoramaImage.fileSize,
          }
        : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hotspots: (s.hotspots as any[]).map((h) => ({
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

  return <TourEditor initialTour={serialized} />;
}
