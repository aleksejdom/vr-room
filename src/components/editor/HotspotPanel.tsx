"use client";

import { useState } from "react";
import { useEditorStore, useActiveScene, useSelectedHotspot } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Crosshair, Plus, Trash2, Info } from "lucide-react";
import type { Hotspot, HotspotType } from "@/types/tour";
import { nanoid } from "nanoid";

export function HotspotPanel() {
  const { tour, activeSceneId, isPlacingHotspot, pendingHotspotPosition,
    startPlacingHotspot, cancelPlacingHotspot, addHotspot, updateHotspot,
    deleteHotspot, selectHotspot } = useEditorStore();
  const activeScene = useActiveScene();
  const selectedHotspot = useSelectedHotspot();
  const [newHotspotType, setNewHotspotType] = useState<HotspotType>("scene_link");

  if (!activeScene) return null;

  const handleConfirmPlacement = () => {
    if (!pendingHotspotPosition || !activeSceneId) return;

    const defaultContent = getDefaultContent(newHotspotType, tour?.scenes ?? []);
    const hotspot: Hotspot = {
      id: nanoid(),
      sceneId: activeSceneId,
      type: newHotspotType,
      pitch: pendingHotspotPosition.pitch,
      yaw: pendingHotspotPosition.yaw,
      label: "",
      iconType: "arrow",
      iconColor: "#ffffff",
      order: activeScene.hotspots.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: defaultContent as any,
    };
    addHotspot(activeSceneId, hotspot);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Hotspots
        </h3>
      </div>

      <div className="p-3 border-b space-y-2">
        <Label className="text-xs">Typ</Label>
        <Select
          value={newHotspotType}
          onValueChange={(v) => setNewHotspotType(v as HotspotType)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scene_link">Szenen-Link</SelectItem>
            <SelectItem value="info_text">Info-Text</SelectItem>
            <SelectItem value="url_link">Externer Link</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Bild</SelectItem>
          </SelectContent>
        </Select>

        {isPlacingHotspot ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200">
              <Crosshair className="h-3 w-3 text-amber-600 animate-pulse flex-shrink-0" />
              <p className="text-[11px] text-amber-700">
                Klicke auf die Szene um den Hotspot zu setzen
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={cancelPlacingHotspot}
            >
              Abbrechen
            </Button>
          </div>
        ) : pendingHotspotPosition ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 border border-green-200">
              <Info className="h-3 w-3 text-green-600 flex-shrink-0" />
              <p className="text-[11px] text-green-700">
                Position gesetzt ({pendingHotspotPosition.pitch.toFixed(1)}°,{" "}
                {pendingHotspotPosition.yaw.toFixed(1)}°)
              </p>
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleConfirmPlacement}>
              <Plus className="h-3 w-3 mr-1" />
              Hotspot erstellen
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={startPlacingHotspot}
            disabled={!activeScene.panoramaImage}
          >
            <Crosshair className="h-3 w-3 mr-1" />
            Hotspot platzieren
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeScene.hotspots.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Noch keine Hotspots in dieser Szene
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {activeScene.hotspots.map((h) => (
              <button
                key={h.id}
                onClick={() => selectHotspot(h.id === useEditorStore.getState().selectedHotspotId ? null : h.id)}
                className={`w-full text-left p-2 rounded-md border text-xs transition-all ${
                  selectedHotspot?.id === h.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">
                    {h.label || getHotspotTypeLabel(h.type)}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    {getHotspotTypeLabel(h.type)}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {h.pitch.toFixed(1)}° · {h.yaw.toFixed(1)}°
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedHotspot && activeSceneId && (
        <>
          <Separator />
          <HotspotEditor
            hotspot={selectedHotspot}
            scenes={tour?.scenes ?? []}
            onUpdate={(updates) =>
              updateHotspot(activeSceneId, selectedHotspot.id, updates)
            }
            onDelete={() => deleteHotspot(activeSceneId, selectedHotspot.id)}
          />
        </>
      )}
    </div>
  );
}

function HotspotEditor({
  hotspot,
  scenes,
  onUpdate,
  onDelete,
}: {
  hotspot: Hotspot;
  scenes: { id: string; name: string }[];
  onUpdate: (updates: Partial<Hotspot>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Bearbeiten</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Löschen
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Label (optional)</Label>
        <Input
          value={hotspot.label ?? ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-7 text-xs"
          placeholder="Beschriftung..."
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Icon-Farbe</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={hotspot.iconColor}
            onChange={(e) => onUpdate({ iconColor: e.target.value })}
            className="h-7 w-12 rounded cursor-pointer border"
          />
          <span className="text-xs text-muted-foreground">{hotspot.iconColor}</span>
        </div>
      </div>

      {hotspot.type === "scene_link" && (
        <div className="space-y-1">
          <Label className="text-[11px]">Zielszene</Label>
          <Select
            value={hotspot.content.targetSceneId}
            onValueChange={(v) =>
              onUpdate({ content: { ...hotspot.content, targetSceneId: v } } as Partial<Hotspot>)
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Szene wählen..." />
            </SelectTrigger>
            <SelectContent>
              {scenes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hotspot.type === "info_text" && (
        <>
          <div className="space-y-1">
            <Label className="text-[11px]">Titel</Label>
            <Input
              value={hotspot.content.title}
              onChange={(e) =>
                onUpdate({ content: { ...hotspot.content, title: e.target.value } } as Partial<Hotspot>)
              }
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Beschreibung</Label>
            <Textarea
              value={hotspot.content.description ?? ""}
              onChange={(e) =>
                onUpdate({ content: { ...hotspot.content, description: e.target.value } } as Partial<Hotspot>)
              }
              className="text-xs min-h-[60px]"
            />
          </div>
        </>
      )}

      {hotspot.type === "url_link" && (
        <div className="space-y-1">
          <Label className="text-[11px]">URL</Label>
          <Input
            value={hotspot.content.url}
            onChange={(e) =>
              onUpdate({ content: { ...hotspot.content, url: e.target.value } } as Partial<Hotspot>)
            }
            className="h-7 text-xs"
            placeholder="https://..."
          />
        </div>
      )}

      {hotspot.type === "video" && (
        <div className="space-y-1">
          <Label className="text-[11px]">Video-URL (YouTube, Vimeo)</Label>
          <Input
            value={hotspot.content.videoUrl}
            onChange={(e) =>
              onUpdate({ content: { ...hotspot.content, videoUrl: e.target.value } } as Partial<Hotspot>)
            }
            className="h-7 text-xs"
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>
      )}
    </div>
  );
}

function getHotspotTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    scene_link: "Szene",
    info_text: "Info",
    url_link: "Link",
    video: "Video",
    image: "Bild",
  };
  return labels[type] ?? type;
}

function getDefaultContent(type: HotspotType, scenes: { id: string }[]) {
  switch (type) {
    case "scene_link":
      return { targetSceneId: scenes[0]?.id ?? "", transitionType: "fade" };
    case "info_text":
      return { title: "Neue Info", description: "" };
    case "url_link":
      return { url: "https://", openInNewTab: true };
    case "video":
      return { videoUrl: "", autoplay: false };
    case "image":
      return { images: [] };
  }
}
