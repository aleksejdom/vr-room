"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PanoramaViewer } from "@/components/viewer/PanoramaViewer";
import { HotspotModal } from "@/components/viewer/HotspotModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Hotspot } from "@/types/tour";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { nanoid } from "nanoid";

interface PublicScene {
  id: string;
  name: string;
  order: number;
  initialYaw: number;
  initialPitch: number;
  panoramaImage: { url: string; thumbnailUrl: string | null } | null;
  hotspots: Hotspot[];
}

interface PublicTour {
  id: string;
  name: string;
  slug: string;
  startSceneId: string | null;
  scenes: PublicScene[];
}

interface PublicTourViewerProps {
  tour: PublicTour;
  showBranding?: boolean;
  isEmbed?: boolean;
}

export function PublicTourViewer({ tour, showBranding = true, isEmbed = false }: PublicTourViewerProps) {
  const sessionId = useRef(nanoid());
  const [activeSceneId, setActiveSceneId] = useState(
    tour.startSceneId ?? tour.scenes[0]?.id ?? null
  );
  const [clickedHotspot, setClickedHotspot] = useState<Hotspot | null>(null);
  const [showSceneList, setShowSceneList] = useState(false);

  const activeScene = tour.scenes.find((s) => s.id === activeSceneId) ?? tour.scenes[0];
  const activeIndex = tour.scenes.findIndex((s) => s.id === activeSceneId);

  useEffect(() => {
    trackEvent("tour_view", undefined, undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSceneId) {
      trackEvent("scene_view", activeSceneId, undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneId]);

  const trackEvent = async (
    eventType: string,
    sceneId?: string,
    hotspotId?: string
  ) => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tourId: tour.id,
        sceneId,
        hotspotId,
        eventType,
        sessionId: sessionId.current,
      }),
    }).catch(() => {});
  };

  const handleHotspotClick = (hotspot: Hotspot) => {
    trackEvent("hotspot_click", activeSceneId ?? undefined, hotspot.id);
    if (hotspot.type === "scene_link") {
      navigateTo(hotspot.content.targetSceneId);
    } else {
      setClickedHotspot(hotspot);
    }
  };

  const navigateTo = useCallback(
    (sceneId: string) => {
      setActiveSceneId(sceneId);
      setShowSceneList(false);
    },
    []
  );

  const goNext = () => {
    const next = tour.scenes[activeIndex + 1];
    if (next) navigateTo(next.id);
  };

  const goPrev = () => {
    const prev = tour.scenes[activeIndex - 1];
    if (prev) navigateTo(prev.id);
  };

  if (!activeScene?.panoramaImage) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white/50">
        Keine Bilder vorhanden
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <PanoramaViewer
        imageUrl={activeScene.panoramaImage.url}
        hotspots={activeScene.hotspots}
        initialYaw={activeScene.initialYaw}
        initialPitch={activeScene.initialPitch}
        onHotspotClick={handleHotspotClick}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/60 to-transparent flex items-center px-4 gap-3">
        {showBranding && (
          <span className="text-white font-semibold text-sm">
            VR<span className="text-blue-400">Rooms</span>
          </span>
        )}
        <span className="text-white/70 text-xs">{activeScene.name}</span>
      </div>

      {/* Scene navigation bar (bottom) */}
      {tour.scenes.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-white hover:bg-white/20 disabled:opacity-30"
            onClick={goPrev}
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex gap-1.5 overflow-x-auto max-w-xs sm:max-w-sm scrollbar-hide">
            {tour.scenes.map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => navigateTo(scene.id)}
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-md overflow-hidden border-2 transition-all",
                  scene.id === activeSceneId
                    ? "border-white scale-110"
                    : "border-white/30 hover:border-white/60 opacity-70 hover:opacity-100"
                )}
              >
                {scene.panoramaImage ? (
                  <img
                    src={scene.panoramaImage.thumbnailUrl ?? scene.panoramaImage.url}
                    alt={scene.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <span className="text-white/50 text-[8px]">{i + 1}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-white hover:bg-white/20 disabled:opacity-30"
            onClick={goNext}
            disabled={activeIndex === tour.scenes.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-white hover:bg-white/20 ml-1"
            onClick={() => setShowSceneList((v) => !v)}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Scene list overlay */}
      {showSceneList && (
        <div
          className="absolute inset-0 bg-black/80 flex items-center justify-center z-20"
          onClick={() => setShowSceneList(false)}
        >
          <div
            className="bg-background rounded-xl p-4 max-w-xs w-full mx-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm mb-3">{tour.name}</h3>
            {tour.scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => navigateTo(scene.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                  scene.id === activeSceneId ? "bg-primary/10" : "hover:bg-muted"
                )}
              >
                <div className="w-12 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                  {scene.panoramaImage && (
                    <img
                      src={scene.panoramaImage.thumbnailUrl ?? scene.panoramaImage.url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  )}
                </div>
                <span className="text-sm font-medium truncate">{scene.name}</span>
                {scene.id === activeSceneId && (
                  <span className="ml-auto text-[10px] text-primary">Aktiv</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <HotspotModal
        hotspot={clickedHotspot}
        onClose={() => setClickedHotspot(null)}
        onNavigate={navigateTo}
      />
    </div>
  );
}
