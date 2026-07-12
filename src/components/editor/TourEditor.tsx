"use client";

import { useEffect, useRef } from "react";
import { useEditorStore, useActiveScene } from "@/store/editorStore";
import { PanoramaViewer, type PanoramaViewerRef } from "@/components/viewer/PanoramaViewer";
import { SceneList } from "@/components/editor/SceneList";
import { HotspotPanel } from "@/components/editor/HotspotPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { EmbedPanel } from "@/components/editor/EmbedPanel";
import { confirmPanoramaUpload, updateSceneViewport } from "@/lib/actions/tours";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tour, HotspotType } from "@/types/tour";
import { toast } from "sonner";
import { Image, Crosshair, Code, Bookmark } from "lucide-react";
const RAD_TO_DEG = 180 / Math.PI;

const DEFAULT_ICON_BY_TYPE: Record<HotspotType, string> = {
  scene_link: "arrow",
  info_text: "info",
  url_link: "link",
  video: "play",
  image: "camera",
  room_label: "arrow", // ungenutzt — Räumlichkeiten rendern Text statt Icon
};

function getDefaultContent(type: HotspotType, scenes: { id: string }[], currentSceneId: string) {
  switch (type) {
    case "scene_link": {
      const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
      const nextScene =
        scenes[currentIndex + 1] ?? scenes.find((s) => s.id !== currentSceneId);
      return { targetSceneId: nextScene?.id ?? "", transitionType: "fade" };
    }
    case "info_text":  return { title: "Neue Info", description: "" };
    case "url_link":   return { url: "https://", openInNewTab: true };
    case "video":      return { videoUrl: "", autoplay: false };
    case "image":      return { images: [] };
    case "room_label": return { text: "Neuer Raum" };
  }
}

