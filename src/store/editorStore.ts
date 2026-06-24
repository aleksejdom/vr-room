"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Tour, Scene, Hotspot } from "@/types/tour";

interface EditorState {
  tour: Tour | null;
  activeSceneId: string | null;
  selectedHotspotId: string | null;
  isPlacingHotspot: boolean;
  pendingHotspotPosition: { pitch: number; yaw: number } | null;
  isDirty: boolean;
  isSaving: boolean;

  setTour: (tour: Tour) => void;
  setActiveScene: (sceneId: string) => void;
  selectHotspot: (hotspotId: string | null) => void;
  startPlacingHotspot: () => void;
  cancelPlacingHotspot: () => void;
  confirmHotspotPosition: (pitch: number, yaw: number) => void;
  addHotspot: (sceneId: string, hotspot: Hotspot) => void;
  updateHotspot: (sceneId: string, hotspotId: string, updates: Partial<Hotspot>) => void;
  deleteHotspot: (sceneId: string, hotspotId: string) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
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
    pendingHotspotPosition: null,
    isDirty: false,
    isSaving: false,

    setTour: (tour) =>
      set((state) => {
        state.tour = tour;
        state.activeSceneId =
          tour.startSceneId ?? tour.scenes[0]?.id ?? null;
        state.isDirty = false;
      }),

    setActiveScene: (sceneId) =>
      set((state) => {
        state.activeSceneId = sceneId;
        state.selectedHotspotId = null;
        state.isPlacingHotspot = false;
        state.pendingHotspotPosition = null;
      }),

    selectHotspot: (hotspotId) =>
      set((state) => {
        state.selectedHotspotId = hotspotId;
      }),

    startPlacingHotspot: () =>
      set((state) => {
        state.isPlacingHotspot = true;
        state.selectedHotspotId = null;
        state.pendingHotspotPosition = null;
      }),

    cancelPlacingHotspot: () =>
      set((state) => {
        state.isPlacingHotspot = false;
        state.pendingHotspotPosition = null;
      }),

    confirmHotspotPosition: (pitch, yaw) =>
      set((state) => {
        state.pendingHotspotPosition = { pitch, yaw };
        state.isPlacingHotspot = false;
      }),

    addHotspot: (sceneId, hotspot) =>
      set((state) => {
        const scene = state.tour?.scenes.find((s) => s.id === sceneId);
        if (scene) {
          scene.hotspots.push(hotspot);
          state.isDirty = true;
          state.selectedHotspotId = hotspot.id;
          state.pendingHotspotPosition = null;
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
        state.isDirty = true;
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
