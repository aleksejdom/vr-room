"use server";

import { db } from "@/lib/db";
import {
  tours,
  scenes,
  hotspots,
  panoramaImages,
  embedSettings,
  projects,
  analyticsEvents,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, notInArray, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateSlug } from "@/lib/utils";
import { nanoid } from "nanoid";
import { r2 } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { detectHorizon } from "@/lib/horizon";
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

export async function updateSceneName(sceneId: string, name: string) {
  const userId = await requireAuth();

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    with: { tour: { with: { project: { columns: { ownerId: true } } } } },
  });
  if (!scene || scene.tour.project.ownerId !== userId) {
    return { error: "Nicht gefunden." };
  }

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    return { error: "Ungültiger Name." };
  }

  await db.update(scenes).set({ name: trimmed }).where(eq(scenes.id, sceneId));

  revalidatePath(`/tours/${scene.tourId}`);
  return { success: true };
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

export async function updateSceneViewport(
  sceneId: string,
  yaw: number,
  pitch: number,
  zoom: number
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
    .update(scenes)
    .set({ initialYaw: yaw, initialPitch: pitch, initialZoom: zoom })
    .where(eq(scenes.id, sceneId));

  // Bewusst KEIN revalidatePath auf den Editor: der Router-Refresh würde
  // setTour(initialTour) auslösen und ungespeicherte Hotspot-Änderungen
  // verwerfen. Der Editor-Store wird clientseitig aktualisiert; die
  // öffentliche Tour-Seite rendert dynamisch (force-dynamic).
  return { success: true };
}

/**
 * Richtet eine Szene automatisch am Horizont aus: lädt das Panorama aus dem
 * Storage, erkennt die dominante horizontale Linie im Bild und speichert
 * daraus die Begradigungswinkel (horizonTilt/-Roll); die Startansicht wird
 * auf den Horizont nivelliert (initialPitch = 0).
 */
export async function alignSceneHorizon(sceneId: string) {
  const userId = await requireAuth();

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    with: {
      tour: { with: { project: { columns: { ownerId: true } } } },
      panoramaImage: true,
    },
  });

  if (!scene || scene.tour.project.ownerId !== userId) {
    return { error: "Nicht gefunden." };
  }
  if (!scene.panoramaImage) {
    return { error: "Diese Szene hat noch kein Panorama." };
  }

  let buffer: Buffer;
  try {
    const object = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET_NAME!,
        Key: scene.panoramaImage.storageKey,
      })
    );
    buffer = Buffer.from(await object.Body!.transformToByteArray());
  } catch (err) {
    console.error("[alignSceneHorizon] storage error:", err);
    return { error: "Panorama konnte nicht geladen werden." };
  }

  let detection;
  try {
    detection = await detectHorizon(buffer);
  } catch (err) {
    console.error("[alignSceneHorizon] detection error:", err);
    return { error: "Bild konnte nicht analysiert werden." };
  }
  if (!detection) {
    return {
      error:
        "Horizont konnte nicht zuverlässig erkannt werden. Die Ansicht kann weiterhin manuell über „Ansicht speichern“ gesetzt werden.",
    };
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  const tilt = round(detection.tiltDeg);
  const roll = round(detection.rollDeg);
  // Nach der Begradigung liegt der Horizont per Definition auf Pitch 0 —
  // die Startansicht wird also nivelliert, nicht auf die erkannte Linie
  // (z. B. eine Bodenkante) zentriert.
  const pitch = 0;

  await db
    .update(scenes)
    .set({ initialPitch: pitch, horizonTilt: tilt, horizonRoll: roll })
    .where(eq(scenes.id, sceneId));

  // Wie bei updateSceneViewport bewusst KEIN revalidatePath: der Editor-Store
  // wird clientseitig aktualisiert, die öffentlichen Seiten rendern dynamisch.
  return { success: true, pitch, tilt, roll, confidence: detection.confidence };
}

/** Persistiert die manuelle Level-Korrektur (Kuula-Stil) einer Szene. */
export async function updateSceneLevel(sceneId: string, tilt: number, roll: number) {
  const userId = await requireAuth();

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    with: { tour: { with: { project: { columns: { ownerId: true } } } } },
  });

  if (!scene || scene.tour.project.ownerId !== userId) {
    return { error: "Nicht gefunden." };
  }
  if (
    !Number.isFinite(tilt) ||
    !Number.isFinite(roll) ||
    Math.abs(tilt) > 45 ||
    Math.abs(roll) > 45
  ) {
    return { error: "Ungültige Korrekturwerte." };
  }

  await db
    .update(scenes)
    .set({ horizonTilt: tilt, horizonRoll: roll })
    .where(eq(scenes.id, sceneId));

  // Wie bei updateSceneViewport bewusst KEIN revalidatePath
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

  try {
    if (updatedHotspots.length > 0) {
      // Upsert all current hotspots (avoids FK violations from delete-then-insert)
      await db
        .insert(hotspots)
        .values(
          updatedHotspots.map((h, i) => ({
            id: h.id,
            sceneId,
            type: h.type,
            pitch: h.pitch,
            yaw: h.yaw,
            label: h.label ?? null,
            iconType: h.iconType ?? "arrow",
            iconColor: h.iconColor ?? "#ffffff",
            content: h.content,
            order: i,
          }))
        )
        .onConflictDoUpdate({
          target: hotspots.id,
          set: {
            pitch: sql`excluded.pitch`,
            yaw: sql`excluded.yaw`,
            label: sql`excluded.label`,
            iconType: sql`excluded.icon_type`,
            iconColor: sql`excluded.icon_color`,
            content: sql`excluded.content`,
            order: sql`excluded.order`,
          },
        });

      // Delete hotspots that were removed from this scene
      const currentIds = updatedHotspots.map((h) => h.id);
      const removed = await db
        .select({ id: hotspots.id })
        .from(hotspots)
        .where(and(eq(hotspots.sceneId, sceneId), notInArray(hotspots.id, currentIds)));
      if (removed.length > 0) {
        const removedIds = removed.map((r) => r.id);
        // Null out analytics references before deleting to avoid FK violation
        await db
          .update(analyticsEvents)
          .set({ hotspotId: null })
          .where(inArray(analyticsEvents.hotspotId, removedIds));
        await db
          .delete(hotspots)
          .where(inArray(hotspots.id, removedIds));
      }
    } else {
      // All hotspots removed for this scene — null out analytics first
      const existing = await db
        .select({ id: hotspots.id })
        .from(hotspots)
        .where(eq(hotspots.sceneId, sceneId));
      if (existing.length > 0) {
        await db
          .update(analyticsEvents)
          .set({ hotspotId: null })
          .where(inArray(analyticsEvents.hotspotId, existing.map((r) => r.id)));
        await db.delete(hotspots).where(eq(hotspots.sceneId, sceneId));
      }
    }

    revalidatePath(`/tours/${scene.tourId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[saveHotspots] error:", message);
    return { error: message };
  }
}
