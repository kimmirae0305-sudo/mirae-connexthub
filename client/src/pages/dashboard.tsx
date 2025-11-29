import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Briefcase, ArrowRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const recentProjects = projects?.slice(0, 10) || [];

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Here's an overview of your recent projects.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Recent Projects</CardTitle>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-projects">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No projects yet"
              description="Create your first project to get started."
              action={
                <Link href="/projects">
                  <Button size="sm" className="gap-1" data-testid="button-create-first-project">
                    <Plus className="h-4 w-4" /> Create Project
                  </Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Industry</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.map((project) => (
                  <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{project.industry || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} type="project" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
