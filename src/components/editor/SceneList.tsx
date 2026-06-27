"use client";

import { useState } from "react";
import { useEditorStore, useActiveScene } from "@/store/editorStore";
import { createScene, deleteScene } from "@/lib/actions/tours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
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
  const { tour, setActiveScene, activeSceneId } = useEditorStore();
  const [newSceneName, setNewSceneName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!tour) return null;

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
        {tour.scenes.map((scene, idx) => (
          <div
            key={scene.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveScene(scene.id)}
            onKeyDown={(e) => e.key === "Enter" && setActiveScene(scene.id)}
            className={cn(
              "group w-full text-left rounded-lg overflow-hidden border transition-all cursor-pointer",
              activeSceneId === scene.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-transparent hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2 p-2">
              <div className="relative flex-shrink-0 w-14 h-10 rounded bg-muted overflow-hidden">
                {scene.panoramaImage ? (
                  <img
                    src={scene.panoramaImage.thumbnailUrl ?? scene.panoramaImage.url}
                    alt={scene.name}
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
                <p className="text-xs font-medium truncate">{scene.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {scene.hotspots.length} Hotspot{scene.hotspots.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(scene.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
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
              OK
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
