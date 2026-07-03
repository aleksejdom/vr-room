"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Tour, Scene, Hotspot, HotspotType } from "@/types/tour";

interface EditorState {
  tour: Tour | null;
  activeSceneId: string | null;
  selectedHotspotId: string | null;
  isPlacingHotspot: boolean;
  newHotspotType: HotspotType;
  isDirty: boolean;
  isSaving: boolean;

  setTour: (tour: Tour) => void;
  setActiveScene: (sceneId: string) => void;
  selectHotspot: (hotspotId: string | null) => void;
  setNewHotspotType: (type: HotspotType) => void;
  startPlacingHotspot: () => void;
  cancelPlacingHotspot: () => void;
  addHotspot: (sceneId: string, hotspot: Hotspot) => void;
  updateHotspot: (sceneId: string, hotspotId: string, updates: Partial<Hotspot>) => void;
  deleteHotspot: (sceneId: string, hotspotId: string) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  setSceneViewport: (sceneId: string, yaw: number, pitch: number) => void;
  reorderScenes: (sceneIds: string[]) => void;
  setScenePanorama: (
    sceneId: string,
    panorama: { url: string; thumbnailUrl: string; storageKey: string; width: number; height: number }
  ) => void;
  markSaved: () => void;
  setIsSaving: (saving: boolean) => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    tour: null,
    activeSceneId: null,
    selectedHotspotId: null,
    isPlacingHotspot: false,
    newHotspotType: "scene_link",
    isDirty: false,
    isSaving: false,

    setTour: (tour) =>
      set((state) => {
        state.tour = tour;
        // Keep the currently edited scene when the tour is refreshed
        // (e.g. after revalidatePath from "Ansicht speichern" or upload);
        // only fall back to the start scene if it no longer exists.
        const activeStillExists =
          state.activeSceneId != null &&
          tour.scenes.some((s) => s.id === state.activeSceneId);
        if (!activeStillExists) {
          state.activeSceneId =
            tour.startSceneId ?? tour.scenes[0]?.id ?? null;
        }
        state.isDirty = false;
      }),

    setActiveScene: (sceneId) =>
      set((state) => {
        state.activeSceneId = sceneId;
        state.selectedHotspotId = null;
        state.isPlacingHotspot = false;
      }),

    selectHotspot: (hotspotId) =>
      set((state) => {
        state.selectedHotspotId = hotspotId;
      }),

    setNewHotspotType: (type) =>
      set((state) => {
        state.newHotspotType = type;
      }),

    startPlacingHotspot: () =>
      set((state) => {
        state.isPlacingHotspot = true;
        state.selectedHotspotId = null;
      }),

    cancelPlacingHotspot: () =>
      set((state) => {
        state.isPlacingHotspot = false;
      }),

    addHotspot: (sceneId, hotspot) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.hotspots.push(hotspot);
          state.isDirty = true;
          state.selectedHotspotId = hotspot.id;
          state.isPlacingHotspot = false;
        }
      }),

    updateHotspot: (sceneId, hotspotId, updates) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        const hotspot = scene?.hotspots.find((h) => h.id === hotspotId);
        if (hotspot) {
          Object.assign(hotspot, updates);
          state.isDirty = true;
        }
      }),

    deleteHotspot: (sceneId, hotspotId) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.hotspots = scene.hotspots.filter((h) => h.id !== hotspotId);
          state.isDirty = true;
          state.selectedHotspotId = null;
        }
      }),

    updateScene: (sceneId, updates) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          Object.assign(scene, updates);
          state.isDirty = true;
        }
      }),

    // Updates viewport without marking isDirty — it's persisted separately
    setSceneViewport: (sceneId, yaw, pitch) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.initialYaw = yaw;
          scene.initialPitch = pitch;
        }
      }),

    // Ordnet Szenen neu, ohne isDirty zu setzen — die Reihenfolge wird
    // direkt beim Drop über updateSceneOrder persistiert.
    reorderScenes: (sceneIds) =>
      set((state) => {
        if (!state.tour) return;
        const ordered = sceneIds
          .map((id, index) => {
            const sc = state.tour!.scenes.find((s) => s.id === id);
            if (sc) sc.order = index;
            return sc;
          })
          .filter(Boolean) as Scene[];
        state.tour.scenes = ordered;
      }),

    setScenePanorama: (sceneId, panorama) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.panoramaImage = {
            id: "",
            sceneId,
            storageKey: panorama.storageKey,
            url: panorama.url,
            thumbnailUrl: panorama.thumbnailUrl,
            width: panorama.width,
            height: panorama.height,
            fileSize: null,
          };
          state.isDirty = true;
        }
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false;
      }),

    setIsSaving: (saving) =>
      set((state) => {
        state.isSaving = saving;
      }),
  }))
);

export const useActiveScene = () =>
  useEditorStore((s) =>
    s.tour?.scenes.find((sc) => sc.id === s.activeSceneId)
  );

export const useSelectedHotspot = () =>
  useEditorStore((s) => {
    const scene = s.tour?.scenes.find((sc) => sc.id === s.activeSceneId);
    return scene?.hotspots.find((h) => h.id === s.selectedHotspotId) ?? null;
  });
