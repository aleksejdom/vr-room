"use client";

import { useState } from "react";
import { createProject, deleteProject, getProjects } from "@/lib/actions/projects";
import { createTour } from "@/lib/actions/tours";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Trash2, Globe, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ProjectWithTours = Awaited<ReturnType<typeof getProjects>>[number];

export function ProjectsClient({ projects }: { projects: ProjectWithTours[] }) {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const result = await createProject(new FormData(e.currentTarget));
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Projekt erstellt");
      setIsNewProjectOpen(false);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Projekt "${name}" wirklich löschen?`)) return;
    await deleteProject(id);
    toast.success("Projekt gelöscht");
  };

  const handleCreateTour = async (projectId: string) => {
    await createTour(projectId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projekte</h1>
          <p className="text-muted-foreground text-sm">
            Organisiere deine 360°-Touren in Projekten
          </p>
        </div>
        <Button onClick={() => setIsNewProjectOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="glass rounded-2xl border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Noch keine Projekte vorhanden</p>
            <Button onClick={() => setIsNewProjectOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Erstes Projekt erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="glass rounded-2xl">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription>{project.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {project.tours.length} Tour{project.tours.length !== 1 ? "en" : ""}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDelete(project.id, project.name)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Projekt löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.tours.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {project.tours.map((tour) => (
                      <Link
                        key={tour.id}
                        href={`/tours/${tour.id}`}
                        className="flex items-center gap-2.5 p-3 rounded-xl border bg-card/50 hover:bg-muted/50 hover:border-primary/30 transition-all"
                      >
                        <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                          {tour.status === "published" ? (
                            <Globe className="h-4 w-4 text-primary" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tour.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tour.status === "published" ? "Veröffentlicht" : "Entwurf"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                <form action={() => handleCreateTour(project.id)}>
                  <Button type="submit" variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Neue Tour erstellen
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="glass-strong rounded-2xl">
          <DialogHeader>
            <DialogTitle>Neues Projekt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Projektname *</Label>
                <Input
                  id="proj-name"
                  name="name"
                  required
                  placeholder="z.B. Musterwohnung München"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-desc">Beschreibung (optional)</Label>
                <Textarea
                  id="proj-desc"
                  name="description"
                  placeholder="Kurze Beschreibung des Projekts..."
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsNewProjectOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
