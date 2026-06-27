"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Hotspot } from "@/types/tour";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface PanoramaViewerRef {
  getPosition: () => { yaw: number; pitch: number } | null;
  animateTo: (yaw: number, pitch: number) => Promise<void>;
}

interface PanoramaViewerProps {
  imageUrl: string;
  hotspots?: Hotspot[];
  selectedHotspotId?: string | null;
  initialYaw?: number;
  initialPitch?: number;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onSphereClick?: (pitch: number, yaw: number) => void;
  onHotspotMove?: (id: string, pitch: number, yaw: number) => void;
  isEditorMode?: boolean;
  isPlacingHotspot?: boolean;
}

export const PanoramaViewer = forwardRef<PanoramaViewerRef, PanoramaViewerProps>(
  function PanoramaViewer(
    {
      imageUrl,
      hotspots = [],
      selectedHotspotId = null,
      initialYaw = 0,
      initialPitch = 0,
      onHotspotClick,
      onSphereClick,
      onHotspotMove,
      isEditorMode = false,
      isPlacingHotspot = false,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewerRef        = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markersPluginRef = useRef<any>(null);

    const ignoreNextSelectRef  = useRef(false);
    const transitioningRef     = useRef(false);
    const isFirstImageRender   = useRef(true);

    // Prop refs — always hold the latest value so async PSV callbacks stay fresh
    const imageUrlRef          = useRef(imageUrl);
    const hotspotsRef          = useRef(hotspots);
    const selectedHotspotIdRef = useRef(selectedHotspotId);
    const initialYawRef        = useRef(initialYaw);
    const initialPitchRef      = useRef(initialPitch);
    const onHotspotClickRef    = useRef(onHotspotClick);
    const onSphereClickRef     = useRef(onSphereClick);
    const onHotspotMoveRef     = useRef(onHotspotMove);
    const isPlacingHotspotRef  = useRef(isPlacingHotspot);

    useEffect(() => { imageUrlRef.current         = imageUrl;         }, [imageUrl]);
    useEffect(() => { hotspotsRef.current         = hotspots;         }, [hotspots]);
    useEffect(() => { selectedHotspotIdRef.current= selectedHotspotId;}, [selectedHotspotId]);
    useEffect(() => { initialYawRef.current       = initialYaw;       }, [initialYaw]);
    useEffect(() => { initialPitchRef.current     = initialPitch;     }, [initialPitch]);
    useEffect(() => { onHotspotClickRef.current   = onHotspotClick;   }, [onHotspotClick]);
    useEffect(() => { onSphereClickRef.current    = onSphereClick;    }, [onSphereClick]);
    useEffect(() => { onHotspotMoveRef.current    = onHotspotMove;    }, [onHotspotMove]);
    useEffect(() => { isPlacingHotspotRef.current = isPlacingHotspot; }, [isPlacingHotspot]);

    const buildMarkers = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hs: Hotspot[], selId: string | null): any[] =>
        hs.map((h) => ({
          id: h.id,
          position: { yaw: `${h.yaw}deg`, pitch: `${h.pitch}deg` },
          html: buildHotspotHtml(h, h.id === selId),
          size: { width: 44, height: 44 },
          anchor: "center center",
          data: h,
          tooltip: h.label ? { content: h.label, position: "top center" } : undefined,
        })),
      []
    );

    const rebuildMarkers = useCallback(() => {
      const plugin = markersPluginRef.current;
      if (!plugin) return;
      try {
        plugin.clearMarkers();
        buildMarkers(hotspotsRef.current, selectedHotspotIdRef.current)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .forEach((m: any) => plugin.addMarker(m));
      } catch { /* plugin not ready */ }
    }, [buildMarkers]);

    // Expose methods to parent (editor viewport save + public viewer pan-to-hotspot)
    useImperativeHandle(ref, () => ({
      getPosition: () => {
        const v = viewerRef.current;
        if (!v) return null;
        const pos = v.getPosition();
        return { yaw: pos.yaw * RAD_TO_DEG, pitch: pos.pitch * RAD_TO_DEG };
      },
      animateTo: (yaw, pitch) => {
        const v = viewerRef.current;
        if (!v) return Promise.resolve();
        return (v.animate({
          yaw:   yaw   * DEG_TO_RAD,
          pitch: pitch * DEG_TO_RAD,
          zoom:  60,
          speed: "8rpm",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any).then?.(() => {}) ?? Promise.resolve();
      },
    }));

    // ── Create viewer ONCE on mount ────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;
      isFirstImageRender.current = true; // reset for StrictMode safety

      let destroyed = false;
      let removeDragListeners: (() => void) | null = null;

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
          container:       containerRef.current,
          panorama:        imageUrlRef.current,
          defaultYaw:      `${initialYawRef.current}deg`,
          defaultPitch:    `${initialPitchRef.current}deg`,
          defaultZoomLvl:  50,
          navbar:          false,
          touchmoveTwoFingers: false,
          mousewheelCtrlKey:   false,
          loadingTxt:      "",
          plugins: [
            [MarkersPlugin, {
              markers: buildMarkers(hotspotsRef.current, selectedHotspotIdRef.current),
            }],
          ],
        });

        viewerRef.current = viewer;
        const markersPlugin = viewer.getPlugin(MarkersPlugin);
        markersPluginRef.current = markersPlugin;

        markersPlugin.addEventListener(
          "select-marker",
          ({ marker }: { marker: { data: Hotspot } }) => {
            if (ignoreNextSelectRef.current) {
              ignoreNextSelectRef.current = false;
              return;
            }
            if (!isEditorMode || !isPlacingHotspotRef.current) {
              onHotspotClickRef.current?.(marker.data);
            }
          }
        );

        viewer.addEventListener(
          "click",
          ({ data }: { data: { pitch: number; yaw: number } }) => {
            if (isEditorMode) {
              onSphereClickRef.current?.(data.pitch, data.yaw);
            }
          }
        );

        // ── Drag-to-reposition markers (editor only) ──────────────────────
        if (isEditorMode) {
          const container = viewer.container;

          type DragState = {
            id: string; active: boolean;
            startX: number; startY: number;
            lastPos: { pitch: number; yaw: number } | null;
          };
          let drag: DragState | null = null;

          const onCaptureMove = (ev: MouseEvent) => {
            if (!drag) return;
            const dx = ev.clientX - drag.startX;
            const dy = ev.clientY - drag.startY;
            if (!drag.active && Math.hypot(dx, dy) < 6) return;
            drag.active = true;
            ev.stopPropagation();
            const rect = container.getBoundingClientRect();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pos = (viewer as any).dataHelper.viewerCoordsToSphericalCoords({
              x: ev.clientX - rect.left,
              y: ev.clientY - rect.top,
            });
            drag.lastPos = pos;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (markersPlugin as any).updateMarker({
                id: drag.id,
                position: { yaw: pos.yaw, pitch: pos.pitch },
              });
            } catch { /* not ready */ }
          };

          const onMouseDown = (ev: MouseEvent) => {
            if (ev.button !== 0) return;
            const el = (ev.target as HTMLElement).closest(
              '[id^="psv-marker-"]'
            ) as HTMLElement | null;
            if (!el) return;
            drag = {
              id: el.id.slice("psv-marker-".length),
              active: false,
              startX: ev.clientX,
              startY: ev.clientY,
              lastPos: null,
            };
          };

          const onMouseUp = () => {
            if (!drag) return;
            if (drag.active && drag.lastPos) {
              ignoreNextSelectRef.current = true;
              onHotspotMoveRef.current?.(
                drag.id,
                drag.lastPos.pitch * RAD_TO_DEG,
                drag.lastPos.yaw  * RAD_TO_DEG,
              );
            }
            drag = null;
          };

          container.addEventListener("mousedown", onMouseDown);
          container.addEventListener("mousemove", onCaptureMove, { capture: true });
          document.addEventListener("mouseup", onMouseUp);

          removeDragListeners = () => {
            container.removeEventListener("mousedown", onMouseDown);
            container.removeEventListener("mousemove", onCaptureMove, { capture: true });
            document.removeEventListener("mouseup", onMouseUp);
          };
        }
      })();

      return () => {
        destroyed = true;
        removeDragListeners?.();
        viewerRef.current?.destroy();
        viewerRef.current       = null;
        markersPluginRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Kuula-style scene transition: crossfade dissolve between panoramas ──
    useEffect(() => {
      if (isFirstImageRender.current) {
        isFirstImageRender.current = false;
        return;
      }
      const v = viewerRef.current;
      if (!v) return;

      transitioningRef.current = true;

      // PSV crossfade: old panorama dissolves into new one simultaneously,
      // new scene starts at the saved viewport position immediately.
      (v.setPanorama(imageUrl, {
        transition:  250,
        showLoader:  false,
        position: {
          yaw:   initialYawRef.current   * DEG_TO_RAD,
          pitch: initialPitchRef.current * DEG_TO_RAD,
        },
        zoom: 50,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as Promise<void>)
        .then(() => {
          if (!viewerRef.current) return;
          transitioningRef.current = false;
          rebuildMarkers();
        })
        .catch(() => {
          transitioningRef.current = false;
        });
    }, [imageUrl, rebuildMarkers]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Rebuild markers when hotspots / selection changes (not during transition) ──
    useEffect(() => {
      if (transitioningRef.current) return;
      rebuildMarkers();
    }, [hotspots, selectedHotspotId, rebuildMarkers]);

    return (
      <>
        <style>{`.psv-loader { display: none !important; }`}</style>
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ cursor: isPlacingHotspot ? "crosshair" : undefined }}
        />
      </>
    );
  }
);

function buildHotspotHtml(h: Hotspot, selected: boolean): string {
  const color  = h.iconColor ?? "#ffffff";
  const selRing = selected
    ? `<circle cx="22" cy="22" r="20" stroke="#22d3ee" stroke-width="2.5" fill="none" stroke-dasharray="4 2"/>`
    : "";
  return `
    <div style="width:44px;height:44px;cursor:grab;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${selRing}
        <circle cx="22" cy="22" r="17" stroke="${color}" stroke-width="2" fill="rgba(0,0,0,0.35)"/>
        <circle cx="22" cy="22" r="9"  stroke="${color}" stroke-width="2" fill="rgba(0,0,0,0.2)"/>
        <circle cx="22" cy="22" r="3"  fill="${color}"/>
      </svg>
    </div>`;
}
