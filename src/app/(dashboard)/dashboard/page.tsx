import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, tours } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FolderOpen, Plus, Globe, FileText, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const userProjects = await db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
    with: {
      tours: {
        columns: { id: true, name: true, status: true, updatedAt: true, slug: true },
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        limit: 3,
      },
    },
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
    limit: 5,
  });

  const totalTours = userProjects.reduce((acc, p) => acc + p.tours.length, 0);
  const publishedTours = userProjects
    .flatMap((p) => p.tours)
    .filter((t) => t.status === "published").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Willkommen zurück, {session?.user?.name?.split(" ")[0]}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Projekte</CardDescription>
            <CardTitle className="text-3xl">{userProjects.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Free Plan: 1 Projekt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Touren gesamt</CardDescription>
            <CardTitle className="text-3xl">{totalTours}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Free Plan: max. 3 Touren</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Veröffentlicht</CardDescription>
            <CardTitle className="text-3xl">{publishedTours}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Öffentlich zugänglich</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Meine Projekte</h2>
        <Link href="/projects" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          Alle Projekte
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {userProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="p-4 rounded-full bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Noch keine Projekte</p>
              <p className="text-sm text-muted-foreground">
                Erstelle dein erstes Projekt und starte mit deiner ersten Tour
              </p>
            </div>
            <Link href="/projects" className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="h-4 w-4" />
              Erstes Projekt erstellen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {userProjects.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="mt-0.5">{project.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {project.tours.length} Tour{project.tours.length !== 1 ? "en" : ""}
                  </Badge>
                </div>
              </CardHeader>
              {project.tours.length > 0 && (
                <CardContent className="pt-0">
                  <div className="grid sm:grid-cols-3 gap-2">
                    {project.tours.map((tour) => (
                      <Link
                        key={tour.id}
                        href={`/tours/${tour.id}`}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="p-1.5 rounded-md bg-muted">
                          {tour.status === "published" ? (
                            <Globe className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{tour.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {tour.status === "published" ? "Veröffentlicht" : "Entwurf"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
