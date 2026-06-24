"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Hotspot, InfoTextHotspot, UrlLinkHotspot, VideoHotspot, ImageHotspot } from "@/types/tour";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HotspotModalProps {
  hotspot: Hotspot | null;
  onClose: () => void;
  onNavigate?: (sceneId: string) => void;
}

export function HotspotModal({ hotspot, onClose, onNavigate }: HotspotModalProps) {
  if (!hotspot) return null;

  if (hotspot.type === "scene_link") {
    onNavigate?.(hotspot.content.targetSceneId);
    onClose();
    return null;
  }

  return (
    <Dialog open={!!hotspot} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        {hotspot.type === "info_text" && (
          <InfoTextContent hotspot={hotspot as InfoTextHotspot} />
        )}
        {hotspot.type === "url_link" && (
          <UrlLinkContent hotspot={hotspot as UrlLinkHotspot} onClose={onClose} />
        )}
        {hotspot.type === "video" && (
          <VideoContent hotspot={hotspot as VideoHotspot} />
        )}
        {hotspot.type === "image" && (
          <ImageContent hotspot={hotspot as ImageHotspot} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoTextContent({ hotspot }: { hotspot: InfoTextHotspot }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{hotspot.content.title}</DialogTitle>
      </DialogHeader>
      {hotspot.content.imageUrl && (
        <img
          src={hotspot.content.imageUrl}
          alt={hotspot.content.title}
          className="w-full rounded-lg object-cover max-h-48"
        />
      )}
      {hotspot.content.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {hotspot.content.description}
        </p>
      )}
    </>
  );
}

function UrlLinkContent({ hotspot, onClose }: { hotspot: UrlLinkHotspot; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{hotspot.label ?? "Externer Link"}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground break-all">{hotspot.content.url}</p>
      <Button
        onClick={() => {
          window.open(hotspot.content.url, hotspot.content.openInNewTab ? "_blank" : "_self");
          onClose();
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Link öffnen
      </Button>
    </>
  );
}

function VideoContent({ hotspot }: { hotspot: VideoHotspot }) {
  const embedUrl = getVideoEmbedUrl(hotspot.content.videoUrl);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{hotspot.label ?? "Video"}</DialogTitle>
      </DialogHeader>
      {embedUrl ? (
        <div className="aspect-video">
          <iframe
            src={embedUrl}
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <video src={hotspot.content.videoUrl} controls className="w-full rounded-lg" />
      )}
    </>
  );
}

function ImageContent({ hotspot }: { hotspot: ImageHotspot }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{hotspot.label ?? "Bilder"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        {hotspot.content.images.map((img, i) => (
          <figure key={i}>
            <img
              src={img.url}
              alt={img.caption ?? ""}
              className="w-full rounded-lg object-cover"
            />
            {img.caption && (
              <figcaption className="text-xs text-muted-foreground mt-1 text-center">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </>
  );
}

function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
