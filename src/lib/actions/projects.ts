"use server";

import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user.id;
}

export async function createProject(formData: FormData) {
  const userId = await requireAuth();

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return { error: "Ungültige Eingabe." };

  const [project] = await db
    .insert(projects)
    .values({ ...parsed.data, ownerId: userId! })
    .returning();

  revalidatePath("/projects");
  return { project };
}

export async function deleteProject(projectId: string) {
  const userId = await requireAuth();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });

  if (!project) return { error: "Nicht gefunden." };

  await db.delete(projects).where(eq(projects.id, projectId));
  revalidatePath("/projects");
}

export async function updateProject(projectId: string, formData: FormData) {
  const userId = await requireAuth();

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return { error: "Ungültige Eingabe." };

  await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));

  revalidatePath("/projects");
}

export async function getProjects() {
  const userId = await requireAuth();

  return db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
    with: {
      tours: {
        columns: { id: true, name: true, status: true, updatedAt: true },
      },
    },
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
  });
}
