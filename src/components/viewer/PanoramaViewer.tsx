"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Hotspot } from "@/types/tour";
import { getHotspotIcon } from "@/lib/hotspot-icons";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface PanoramaViewerRef {
  getPosition: () => { yaw: number; pitch: number; zoom: number } | null;
  animateTo: (yaw: number, pitch: number) => Promise<void>;
}

interface PanoramaViewerProps {
  imageUrl: string;
  hotspots?: Hotspot[];
  selectedHotspotId?: string | null;
  initialYaw?: number;
  initialPitch?: number;
  initialZoom?: number;
  /** Begradigung aus der Horizont-Ausrichtung (Grad, sphereCorrection) */
  horizonTilt?: number;
  horizonRoll?: number;
  /** Wasserwaagen-Gitter einblenden (Level-Korrektur-Panel im Editor) */
  showLevelGrid?: boolean;
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
      initialZoom = 50,
      horizonTilt = 0,
      horizonRoll = 0,
      showLevelGrid = false,
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
    // Wendet die Horizont-Korrektur auf den Viewer an (Grad) — wird bei der
    // Viewer-Erstellung gesetzt, sobald THREE geladen ist
    const applyCorrectionRef = useRef<(tiltDeg: number, rollDeg: number) => void>(() => {});

    const ignoreNextSelectRef  = useRef(false);
    const transitioningRef     = useRef(false);
    const isFirstImageRender   = useRef(true);

    // Prop refs — always hold the latest value so async PSV callbacks stay fresh
    const imageUrlRef          = useRef(imageUrl);
    const hotspotsRef          = useRef(hotspots);
    const selectedHotspotIdRef = useRef(selectedHotspotId);
    const initialYawRef        = useRef(initialYaw);
    const initialPitchRef      = useRef(initialPitch);
    const initialZoomRef       = useRef(initialZoom);
    const horizonTiltRef       = useRef(horizonTilt);
    const horizonRollRef       = useRef(horizonRoll);
    const onHotspotClickRef    = useRef(onHotspotClick);
    const onSphereClickRef     = useRef(onSphereClick);
    const onHotspotMoveRef     = useRef(onHotspotMove);
    const isPlacingHotspotRef  = useRef(isPlacingHotspot);

