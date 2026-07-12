"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { alignSceneHorizon, updateSceneLevel } from "@/lib/actions/tours";
import { toast } from "sonner";
import { Wand2, X, Loader2, RotateCcw, Save } from "lucide-react";
import type { Scene } from "@/types/tour";

const D2R = Math.PI / 180;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

interface LevelCorrectionPanelProps {
  scene: Scene;
  /** Aktuelle Kamera-Blickrichtung (Yaw in Grad) aus dem Viewer */
  getYawDeg: () => number | null;
  onClose: () => void;
}

/**
 * Manuelle Horizont-Korrektur im Kuula-Stil: ein Regler, der das Panorama
 * relativ zur aktuellen Blickrichtung kippt. Man dreht die Ansicht zur
 * schiefen Stelle und zieht, bis die Szene zum Wasserwaagen-Gitter passt.
 *
 * Mathematik: Die Korrektur (tilt, roll) ist ein Vektor in der X/Z-Achsen-
 * Ebene. Der Regler bearbeitet die Komponente entlang der Kipp-Achse der
 * aktuellen Blickrichtung u∥ = (cosθ, sinθ); die dazu senkrechte Komponente
 * bleibt erhalten. So lassen sich Korrekturen aus verschiedenen Richtungen
 * nacheinander kombinieren.
 */
export function LevelCorrectionPanel({ scene, getYawDeg, onClose }: LevelCorrectionPanelProps) {
  const { setSceneLevel, setSceneAlignment } = useEditorStore();
  const [busy, setBusy] = useState<"auto" | "save" | null>(null);

  // Kipp-Basis: Blickrichtung beim Anfassen des Reglers + erhaltene
  // Querkomponente. Wird beim Öffnen initialisiert (die Komponente wird pro
  // Szene per key neu gemountet) und bei jedem Regler-Grab neu erfasst.
  const computeBasis = (tilt: number, roll: number) => {
    const theta = (getYawDeg() ?? 0) * D2R;
    return {
      theta,
      perp: -tilt * Math.sin(theta) + roll * Math.cos(theta),
      parallel: -(tilt * Math.cos(theta) + roll * Math.sin(theta)),
    };
  };
  const basisRef = useRef<{ theta: number; perp: number } | null>(null);
  if (basisRef.current === null) {
    const b = computeBasis(scene.horizonTilt, scene.horizonRoll);
    basisRef.current = { theta: b.theta, perp: b.perp };
  }
  const [value, setValue] = useState(() =>
    round1(computeBasis(scene.horizonTilt, scene.horizonRoll).parallel)
  );

  const captureBasis = (tilt: number, roll: number) => {
    const b = computeBasis(tilt, roll);
    basisRef.current = { theta: b.theta, perp: b.perp };
    setValue(round1(b.parallel));
  };

  const applyValue = (v: number) => {
    setValue(v);
    const { theta, perp } = basisRef.current!;
    const tilt = -v * Math.cos(theta) - perp * Math.sin(theta);
    const roll = -v * Math.sin(theta) + perp * Math.cos(theta);
    setSceneLevel(scene.id, round2(tilt), round2(roll));
  };

  const handleAuto = async () => {
    setBusy("auto");
    try {
      const result = await alignSceneHorizon(scene.id);
      if (result?.error || !result?.success) {
        toast.error(result?.error ?? "Automatische Ausrichtung fehlgeschlagen.");
        return;
      }
      setSceneAlignment(scene.id, result.pitch, result.tilt, result.roll);
      captureBasis(result.tilt, result.roll);
      toast.success(
        `Automatisch ausgerichtet (Neigung ${result.tilt.toFixed(1)}°, Rollung ${result.roll.toFixed(1)}°)`
      );
    } catch {
      toast.error("Automatische Ausrichtung fehlgeschlagen — Verbindung prüfen.");
    } finally {
      setBusy(null);
    }
  };

  const handleReset = () => {
    setSceneLevel(scene.id, 0, 0);
    basisRef.current = { theta: (getYawDeg() ?? 0) * D2R, perp: 0 };
    setValue(0);
  };

  const handleSave = async () => {
    setBusy("save");
    try {
      const result = await updateSceneLevel(scene.id, scene.horizonTilt, scene.horizonRoll);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Horizont-Korrektur für „${scene.name}" gespeichert`);
    } catch {
      toast.error("Speichern fehlgeschlagen — Verbindung prüfen.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="absolute top-12 right-3 z-10 w-72 rounded-lg bg-black/70 backdrop-blur-md text-white p-3 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider">Horizont-Korrektur</h4>
        <button onClick={onClose} className="p-1 text-white/60 hover:text-white" title="Schließen">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[11px] leading-snug text-white/60">
        Drehe die Ansicht zur schiefen Stelle und ziehe den Regler, bis die Szene
        zum Gitter passt. Die türkise Linie ist der Ziel-Horizont.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-white/80">
          <span>Level</span>
          <span className="tabular-nums">{value.toFixed(1)}°</span>
        </div>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.2}
          value={value}
          // Beim Anfassen die aktuelle Blickrichtung als Kipp-Achse übernehmen
          onPointerDown={() => captureBasis(scene.horizonTilt, scene.horizonRoll)}
          onChange={(e) => applyValue(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 cursor-ew-resize"
        />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>-45°</span>
          <span>0°</span>
          <span>+45°</span>
        </div>
      </div>

      <div className="text-[10px] text-white/40 tabular-nums">
        Neigung {scene.horizonTilt.toFixed(1)}° · Rollung {scene.horizonRoll.toFixed(1)}°
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={handleAuto}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 px-2 py-1.5 text-[11px] transition-colors"
          title="Horizont automatisch erkennen"
        >
          {busy === "auto" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          Auto
        </button>
        <button
          onClick={handleReset}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 px-2 py-1.5 text-[11px] transition-colors"
          title="Korrektur zurücksetzen"
        >
          <RotateCcw className="h-3 w-3" />
          Zurücksetzen
        </button>
        <button
          onClick={handleSave}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1 rounded bg-cyan-500/80 hover:bg-cyan-500 disabled:opacity-50 px-2 py-1.5 text-[11px] font-medium transition-colors"
          title="Korrektur speichern"
        >
          {busy === "save" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Speichern
        </button>
      </div>
    </div>
  );
}
