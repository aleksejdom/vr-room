"use client";

import { useState } from "react";
import Image from "next/image";
import { useEditorStore } from "@/store/editorStore";
import {
  createScene,
  deleteScene,
  updateSceneOrder,
  updateSceneName,
  alignSceneHorizon,
} from "@/lib/actions/tours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
  GripVertical,
  Pencil,
  Wand2,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SceneList() {
  const { tour, setActiveScene, activeSceneId, reorderScenes, setSceneName, setSceneAlignment } =
    useEditorStore();
  const [newSceneName, setNewSceneName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aligningId, setAligningId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  if (!tour) return null;

  const startRename = (sceneId: string, currentName: string) => {
    setRenameId(sceneId);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    const sceneId = renameId;
    const name = renameValue.trim();
    setRenameId(null);
    if (!sceneId || !name) return;
    const scene = tour.scenes.find((s) => s.id === sceneId);
    if (!scene || scene.name === name) return;

    // Optimistisch umbenennen, dann sofort persistieren
    setSceneName(sceneId, name);
    const result = await updateSceneName(sceneId, name);
    if (result?.error) {
      setSceneName(sceneId, scene.name);
      toast.error(result.error);
    } else {
      toast.success("Szene umbenannt");
    }
  };

  const handleDrop = async () => {
    const from = dragId;
    const to = overId;
    setDragId(null);
    setOverId(null);
    if (!from || !to || from === to) return;

    const ids = tour.scenes.map((s) => s.id);
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, from);

    // Optimistisch umsortieren, dann sofort persistieren
    reorderScenes(ids);
    const result = await updateSceneOrder(tour.id, ids);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Reihenfolge gespeichert");
    }
  };

  const handleAlignHorizon = async (sceneId: string, sceneName: string) => {
    if (aligningId) return;
    setAligningId(sceneId);
    try {
      const result = await alignSceneHorizon(sceneId);
      if (result?.error || !result?.success) {
        toast.error(result?.error ?? "Ausrichtung fehlgeschlagen.");
        return;
      }
      setSceneAlignment(sceneId, result.pitch, result.tilt, result.roll);
      toast.success(
        `„${sceneName}" am Horizont ausgerichtet (Neigung ${result.tilt.toFixed(1)}°, Rollung ${result.roll.toFixed(1)}°)`
      );
    } catch {
      toast.error("Ausrichtung fehlgeschlagen — Verbindung prüfen.");
    } finally {
      setAligningId(null);
    }
  };

  const handleAddScene = async () => {
    const name = newSceneName.trim() || `Szene ${tour.scenes.length + 1}`;
    const result = await createScene(tour.id, name);
    if (result?.scene) {
      tour.scenes.push({
        ...result.scene,
        panoramaImage: null,
        hotspots: [],
        initialYaw: result.scene.initialYaw ?? 0,
        initialPitch: result.scene.initialPitch ?? 0,
        initialZoom: result.scene.initialZoom ?? 50,
        horizonTilt: result.scene.horizonTilt ?? 0,
        horizonRoll: result.scene.horizonRoll ?? 0,
        ambientAudio: result.scene.ambientAudio ?? null,
      });
      setActiveScene(result.scene.id);
    }
    setNewSceneName("");
    setIsAdding(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteScene(tour.id, deleteId);
    const remaining = tour.scenes.filter((s) => s.id !== deleteId);
    if (activeSceneId === deleteId && remaining.length > 0) {
      setActiveScene(remaining[0].id);
    }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Szenen
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tour.scenes.map((scene) => (
          <div
            key={scene.id}
            role="button"
            tabIndex={0}
            draggable={renameId !== scene.id}
            onDragStart={(e) => {
              setDragId(scene.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overId !== scene.id) setOverId(scene.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop();
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => setActiveScene(scene.id)}
            onKeyDown={(e) => e.key === "Enter" && setActiveScene(scene.id)}
            className={cn(
              "group w-full text-left rounded-lg overflow-hidden border transition-all cursor-pointer",
              activeSceneId === scene.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-transparent hover:border-border hover:bg-muted/50",
              dragId === scene.id && "opacity-40",
              overId === scene.id && dragId !== null && dragId !== scene.id &&
                "border-primary border-dashed bg-primary/10"
            )}
          >
            <div className="flex items-center gap-1.5 p-2">
              <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing" />
              <div className="relative flex-shrink-0 w-14 h-10 rounded bg-muted overflow-hidden">
                {scene.panoramaImage ? (
                  <Image
                    src={scene.panoramaImage.thumbnailUrl ?? scene.panoramaImage.url}
                    alt={scene.name}
                    width={56}
                    height={40}
                    quality={60}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {tour.startSceneId === scene.id && (
                  <div className="absolute top-0 left-0 p-0.5">
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {renameId === scene.id ? (
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenameId(null);
                    }}
                    onBlur={commitRename}
                    className="h-6 text-xs px-1.5"
                    autoFocus
                  />
                ) : (
                  <p
                    className="text-xs font-medium truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(scene.id, scene.name);
                    }}
                    title="Doppelklick zum Umbenennen"
                  >
                    {scene.name}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {scene.hotspots.length} Hotspot{scene.hotspots.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div
                className={cn(
                  "flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                  aligningId === scene.id && "opacity-100"
                )}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(scene.id, scene.name);
                  }}
                  className="p-1 hover:text-primary"
                  title="Szene umbenennen"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {scene.panoramaImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAlignHorizon(scene.id, scene.name);
                    }}
                    disabled={aligningId !== null}
                    className="p-1 hover:text-primary disabled:opacity-50"
                    title="Automatisch am Horizont ausrichten"
                  >
                    {aligningId === scene.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(scene.id);
                  }}
                  className="p-1 hover:text-destructive"
                  title="Szene löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t">
        {isAdding ? (
          <div className="flex gap-1">
            <Input
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              placeholder="Szenenname"
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddScene();
                if (e.key === "Escape") setIsAdding(false);
              }}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddScene}>
              Szene hinzufügen
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Szene hinzufügen
          </Button>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Szene löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion ist nicht rückgängig zu machen. Alle Hotspots dieser Szene werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