    useEffect(() => { imageUrlRef.current         = imageUrl;         }, [imageUrl]);
    useEffect(() => { hotspotsRef.current         = hotspots;         }, [hotspots]);
    useEffect(() => { selectedHotspotIdRef.current= selectedHotspotId;}, [selectedHotspotId]);
    useEffect(() => { initialYawRef.current       = initialYaw;       }, [initialYaw]);
    useEffect(() => { initialPitchRef.current     = initialPitch;     }, [initialPitch]);
    useEffect(() => { initialZoomRef.current      = initialZoom;      }, [initialZoom]);
    useEffect(() => { horizonTiltRef.current      = horizonTilt;      }, [horizonTilt]);
    useEffect(() => { horizonRollRef.current      = horizonRoll;      }, [horizonRoll]);
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
          // Raum-Schilder passen sich dem Text an, Icon-Marker sind fix 44px
          size: h.type === "room_label" ? undefined : { width: 44, height: 44 },
          anchor: "center center",
          data: h,
          tooltip:
            h.label && h.type !== "room_label"
              ? { content: h.label, position: "top center" }
              : undefined,
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
        return {
          yaw:   pos.yaw   * RAD_TO_DEG,
          pitch: pos.pitch * RAD_TO_DEG,
          zoom:  v.getZoomLevel(),
        };
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
        const [{ Viewer }, { MarkersPlugin }, THREE] = await Promise.all([
          import("@photo-sphere-viewer/core"),
          import("@photo-sphere-viewer/markers-plugin"),
          import("three"),
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
          defaultZoomLvl:  initialZoomRef.current,
          sphereCorrection: {
            tilt: horizonTiltRef.current * DEG_TO_RAD,
            roll: horizonRollRef.current * DEG_TO_RAD,
          },
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
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__psv = viewer;
        }

        // ── Horizont-Korrektur ────────────────────────────────────────────
        // PSVs Equirect-Adapter rendert über einen Raycasting-Shader, der die
        // Textur aus der Blickrichtung berechnet — die Mesh-Rotation von
        // sphereCorrection ist dort wirkungslos. Deshalb injizieren wir eine
        // Korrektur-Matrix direkt in den Fragment-Shader (Semantik identisch
        // zu sphereCorrection: Content erscheint um Rx(tilt)·Rz(roll) gedreht).
        // Fällt bei anderen Adaptern/Versionen auf sphereCorrection zurück.
        const patchMaterial = (): boolean => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const material = (viewer as any).renderer?.mesh?.material;
          if (!material?.fragmentShader?.includes("vec3 rayDir = vWorldPos - cameraPosition")) {
            return false;
          }
          if (!material.uniforms.correctionMatrix) {
            material.uniforms.correctionMatrix = { value: new THREE.Matrix3() };
            material.fragmentShader = material.fragmentShader
              .replace(
                "uniform float radius;",
                "uniform float radius;\nuniform mat3 correctionMatrix;"
              )
              .replace(
                "float u = atan(-dir.x, dir.z)",
                "dir = correctionMatrix * dir;\n    float u = atan(-dir.x, dir.z)"
              );
            material.needsUpdate = true;
          }
          return true;
        };
        applyCorrectionRef.current = (tiltDeg: number, rollDeg: number) => {
          if (!viewerRef.current) return;
          const t = tiltDeg * DEG_TO_RAD;
          const r = rollDeg * DEG_TO_RAD;
          try {
            if (patchMaterial()) {
              // Abtastrichtung mit R⁻¹ = Rz(−roll)·Rx(−tilt) drehen
              const m4 = new THREE.Matrix4()
                .makeRotationZ(-r)
                .multiply(new THREE.Matrix4().makeRotationX(-t));
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (viewer as any).renderer.mesh.material.uniforms.correctionMatrix.value.setFromMatrix4(m4);
              viewer.needsUpdate();
            } else {
              viewer.setOption("sphereCorrection", { tilt: t, roll: r });
            }
          } catch { /* viewer not ready */ }
        };
        viewer.addEventListener(
          "ready",
          () => applyCorrectionRef.current(horizonTiltRef.current, horizonRollRef.current),
          { once: true }
        );

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
        zoom: initialZoomRef.current,
        sphereCorrection: {
          tilt: horizonTiltRef.current * DEG_TO_RAD,
          roll: horizonRollRef.current * DEG_TO_RAD,
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as Promise<void>)
        .then(() => {
          if (!viewerRef.current) return;
          transitioningRef.current = false;
          // setPanorama erzeugt ein neues Mesh → Shader-Korrektur neu anwenden
          applyCorrectionRef.current(horizonTiltRef.current, horizonRollRef.current);
          rebuildMarkers();
        })
        .catch(() => {
          transitioningRef.current = false;
        });
    }, [imageUrl, rebuildMarkers]);

    // ── Horizont-Korrektur live anwenden ───────────────────────────────────
    // Greift bei Auto-Ausrichtung und beim Ziehen des Level-Reglers der
    // aktiven Szene. Bei Szenenwechseln ist transitioningRef gesetzt (Effekt
    // oben läuft zuerst) und setPanorama übernimmt die Korrektur selbst.
    useEffect(() => {
      if (!viewerRef.current || transitioningRef.current) return;
      applyCorrectionRef.current(horizonTilt, horizonRoll);
    }, [horizonTilt, horizonRoll]);

    // ── Wasserwaagen-Gitter (Level-Korrektur-Panel) ────────────────────────
    // Weltfestes Lat/Long-Gitter als Nivellier-Referenz: es bleibt gerade,
    // während das Panorama darunter per sphereCorrection gedreht wird.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const levelGridRef = useRef<any>(null);
    useEffect(() => {
      let cancelled = false;
      const v = viewerRef.current;
      if (showLevelGrid) {
        if (!v || levelGridRef.current) return;
        (async () => {
          const THREE = await import("three");
          const viewer = viewerRef.current;
          if (cancelled || !viewer || levelGridRef.current) return;

          const group = new THREE.Group();
          const mat = new THREE.LineBasicMaterial({
            color: 0x22d3ee, transparent: true, opacity: 0.3, depthTest: false,
          });
          const equatorMat = new THREE.LineBasicMaterial({
            color: 0x22d3ee, transparent: true, opacity: 0.9, depthTest: false,
          });
          const R = 8;
          const SEG = 72;

          // Breitengrade (Äquator hervorgehoben = Ziel-Horizont)
          for (let lat = -75; lat <= 75; lat += 15) {
            const phi = lat * DEG_TO_RAD;
            const pts = [];
            for (let i = 0; i <= SEG; i++) {
              const t = (i / SEG) * Math.PI * 2;
              pts.push(new THREE.Vector3(
                R * Math.cos(phi) * Math.cos(t),
                R * Math.sin(phi),
                R * Math.cos(phi) * Math.sin(t)
              ));
            }
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts),
              lat === 0 ? equatorMat : mat
            );
            line.renderOrder = 10;
            group.add(line);
          }
          // Längengrade (senkrechte Referenzlinien)
          for (let lon = 0; lon < 360; lon += 15) {
            const th = lon * DEG_TO_RAD;
            const pts = [];
            for (let i = 0; i <= SEG / 2; i++) {
              const p = -Math.PI / 2 + (i / (SEG / 2)) * Math.PI;
              pts.push(new THREE.Vector3(
                R * Math.cos(p) * Math.cos(th),
                R * Math.sin(p),
                R * Math.cos(p) * Math.sin(th)
              ));
            }
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
            line.renderOrder = 10;
            group.add(line);
          }

          levelGridRef.current = group;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (viewer as any).renderer.addObject(group);
          viewer.needsUpdate();
        })();
      } else if (levelGridRef.current && v) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v as any).renderer.removeObject(levelGridRef.current);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        levelGridRef.current.traverse((obj: any) => obj.geometry?.dispose?.());
        levelGridRef.current = null;
        v.needsUpdate();
      }
      return () => { cancelled = true; };
    }, [showLevelGrid]);

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHotspotHtml(h: Hotspot, selected: boolean): string {
  const color  = h.iconColor ?? "#ffffff";

  // Räumlichkeit: Text direkt als lesbares Schild rendern statt Icon
  if (h.type === "room_label") {
    const text = escapeHtml(h.content?.text || h.label || "Raum");
    const selStyle = selected ? "outline:2px dashed #22d3ee;outline-offset:3px;" : "";
    return `
      <div style="
        display:inline-block;cursor:grab;white-space:nowrap;
        padding:6px 14px;border-radius:9999px;
        background:rgba(10,12,20,0.55);
        border:1px solid rgba(255,255,255,0.25);
        backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        color:${color};font-size:14px;font-weight:600;letter-spacing:0.02em;
        text-shadow:0 1px 3px rgba(0,0,0,0.6);
        box-shadow:0 2px 10px rgba(0,0,0,0.35);
        ${selStyle}
      ">${text}</div>`;
  }
  const icon   = getHotspotIcon(h.iconType);
  const selRing = selected
    ? `<circle cx="22" cy="22" r="20" stroke="#22d3ee" stroke-width="2.5" fill="none" stroke-dasharray="4 2"/>`
    : "";
  // Glyph als verschachteltes 20x20-SVG mittig im 44px-Marker; currentColor
  // aus der Icon-Definition wird über das color-Attribut aufgelöst.
  return `
    <div style="width:44px;height:44px;cursor:grab;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" color="${color}">
        ${selRing}
        <circle cx="22" cy="22" r="17" stroke="${color}" stroke-width="2" fill="rgba(0,0,0,0.35)"/>
        <svg x="12" y="12" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${icon.svg}
        </svg>
      </svg>
    </div>`;
}
