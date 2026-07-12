"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { PanoramaViewer, type PanoramaViewerRef } from "@/components/viewer/PanoramaViewer";
import { HotspotModal } from "@/components/viewer/HotspotModal";
import { cn } from "@/lib/utils";
import type { Hotspot, SceneLinkHotspot } from "@/types/tour";
import { ChevronDown, ChevronUp } from "lucide-react";
import { nanoid } from "nanoid";

interface PublicScene {
  id: string;
  name: string;
  order: number;
  initialYaw: number;
  initialPitch: number;
  initialZoom: number;
  horizonTilt: number;
  horizonRoll: number;
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

export function PublicTourViewer({ tour, showBranding = true }: PublicTourViewerProps) {
  const sessionId     = useRef(nanoid());
  const viewerRef     = useRef<PanoramaViewerRef>(null);
  const navigatingRef = useRef(false);
  const stripRef      = useRef<HTMLDivElement>(null);

  const [activeSceneId, setActiveSceneId] = useState(
    tour.startSceneId ?? tour.scenes[0]?.id ?? null
  );
  const [clickedHotspot, setClickedHotspot] = useState<Hotspot | null>(null);
  const [stripVisible, setStripVisible]     = useState(true);

  const activeScene = tour.scenes.find((s) => s.id === activeSceneId) ?? tour.scenes[0];

  // Analytics
  const trackEvent = useCallback(
    async (eventType: string, sceneId?: string, hotspotId?: string) => {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourId: tour.id, sceneId, hotspotId, eventType, sessionId: sessionId.current }),
      }).catch(() => {});
    },
    [tour.id]
  );

  useEffect(() => { trackEvent("tour_view"); }, [trackEvent]);
  useEffect(() => {
    if (activeSceneId) trackEvent("scene_view", activeSceneId);
  }, [activeSceneId, trackEvent]);

  // Panoramen der übrigen Szenen im Hintergrund in den HTTP-Cache laden
  // (immutable gecacht), damit Szenenwechsel ohne Netzwerk-Wartezeit laufen.
  // Reihenfolge: von der aktiven Szene verlinkte Szenen zuerst, dann der Rest.
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = tour.scenes.find((s) => s.id === activeSceneId);
    if (current?.panoramaImage) preloadedRef.current.add(current.panoramaImage.url);

    const linkedScenes = (current?.hotspots ?? [])
      .filter((h): h is SceneLinkHotspot => h.type === "scene_link")
      .map((h) => tour.scenes.find((s) => s.id === h.content.targetSceneId));
    const urls = [...linkedScenes, ...tour.scenes]
      .map((s) => s?.panoramaImage?.url)
      .filter((u): u is string => !!u);
    const queue = [...new Set(urls)].filter((u) => !preloadedRef.current.has(u));
    if (queue.length === 0) return;

    let cancelled = false;
    // Kurz warten, damit das aktive Panorama zuerst Bandbreite bekommt
    const timer = setTimeout(async () => {
      for (const url of queue) {
        if (cancelled) return;
        if (preloadedRef.current.has(url)) continue;
        try {
          const res = await fetch(url, { priority: "low" } as RequestInit);
          await res.blob(); // Body vollständig lesen, sonst landet er nicht im Cache
          preloadedRef.current.add(url);
        } catch {
          // Offline o.ä. — Szene lädt dann beim Klick regulär
        }
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSceneId, tour.scenes]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!stripRef.current || !activeSceneId) return;
    const el = stripRef.current.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeSceneId]);

  const navigateTo = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId);
  }, []);

  const handleHotspotClick = async (hotspot: Hotspot) => {
    // Raum-Schilder sind reine Beschriftung, nicht interaktiv
    if (hotspot.type === "room_label") return;
    trackEvent("hotspot_click", activeSceneId ?? undefined, hotspot.id);
    if (hotspot.type === "scene_link") {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      await viewerRef.current?.animateTo(hotspot.yaw, hotspot.pitch);
      navigateTo(hotspot.content.targetSceneId);
      setTimeout(() => { navigatingRef.current = false; }, 600);
    } else {
      setClickedHotspot(hotspot);
    }
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
        ref={viewerRef}
        imageUrl={activeScene.panoramaImage.url}
        hotspots={activeScene.hotspots}
        initialYaw={activeScene.initialYaw}
        initialPitch={activeScene.initialPitch}
        initialZoom={activeScene.initialZoom}
        horizonTilt={activeScene.horizonTilt}
        horizonRoll={activeScene.horizonRoll}
        onHotspotClick={handleHotspotClick}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/60 to-transparent flex items-center px-4 gap-3 pointer-events-none">
        {showBranding && (
          <span className="text-white font-semibold text-sm">
            VR<span className="text-blue-400">-Rooms</span>
            <span className="ml-1.5 text-[10px] font-normal text-white/50">by Domowets</span>
          </span>
        )}
        <span className="text-white/70 text-xs">{activeScene.name}</span>
      </div>

      {/* Kuula-style scene strip */}
      {tour.scenes.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0">
          {/* Toggle tab */}
          <div className="flex justify-center">
            <button
              onClick={() => setStripVisible((v) => !v)}
              className="bg-black/50 backdrop-blur-md hover:bg-black/70 text-white/50 hover:text-white/90 transition-colors px-5 py-0.5 rounded-t-md flex items-center"
              aria-label={stripVisible ? "Szenenleiste ausblenden" : "Szenenleiste einblenden"}
            >
              {stripVisible
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronUp   className="h-3 w-3" />}
            </button>
          </div>

          {/* Thumbnail strip */}
          <div
            className={cn(
              "bg-black/50 backdrop-blur-xl transition-all duration-300 overflow-hidden",
              stripVisible ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div
              ref={stripRef}
              className="flex gap-px overflow-x-auto scrollbar-hide px-px py-px"
            >
              {tour.scenes.map((scene) => {
                const isActive = scene.id === activeSceneId;
                return (
                  <button
                    key={scene.id}
                    data-active={isActive}
                    onClick={() => navigateTo(scene.id)}
                    title={scene.name}
                    className={cn(
                      "relative flex-shrink-0 overflow-hidden transition-opacity duration-150",
                      isActive
                        ? "ring-2 ring-white ring-inset"
                        : "opacity-50 hover:opacity-80"
                    )}
                    style={{ width: 96, height: 60 }}
                  >
                    {scene.panoramaImage ? (
                      <Image
                        src={scene.panoramaImage.thumbnailUrl ?? scene.panoramaImage.url}
                        alt={scene.name}
                        width={96}
                        height={60}
                        quality={60}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <span className="text-white/30 text-[9px] px-1 text-center leading-tight">
                          {scene.name}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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
