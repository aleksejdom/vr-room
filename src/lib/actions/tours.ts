"use server";

import { db } from "@/lib/db";
import {
  tours,
  scenes,
  hotspots,
  panoramaImages,
  embedSettings,
  projects,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateSlug } from "@/lib/utils";
import { nanoid } from "nanoid";
import type { Hotspot } from "@/types/tour";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user.id;
}

async function requireTourOwnership(tourId: string, userId: string) {
  const tour = await db.query.tours.findFirst({
    where: eq(tours.id, tourId),
    with: { project: { columns: { ownerId: true } } },
  });
  if (!tour || tour.project.ownerId !== userId) return null;
  return tour;
}

export async function createTour(projectId: string) {
  const userId = await requireAuth();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  if (!project) return { error: "Projekt nicht gefunden." };

  const tempId = nanoid(8);
  const name = "Neue Tour";
  const slug = generateSlug(name, tempId);

  const [tour] = await db
    .insert(tours)
    .values({ projectId, name, slug, status: "draft" })
    .returning();

  await db.insert(embedSettings).values({ tourId: tour.id });

  redirect(`/tours/${tour.id}`);
}

export async function getTour(tourId: string) {
  const userId = await requireAuth();

  const tour = await db.query.tours.findFirst({
    where: eq(tours.id, tourId),
    with: {
      project: { columns: { ownerId: true } },
      scenes: {
        with: {
          panoramaImage: true,
          hotspots: { orderBy: (h, { asc }) => [asc(h.order)] },
        },
        orderBy: (s, { asc }) => [asc(s.order)],
      },
      embedSettings: true,
    },
  });

  if (!tour || tour.project.ownerId !== userId) return null;
  return tour;
}

export async function updateTourName(tourId: string, name: string) {
  const userId = await requireAuth();
  if (!name.trim()) return { error: "Name darf nicht leer sein." };

  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  const slug = generateSlug(name, tourId);
  await db
    .update(tours)
    .set({ name, slug, updatedAt: new Date() })
    .where(eq(tours.id, tourId));

  revalidatePath(`/tours/${tourId}`);
}

export async function publishTour(tourId: string) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  await db
    .update(tours)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(tours.id, tourId));

  revalidatePath(`/tours/${tourId}`);
  return { success: true };
}

export async function unpublishTour(tourId: string) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  await db
    .update(tours)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(tours.id, tourId));

  revalidatePath(`/tours/${tourId}`);
}

export async function setStartScene(tourId: string, sceneId: string) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  await db
    .update(tours)
    .set({ startSceneId: sceneId, updatedAt: new Date() })
    .where(eq(tours.id, tourId));

  revalidatePath(`/tours/${tourId}`);
}

export async function createScene(tourId: string, name: string) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  const existingScenes = await db.query.scenes.findMany({
    where: eq(scenes.tourId, tourId),
    columns: { id: true },
  });

  const [scene] = await db
    .insert(scenes)
    .values({ tourId, name, order: existingScenes.length })
    .returning();

  revalidatePath(`/tours/${tourId}`);
  return { scene };
}

export async function deleteScene(tourId: string, sceneId: string) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  await db.delete(scenes).where(eq(scenes.id, sceneId));
  revalidatePath(`/tours/${tourId}`);
}

export async function updateSceneOrder(tourId: string, orderedIds: string[]) {
  const userId = await requireAuth();
  const tour = await requireTourOwnership(tourId, userId);
  if (!tour) return { error: "Nicht gefunden." };

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(scenes).set({ order: index }).where(eq(scenes.id, id))
    )
  );

  revalidatePath(`/tours/${tourId}`);
}

export async function confirmPanoramaUpload(
  sceneId: string,
  storageKey: string,
  url: string,
  thumbnailUrl: string,
  width: number,
  height: number,
  fileSize: number
) {
  const userId = await requireAuth();

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    with: { tour: { with: { project: { columns: { ownerId: true } } } } },
  });

  if (!scene || scene.tour.project.ownerId !== userId) {
    return { error: "Nicht gefunden." };
  }

  await db
    .insert(panoramaImages)
    .values({ sceneId, storageKey, url, thumbnailUrl, width, height, fileSize })
    .onConflictDoUpdate({
      target: panoramaImages.sceneId,
      set: { storageKey, url, thumbnailUrl, width, height, fileSize, uploadedAt: new Date() },
    });

  revalidatePath(`/tours/${scene.tourId}`);
  return { success: true };
}

export async function saveHotspots(sceneId: string, updatedHotspots: Hotspot[]) {
  const userId = await requireAuth();

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    with: { tour: { with: { project: { columns: { ownerId: true } } } } },
  });

  if (!scene || scene.tour.project.ownerId !== userId) {
    return { error: "Nicht gefunden." };
  }

  await db.delete(hotspots).where(eq(hotspots.sceneId, sceneId));

  if (updatedHotspots.length > 0) {
    await db.insert(hotspots).values(
      updatedHotspots.map((h, i) => ({
        id: h.id,
        sceneId,
        type: h.type,
        pitch: h.pitch,
        yaw: h.yaw,
        label: h.label,
        iconType: h.iconType,
        iconColor: h.iconColor,
        content: h.content,
        order: i,
      }))
    );
  }

  revalidatePath(`/tours/${scene.tourId}`);
  return { success: true };
}
