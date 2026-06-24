"use client";

import { useEffect, useState } from "react";
import { useEditorStore, useActiveScene } from "@/store/editorStore";
import { PanoramaViewer } from "@/components/viewer/PanoramaViewer";
import { SceneList } from "@/components/editor/SceneList";
import { HotspotPanel } from "@/components/editor/HotspotPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { EmbedPanel } from "@/components/editor/EmbedPanel";
import { confirmPanoramaUpload } from "@/lib/actions/tours";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotspotModal } from "@/components/viewer/HotspotModal";
import type { Tour, Hotspot } from "@/types/tour";
import { toast } from "sonner";
import { Image, Crosshair, Code } from "lucide-react";

export function TourEditor({ initialTour }: { initialTour: Tour }) {
  const { setTour, setActiveScene, isPlacingHotspot, confirmHotspotPosition,
    setScenePanorama } = useEditorStore();
  const activeScene = useActiveScene();
  const [clickedHotspot, setClickedHotspot] = useState<Hotspot | null>(null);
  const [rightTab, setRightTab] = useState("hotspots");

  useEffect(() => {
    setTour(initialTour);
  }, [initialTour, setTour]);

  const handleSphereClick = (pitch: number, yaw: number) => {
    if (isPlacingHotspot) {
      confirmHotspotPosition(pitch, yaw);
    }
  };

  const handleNavigate = (sceneId: string) => {
    setActiveScene(sceneId);
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

    setScenePanorama(activeScene.id, { ...result, storageKey: result.key });
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
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                  <Crosshair className="h-3 w-3" />
                  Klicke auf die gewünschte Position
                </div>
              )}
              <PanoramaViewer
                imageUrl={activeScene.panoramaImage.url}
                hotspots={activeScene.hotspots}
                initialYaw={activeScene.initialYaw}
                initialPitch={activeScene.initialPitch}
                onHotspotClick={setClickedHotspot}
                onSphereClick={handleSphereClick}
                isEditorMode
                isPlacingHotspot={isPlacingHotspot}
              />
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
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col h-full">
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
              <HotspotPanel />
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

      <HotspotModal
        hotspot={clickedHotspot}
        onClose={() => setClickedHotspot(null)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
