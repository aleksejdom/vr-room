"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useActiveScene } from "@/store/editorStore";
import { saveHotspots, publishTour, unpublishTour, setStartScene } from "@/lib/actions/tours";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe,
  EyeOff,
  ChevronDown,
  Save,
  Loader2,
  ArrowLeft,
  Star,
  Copy,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export function EditorToolbar() {
  const { tour, isDirty, isSaving, setIsSaving, markSaved } = useEditorStore();
  const activeScene = useActiveScene();
  const [isPublishing, setIsPublishing] = useState(false);

  if (!tour) return null;

  const handleSave = async () => {
    if (!activeScene) return;
    setIsSaving(true);
    try {
      await saveHotspots(activeScene.id, activeScene.hotspots);
      markSaved();
      toast.success("Gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (tour.status === "published") {
        await unpublishTour(tour.id);
        toast.success("Tour zurückgezogen");
      } else {
        await publishTour(tour.id);
        toast.success("Tour veröffentlicht!");
      }
    } catch {
      toast.error("Fehler");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSetStartScene = async () => {
    if (!activeScene) return;
    await setStartScene(tour.id, activeScene.id);
    toast.success("Startszene gesetzt");
  };

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tour/${tour.slug}`;

  return (
    <header className="h-12 border-b bg-background flex items-center px-3 gap-3 z-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Dashboard
      </Link>

      <div className="h-4 w-px bg-border" />

      <h1 className="text-sm font-medium truncate max-w-48">{tour.name}</h1>

      <Badge
        variant={tour.status === "published" ? "default" : "secondary"}
        className="text-[10px] h-5"
      >
        {tour.status === "published" ? "Veröffentlicht" : "Entwurf"}
      </Badge>

      <div className="flex-1" />

      {isDirty && (
        <span className="text-[11px] text-muted-foreground">Ungespeicherte Änderungen</span>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={handleSave}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Speichern
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPublishing}
          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isPublishing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Globe className="h-3 w-3" />
          )}
          {tour.status === "published" ? "Veröffentlicht" : "Veröffentlichen"}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-sm">
          <DropdownMenuItem onClick={handlePublish}>
            {tour.status === "published" ? (
              <>
                <EyeOff className="h-3.5 w-3.5 mr-2" />
                Zurückziehen
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5 mr-2" />
                Jetzt veröffentlichen
              </>
            )}
          </DropdownMenuItem>

          {tour.status === "published" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link kopiert!");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-2" />
                Link kopieren
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Tour öffnen
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSetStartScene} disabled={!activeScene}>
            <Star className="h-3.5 w-3.5 mr-2" />
            Diese Szene als Start setzen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
