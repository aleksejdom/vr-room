export type HotspotType = "scene_link" | "info_text" | "url_link" | "image" | "video";

export type PlanType = "free" | "starter" | "pro" | "agency";
export type TourStatus = "draft" | "published" | "archived";

interface BaseHotspot {
  id: string;
  sceneId: string;
  pitch: number;
  yaw: number;
  label?: string;
  iconType: "arrow" | "info" | "link" | "play" | "image" | "custom";
  iconColor: string;
  order: number;
}

export interface SceneLinkHotspot extends BaseHotspot {
  type: "scene_link";
  content: {
    targetSceneId: string;
    transitionType?: "fade" | "instant";
  };
}

export interface InfoTextHotspot extends BaseHotspot {
  type: "info_text";
  content: {
    title: string;
    description?: string;
    imageUrl?: string;
  };
}

export interface UrlLinkHotspot extends BaseHotspot {
  type: "url_link";
  content: {
    url: string;
    openInNewTab: boolean;
  };
}

export interface VideoHotspot extends BaseHotspot {
  type: "video";
  content: {
    videoUrl: string;
    autoplay: boolean;
    thumbnail?: string;
  };
}

export interface ImageHotspot extends BaseHotspot {
  type: "image";
  content: {
    images: { url: string; caption?: string }[];
  };
}

export type Hotspot =
  | SceneLinkHotspot
  | InfoTextHotspot
  | UrlLinkHotspot
  | VideoHotspot
  | ImageHotspot;

export interface PanoramaImage {
  id: string;
  sceneId: string;
  storageKey: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}

export interface Scene {
  id: string;
  tourId: string;
  name: string;
  order: number;
  initialYaw: number;
  initialPitch: number;
  ambientAudio: string | null;
  panoramaImage: PanoramaImage | null;
  hotspots: Hotspot[];
}

export interface EmbedSettings {
  id: string;
  tourId: string;
  defaultWidth: string;
  defaultHeight: string;
  showControls: boolean;
  showTitle: boolean;
  showFullscreen: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  gyroEnabled: boolean;
}

export interface BrandingSettings {
  id: string;
  orgId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  showPoweredBy: boolean;
}

export interface Tour {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  status: TourStatus;
  startSceneId: string | null;
  password: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
  embedSettings: EmbedSettings | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tours?: Tour[];
}
