import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Briefcase, ArrowRight, Plus, TrendingUp, Phone, DollarSign, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useAuth } from "@/lib/auth";
import type { Project } from "@shared/schema";

interface KPICall {
  id: number;
  interviewDate: string;
  expertName: string;
  projectName: string;
  cuUsed: number;
}

interface KPIResponse {
  role: string;
  period: {
    month: number;
    year: number;
    timezone: string;
  };
  totals: {
    totalCalls: number;
    totalCU: number;
    incentive: number;
  };
  calls: KPICall[];
}

function formatBrazilDate(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    pm: "PM",
    ra: "RA",
    finance: "Finance",
  };
  return labels[role] || role.toUpperCase();
}

function getKPISectionTitle(role: string): string {
  if (role === "admin" || role === "finance") {
    return "Company CU Performance";
  }
  return "My CU Performance";
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "";
}

function KPISection() {
  const { user } = useAuth();
  
  const { data: kpiData, isLoading, error } = useQuery<KPIResponse>({
    queryKey: ["/api/kpi/my-monthly"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Unable to load KPI data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!kpiData) {
    return null;
  }

  const periodLabel = `${getMonthName(kpiData.period.month)} ${kpiData.period.year}`;
  const roleLabel = getRoleLabel(kpiData.role);
  const sectionTitle = getKPISectionTitle(kpiData.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          {sectionTitle} – {roleLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          {periodLabel} (Brazil Time)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-kpi-total-cu">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total CU
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cu">
              {kpiData.totals.totalCU.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Credit Units this month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-total-calls">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Calls
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-calls">
              {kpiData.totals.totalCalls}
            </div>
            <p className="text-xs text-muted-foreground">
              Consultations completed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-incentive">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incentive
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-incentive">
              {formatCurrency(kpiData.totals.incentive)}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpiData.role === "ra" 
                ? "R$250/call (max R$2,500)"
                : "R$70 per CU"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">
            Completed Calls This Month
          </CardTitle>
          <CardDescription>
            {kpiData.calls.length === 0 
              ? "No completed calls yet this month."
              : `${kpiData.calls.length} consultation${kpiData.calls.length !== 1 ? "s" : ""} completed`
            }
          </CardDescription>
        </CardHeader>
        {kpiData.calls.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase">Interview Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase">CU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiData.calls.map((call) => (
                  <TableRow key={call.id} data-testid={`row-kpi-call-${call.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatBrazilDate(call.interviewDate)}
                    </TableCell>
                    <TableCell>{call.expertName}</TableCell>
                    <TableCell className="text-muted-foreground">{call.projectName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {call.cuUsed.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

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
          Welcome back! Here's an overview of your performance and recent projects.
        </p>
      </div>

      <KPISection />

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