export function TourEditor({ initialTour }: { initialTour: Tour }) {
  const {
    tour,
    setTour,
    setActiveScene,
    isPlacingHotspot,
    cancelPlacingHotspot,
    newHotspotType,
    addHotspot,
    updateHotspot,
    setScenePanorama,
    selectedHotspotId,
    setSceneViewport,
  } = useEditorStore();
  const activeScene = useActiveScene();
  const viewerRef = useRef<PanoramaViewerRef>(null);

  useEffect(() => {
    setTour(initialTour);
  }, [initialTour, setTour]);

  // Instant hotspot creation on panorama click (Kuula-style)
  const handleSphereClick = (pitchRad: number, yawRad: number) => {
    if (!isPlacingHotspot || !activeScene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = getDefaultContent(newHotspotType, tour?.scenes ?? [], activeScene.id) as any;
    addHotspot(activeScene.id, {
      id: crypto.randomUUID(),
      sceneId: activeScene.id,
      type: newHotspotType,
      pitch: pitchRad * RAD_TO_DEG,
      yaw: yawRad * RAD_TO_DEG,
      label: "",
      iconType: DEFAULT_ICON_BY_TYPE[newHotspotType] ?? "arrow",
      iconColor: "#ffffff",
      order: activeScene.hotspots.length,
      content,
    });
  };

  const handleSaveView = async () => {
    if (!activeScene) return;
    const pos = viewerRef.current?.getPosition();
    if (!pos) {
      toast.error("Viewer lädt noch — bitte kurz warten");
      return;
    }
    try {
      const result = await updateSceneViewport(activeScene.id, pos.yaw, pos.pitch);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Update store so switching scenes in this session uses the new viewport
      setSceneViewport(activeScene.id, pos.yaw, pos.pitch);
      toast.success(`Startansicht für "${activeScene.name}" gespeichert`);
    } catch {
      toast.error("Speichern fehlgeschlagen — Verbindung prüfen");
    }
  };

  const handleHotspotMove = (id: string, pitch: number, yaw: number) => {
    if (!activeScene) return;
    updateHotspot(activeScene.id, id, { pitch, yaw });
  };

  const handleUploadComplete = async (result: {
    url: string;
    key: string;
    width: number;
    height: number;
    fileSize: number;
    thumbnailUrl: string;
  }) => {
    if (!activeScene) return;

    const res = await confirmPanoramaUpload(
      activeScene.id,
      result.key,
      result.url,
      result.thumbnailUrl,
      result.width,
      result.height,
      result.fileSize
    );

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    setScenePanorama(activeScene.id, {
      ...result,
      url: `/api/media/${result.key}`,
      thumbnailUrl: `/api/media/${result.key}`,
      storageKey: result.key,
    });
    toast.success("360°-Bild hochgeladen");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorToolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Scene List */}
        <aside className="w-52 border-r flex flex-col overflow-hidden bg-background">
          <SceneList />
        </aside>

        {/* Center: Viewer */}
        <main className="flex-1 relative bg-black overflow-hidden">
          {activeScene?.panoramaImage ? (
            <>
              {isPlacingHotspot && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
                  <Crosshair className="h-3 w-3" />
                  Klicke auf die Szene um den Hotspot zu platzieren
                </div>
              )}
              <PanoramaViewer
                ref={viewerRef}
                imageUrl={activeScene.panoramaImage.url}
                hotspots={activeScene.hotspots}
                selectedHotspotId={selectedHotspotId}
                initialYaw={activeScene.initialYaw}
                initialPitch={activeScene.initialPitch}
                onHotspotClick={(h) => useEditorStore.getState().selectHotspot(h.id)}
                onSphereClick={handleSphereClick}
                onHotspotMove={handleHotspotMove}
                isEditorMode
                isPlacingHotspot={isPlacingHotspot}
              />
              <button
                onClick={handleSaveView}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors backdrop-blur-sm"
                title={`Aktuelle Kameraposition als Startansicht für "${activeScene.name}" speichern`}
              >
                <Bookmark className="h-3 w-3" />
                Ansicht speichern · <span className="opacity-70 max-w-[80px] truncate">{activeScene.name}</span>
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="max-w-md w-full space-y-4">
                <div className="text-center">
                  <div className="p-3 rounded-full bg-white/5 w-fit mx-auto mb-3">
                    <Image className="h-8 w-8 text-white/40" />
                  </div>
                  <h3 className="text-white/80 font-medium">
                    {activeScene
                      ? `360°-Bild für "${activeScene.name}" hochladen`
                      : "Szene auswählen oder erstellen"}
                  </h3>
                  <p className="text-white/40 text-sm mt-1">
                    Equirectangulares Panorama (2:1) empfohlen
                  </p>
                </div>
                {activeScene && (
                  <ImageUploader
                    sceneId={activeScene.id}
                    onUploadComplete={handleUploadComplete}
                    className="border-white/20 hover:border-white/40 bg-white/5"
                  />
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right: Panels */}
        <aside className="w-64 border-l flex flex-col overflow-hidden bg-background">
          <Tabs defaultValue="hotspots" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 mx-2 mt-2 h-7">
              <TabsTrigger value="hotspots" className="text-[11px] h-6">
                <Crosshair className="h-3 w-3 mr-1" />
                Hotspots
              </TabsTrigger>
              <TabsTrigger value="upload" className="text-[11px] h-6">
                <Image className="h-3 w-3 mr-1" />
                Bild
              </TabsTrigger>
              <TabsTrigger value="embed" className="text-[11px] h-6">
                <Code className="h-3 w-3 mr-1" />
                Embed
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hotspots" className="flex-1 overflow-hidden mt-0">
              <HotspotPanel onCancelPlacing={cancelPlacingHotspot} />
            </TabsContent>
            <TabsContent value="upload" className="p-3 mt-0">
              {activeScene ? (
                <ImageUploader
                  sceneId={activeScene.id}
                  onUploadComplete={handleUploadComplete}
                />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Zuerst eine Szene auswählen
                </p>
              )}
            </TabsContent>
            <TabsContent value="embed" className="mt-0 flex-1 overflow-auto">
              <EmbedPanel />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
