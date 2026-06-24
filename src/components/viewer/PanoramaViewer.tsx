"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Hotspot } from "@/types/tour";

interface PanoramaViewerProps {
  imageUrl: string;
  hotspots?: Hotspot[];
  initialYaw?: number;
  initialPitch?: number;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onSphereClick?: (pitch: number, yaw: number) => void;
  isEditorMode?: boolean;
  isPlacingHotspot?: boolean;
}

export function PanoramaViewer({
  imageUrl,
  hotspots = [],
  initialYaw = 0,
  initialPitch = 0,
  onHotspotClick,
  onSphereClick,
  isEditorMode = false,
  isPlacingHotspot = false,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersPluginRef = useRef<any>(null);

  const buildMarkers = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (hs: Hotspot[]): any[] =>
      hs.map((h) => ({
        id: h.id,
        position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
        html: buildHotspotHtml(h),
        anchor: "center center",
        data: h,
        tooltip: h.label
          ? { content: h.label, position: "top center" }
          : undefined,
      })),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const [{ Viewer }, { MarkersPlugin }] = await Promise.all([
        import("@photo-sphere-viewer/core"),
        import("@photo-sphere-viewer/markers-plugin"),
      ]);
      await Promise.all([
        import("@photo-sphere-viewer/core/index.css"),
        import("@photo-sphere-viewer/markers-plugin/index.css"),
      ]);

      if (destroyed || !containerRef.current) return;

      const viewer = new Viewer({
        container: containerRef.current,
        panorama: imageUrl,
        defaultYaw: initialYaw,
        defaultPitch: initialPitch,
        navbar: false,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        plugins: [
          [
            MarkersPlugin,
            { markers: buildMarkers(hotspots) },
          ],
        ],
      });

      const markersPlugin = viewer.getPlugin(MarkersPlugin);
      markersPluginRef.current = markersPlugin;

      markersPlugin.addEventListener("select-marker", ({ marker }: { marker: { data: Hotspot } }) => {
        if (!isEditorMode || !isPlacingHotspot) {
          onHotspotClick?.(marker.data);
        }
      });

      viewer.addEventListener("click", ({ data }: { data: { pitch: number; yaw: number } }) => {
        if (isEditorMode) {
          onSphereClick?.(data.pitch, data.yaw);
        }
      });

      viewerRef.current = viewer;
    })();

    return () => {
      destroyed = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      markersPluginRef.current = null;
    };
    // Only re-init when imageUrl or mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, isEditorMode]);

  // Update markers when hotspots change without full re-init
  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin) return;
    try {
      plugin.clearMarkers();
      buildMarkers(hotspots).forEach((m: unknown) => plugin.addMarker(m));
    } catch {
      // Plugin not ready yet
    }
  }, [hotspots, buildMarkers]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        cursor: isPlacingHotspot ? "crosshair" : undefined,
      }}
    />
  );
}

function buildHotspotHtml(h: Hotspot): string {
  const icon = getHotspotIcon(h.type);
  const color = h.iconColor ?? "#ffffff";
  return `
    <div class="hotspot-pin" style="
      background: rgba(0,0,0,0.55);
      border: 2px solid ${color};
      border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: transform 0.15s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    " onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">
      <span style="color:${color};font-size:16px;">${icon}</span>
    </div>
  `;
}

function getHotspotIcon(type: string): string {
  const icons: Record<string, string> = {
    scene_link: "→",
    info_text: "ℹ",
    url_link: "↗",
    video: "▶",
    image: "🖼",
  };
  return icons[type] ?? "•";
}
