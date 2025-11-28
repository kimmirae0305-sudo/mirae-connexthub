import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Briefcase, Users, Clock, CreditCard, ArrowRight, Plus } from "lucide-react";
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
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Project, Expert, UsageRecord } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts, isLoading: expertsLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const { data: usageRecords, isLoading: usageLoading } = useQuery<UsageRecord[]>({
    queryKey: ["/api/usage"],
  });

  const activeProjects = projects?.filter((p) => p.status === "active").length || 0;
  const totalExperts = experts?.length || 0;
  const availableExperts = experts?.filter((e) => e.status === "available").length || 0;
  
  const totalMinutes = usageRecords?.reduce((sum, r) => sum + r.durationMinutes, 0) || 0;
  const totalCredits = usageRecords?.reduce((sum, r) => sum + Number(r.creditsUsed), 0) || 0;

  const recentProjects = projects?.slice(0, 5) || [];

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Here's an overview of your expert network.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {projectsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Active Projects"
              value={activeProjects}
              subtitle={`${projects?.length || 0} total projects`}
              icon={Briefcase}
            />
            <MetricCard
              title="Total Experts"
              value={totalExperts}
              subtitle={`${availableExperts} available`}
              icon={Users}
            />
            <MetricCard
              title="Call Minutes"
              value={totalMinutes.toLocaleString()}
              subtitle="Total duration"
              icon={Clock}
            />
            <MetricCard
              title="Credits Used"
              value={totalCredits.toFixed(2)}
              subtitle="CU consumption"
              icon={CreditCard}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                {Array.from({ length: 3 }).map((_, i) => (
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
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProjects.map((project) => (
                    <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="text-base font-medium">Available Experts</CardTitle>
            <Link href="/experts">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-experts">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {expertsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (experts?.length || 0) === 0 ? (
              <EmptyState
                icon={Users}
                title="No experts yet"
                description="Register experts to build your network."
                action={
                  <Link href="/experts">
                    <Button size="sm" className="gap-1" data-testid="button-register-first-expert">
                      <Plus className="h-4 w-4" /> Register Expert
                    </Button>
                  </Link>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expertise</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experts?.slice(0, 5).map((expert) => (
                    <TableRow key={expert.id} data-testid={`row-expert-${expert.id}`}>
                      <TableCell className="font-medium">{expert.name}</TableCell>
                      <TableCell className="text-muted-foreground">{expert.expertise}</TableCell>
                      <TableCell>
                        <StatusBadge status={expert.status} type="expert" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
