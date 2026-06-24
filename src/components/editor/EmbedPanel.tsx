"use client";

import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { getEmbedCode } from "@/lib/utils";

export function EmbedPanel() {
  const { tour } = useEditorStore();
  if (!tour) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${appUrl}/tour/${tour.slug}`;
  const embedCode = getEmbedCode(tour.slug);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  if (tour.status !== "published") {
    return (
      <div className="p-4 text-center">
        <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs font-medium">Tour nicht veröffentlicht</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Veröffentliche die Tour um den Share-Link und Embed-Code zu erhalten.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Share-Link</Label>
        <div className="flex gap-1">
          <Input value={shareUrl} readOnly className="h-7 text-[11px] bg-muted" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => copy(shareUrl, "Link")}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs">iFrame Embed-Code</Label>
        <textarea
          readOnly
          value={embedCode}
          className="w-full text-[10px] font-mono p-2 rounded-md border bg-muted resize-none h-20 text-muted-foreground"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => copy(embedCode, "Embed-Code")}
        >
          <Copy className="h-3 w-3 mr-1" />
          Embed-Code kopieren
        </Button>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Embed-URL direkt</Label>
        <p className="text-[11px] font-mono text-muted-foreground break-all">
          {appUrl}/embed/{tour.slug}
        </p>
      </div>
    </div>
  );
}
