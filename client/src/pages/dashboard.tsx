import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Briefcase, ArrowRight, Plus, TrendingUp, Phone, DollarSign, AlertCircle, ClipboardList, UserPlus, CalendarDays, ChevronLeft, ChevronRight, Clock, List, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { normalizeRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

interface KPICall {
  id: number;
  interviewDate: string;
  expertName: string;
  projectName: string;
  clientName?: string;
  cuUsed: number;
  cuRatePerCU?: number;
  revenueUSD?: number;
}

interface CompanyTotals {
  totalCompanyCU: number;
  totalCompanyCalls: number;
  totalCompanyRevenueUSD: number;
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
  companyTotals?: CompanyTotals;
  calls: KPICall[];
}

interface ConsultationCalendarEvent {
  id: number;
  projectId: number;
  projectName: string;
  clientOrganizationId: number | null;
  clientOrganizationName: string | null;
  clientName: string | null;
  expertId: number;
  expertName: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  callDate: string;
  timezone: string | null;
  durationMinutes: number;
  status: string;
  meetingLink: string | null;
  pmId: number | null;
  pmName: string | null;
  scheduledByUserId: number | null;
  scheduledByUserName: string | null;
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

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

function isManagementRole(role: string): boolean {
  return role === "admin" || role === "finance";
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
  const isManagement = isManagementRole(kpiData.role);

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
              {(kpiData.companyTotals?.totalCompanyCU ?? kpiData.totals.totalCU).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isManagement ? "Company CU this month" : "Credit Units this month"}
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
              {kpiData.companyTotals?.totalCompanyCalls ?? kpiData.totals.totalCalls}
            </div>
            <p className="text-xs text-muted-foreground">
              Consultations completed
            </p>
          </CardContent>
        </Card>

        {isManagement ? (
          <Card data-testid="card-kpi-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-revenue">
                {formatUSD(kpiData.companyTotals?.totalCompanyRevenueUSD ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total revenue this month
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid={kpiData.role === "ra" ? "card-kpi-sourcing-output" : "card-kpi-operational-output"}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpiData.role === "ra" ? "Sourcing Output" : "Operational Output"}
              </CardTitle>
              {kpiData.role === "ra" ? (
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-operational-output">
                {kpiData.role === "ra" ? kpiData.totals.totalCalls : kpiData.totals.totalCU.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpiData.role === "ra" ? "Completed sourced consultations" : "CU delivered this month"}
              </p>
            </CardContent>
          </Card>
        )}
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
                  {isManagement && (
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                  )}
                  <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase">CU</TableHead>
                  {isManagement && (
                    <TableHead className="text-right text-xs font-semibold uppercase">Revenue (USD)</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiData.calls.map((call) => (
                  <TableRow key={call.id} data-testid={`row-kpi-call-${call.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatBrazilDate(call.interviewDate)}
                    </TableCell>
                    {isManagement && (
                      <TableCell className="text-muted-foreground">{call.clientName}</TableCell>
                    )}
                    <TableCell>{call.expertName}</TableCell>
                    <TableCell className="text-muted-foreground">{call.projectName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {call.cuUsed.toFixed(2)}
                    </TableCell>
                    {isManagement && (
                      <TableCell className="text-right font-medium">
                        {call.revenueUSD ? formatUSD(call.revenueUSD) : "-"}
                      </TableCell>
                    )}
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

function getEventStart(event: ConsultationCalendarEvent) {
  return new Date(event.scheduledStartTime || event.callDate);
}

function getEventEnd(event: ConsultationCalendarEvent) {
  return event.scheduledEndTime ? new Date(event.scheduledEndTime) : null;
}

function getMeetingLinkStatus(event: ConsultationCalendarEvent) {
  return event.meetingLink ? "Ready" : "Missing";
}

function formatEventTime(event: ConsultationCalendarEvent) {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  const startText = format(start, "MMM d, yyyy HH:mm");
  return end ? `${startText} - ${format(end, "HH:mm")}` : startText;
}

function CalendarDetail({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-md border border-border/60 p-3 sm:grid-cols-[160px_1fr] sm:items-center">
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "-"}</dd>
    </div>
  );
}

function ConsultationCalendarSection() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<ConsultationCalendarEvent | null>(null);

  const { data, isLoading, error } = useQuery<{ events: ConsultationCalendarEvent[] }>({
    queryKey: ["/api/dashboard/consultation-calendar"],
  });

  const events = useMemo(
    () => (data?.events || []).slice().sort((a, b) => getEventStart(a).getTime() - getEventStart(b).getTime()),
    [data?.events]
  );

  const visibleMonthDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart)),
    });
  }, [month]);

  const monthEvents = useMemo(
    () => events.filter((event) => isSameMonth(getEventStart(event), month)),
    [events, month]
  );

  const normalizedRole = normalizeRole(user?.role);
  const canViewClientOrganization = normalizedRole ? ["admin", "ceo", "coo", "pm"].includes(normalizedRole) : false;

  const renderEventButton = (event: ConsultationCalendarEvent, compact = false) => (
    <button
      key={event.id}
      type="button"
      onClick={() => setSelectedEvent(event)}
      className={cn(
        "w-full rounded-md border border-border bg-background px-2 py-1 text-left transition-colors hover:border-primary/60 hover:bg-accent",
        compact ? "space-y-0.5" : "space-y-1.5"
      )}
      data-testid={`button-calendar-event-${event.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">{format(getEventStart(event), "HH:mm")}</span>
        <Badge variant={event.meetingLink ? "secondary" : "outline"} className="h-5 shrink-0 px-1.5 text-[10px]">
          {getMeetingLinkStatus(event)}
        </Badge>
      </div>
      <p className="truncate text-xs font-medium">{event.expertName}</p>
      {!compact && <p className="truncate text-xs text-muted-foreground">{event.projectName}</p>}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Consultation Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Scheduled consultation calls shown from CRM scheduling data. Project Managers see calls they own or are assigned to.
        </p>
      </div>

      <Tabs defaultValue="month" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="month" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Month
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" /> List
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonth((value) => subMonths(value, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-40 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
            <Button variant="outline" size="icon" onClick={() => setMonth((value) => addMonths(value, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-muted-foreground">Unable to load scheduled consultations.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="month" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">{monthEvents.length} scheduled call{monthEvents.length === 1 ? "" : "s"} this month</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 35 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 w-full" />
                      ))}
                    </div>
                  ) : events.length === 0 ? (
                    <EmptyState
                      icon={CalendarDays}
                      title="No scheduled calls"
                      description="Scheduled consultation calls will appear here once they are added from Project Details."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[900px] grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="px-2 text-xs font-semibold uppercase text-muted-foreground">
                            {day}
                          </div>
                        ))}
                        {visibleMonthDays.map((day) => {
                          const dayEvents = events.filter((event) => isSameDay(getEventStart(event), day));
                          return (
                            <div
                              key={day.toISOString()}
                              className={cn(
                                "min-h-32 rounded-md border border-border/70 bg-card p-2",
                                !isSameMonth(day, month) && "bg-muted/40 text-muted-foreground"
                              )}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold">{format(day, "d")}</span>
                                {dayEvents.length > 0 && (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    {dayEvents.length}
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {dayEvents.slice(0, 3).map((event) => renderEventButton(event, true))}
                                {dayEvents.length > 3 && (
                                  <p className="px-1 text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Scheduled Consultation List</CardTitle>
                  <CardDescription>Open an event to view call details and meeting access.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : events.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No scheduled consultations"
                      description="There are no scheduled consultation calls visible for your account."
                    />
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="grid w-full gap-3 rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent md:grid-cols-[180px_1fr_180px_140px]"
                          data-testid={`button-calendar-list-event-${event.id}`}
                        >
                          <div>
                            <p className="text-sm font-semibold">{format(getEventStart(event), "MMM d, yyyy")}</p>
                            <p className="text-sm text-muted-foreground">{format(getEventStart(event), "HH:mm")}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{event.projectName}</p>
                            <p className="truncate text-sm text-muted-foreground">{event.expertName}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">{event.durationMinutes} min planned</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={event.status} type="call" />
                            <Badge variant={event.meetingLink ? "secondary" : "outline"}>
                              {getMeetingLinkStatus(event)}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consultation Event</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <dl className="grid gap-2">
                <CalendarDetail label="Project" value={selectedEvent.projectName} />
                <CalendarDetail label="Expert" value={selectedEvent.expertName} />
                {canViewClientOrganization && (
                  <CalendarDetail
                    label="Client Organization"
                    value={selectedEvent.clientOrganizationName || selectedEvent.clientName || "-"}
                  />
                )}
                <CalendarDetail label="Scheduled Date and Time" value={formatEventTime(selectedEvent)} />
                <CalendarDetail label="Time Zone" value={selectedEvent.timezone || "America/Sao_Paulo"} />
                <CalendarDetail label="Planned Duration" value={`${selectedEvent.durationMinutes} min`} />
                <CalendarDetail
                  label="Meeting Link"
                  value={
                    selectedEvent.meetingLink ? (
                      <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                        {selectedEvent.meetingLink}
                      </a>
                    ) : (
                      "Not added"
                    )
                  }
                />
                <CalendarDetail label="Status" value={<StatusBadge status={selectedEvent.status} type="call" />} />
                <CalendarDetail label="Assigned PM / Scheduled By" value={selectedEvent.pmName || selectedEvent.scheduledByUserName || "-"} />
              </dl>
              {selectedEvent.meetingLink && (
                <div className="flex justify-end">
                  <Button asChild className="gap-2" data-testid="button-open-meeting">
                    <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4" /> Open Meeting
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
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
        </TabsContent>

        <TabsContent value="calendar">
          <ConsultationCalendarSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
