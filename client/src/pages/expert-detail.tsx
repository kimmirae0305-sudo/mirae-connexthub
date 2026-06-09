import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Linkedin,
  Mail,
  Pencil,
  Phone,
  User,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { ExpertProfileEditor } from "@/components/expert-profile-editor";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CallRecord, Expert, ProjectExpert } from "@shared/schema";

interface WorkExperience {
  company?: string;
  jobTitle?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  isCurrent?: boolean;
}

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "MMM d, yyyy");
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "MMM d, yyyy h:mm a");
}

function formatCurrency(value?: string | number | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

function formatList(values?: string[] | null) {
  return Array.isArray(values) && values.length > 0 ? values.join(", ") : "-";
}

function formatWorkPeriod(experience: WorkExperience) {
  const startMonth = monthOptions.find((option) => option.value === experience.fromMonth)?.label;
  const start = experience.fromYear ? `${startMonth || "Jan"} ${experience.fromYear}` : "-";
  const end = experience.isCurrent
    ? "Present"
    : experience.toYear
      ? `${monthOptions.find((option) => option.value === experience.toMonth)?.label || "Dec"} ${experience.toYear}`
      : "-";
  return `${start} - ${end}`;
}

export default function ExpertDetail() {
  const params = useParams<{ id: string }>();
  const expertId = Number(params.id);
  const isValidExpertId = Number.isInteger(expertId) && expertId > 0;
  const [isEditOpen, setIsEditOpen] = useState(false);

  const {
    data: expert,
    isLoading,
    isError,
    error,
  } = useQuery<Expert>({
    queryKey: ["/api/experts", expertId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/experts/${expertId}`);
      return response.json();
    },
    enabled: isValidExpertId,
  });

  const { data: consultations = [], isLoading: consultationsLoading } = useQuery<CallRecord[]>({
    queryKey: ["/api/experts", expertId, "consultations"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/experts/${expertId}/consultations`);
      return response.json();
    },
    enabled: isValidExpertId,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<ProjectExpert[]>({
    queryKey: ["/api/experts", expertId, "assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/experts/${expertId}/assignments`);
      return response.json();
    },
    enabled: isValidExpertId,
  });

  const handleEditOpenChange = (open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      queryClient.invalidateQueries({ queryKey: ["/api/experts", expertId] });
    }
  };

  if (!isValidExpertId) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/experts">
          <Button variant="outline" data-testid="button-back-to-experts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experts
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Expert not found</AlertTitle>
          <AlertDescription>The expert ID in the URL is not valid.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/experts">
          <Button variant="outline" data-testid="button-back-to-experts-loading">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experts
          </Button>
        </Link>
        <DataTableSkeleton columns={2} rows={6} />
      </div>
    );
  }

  if (isError || !expert) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/experts">
          <Button variant="outline" data-testid="button-back-to-experts-error">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experts
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Expert not found</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "This expert could not be loaded."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const workHistory = Array.isArray(expert.workHistory) ? (expert.workHistory as WorkExperience[]) : [];
  const background = expert.biography || expert.bio;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link href="/experts">
            <Button variant="outline" data-testid="button-back-to-experts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Experts
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{expert.name}</h1>
              <StatusBadge status={expert.status} type="expert" />
            </div>
            <p className="text-muted-foreground">
              {expert.jobTitle || "Expert"}
              {expert.company ? ` at ${expert.company}` : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditOpen(true)} data-testid="button-edit-expert-detail">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Expert
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expertise</CardDescription>
            <CardTitle className="text-base">{expert.expertise}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Industry</CardDescription>
            <CardTitle className="text-base">{expert.industry}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hourly Rate</CardDescription>
            <CardTitle className="font-mono text-base">{formatCurrency(expert.hourlyRate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Experience</CardDescription>
            <CardTitle className="text-base">{expert.yearsOfExperience} years</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Expert background and market coverage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sector Expertise</p>
                  <p className="mt-1 text-sm">{expert.sectorExpertise || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regional Expertise</p>
                  <p className="mt-1 text-sm">{expert.regionalExpertise || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Areas of Expertise</p>
                  <p className="mt-1 text-sm">{formatList(expert.areasOfExpertise)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Languages</p>
                  <p className="mt-1 text-sm">{formatList(expert.languages)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="mt-1 text-sm">
                    {[expert.city, expert.country].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timezone</p>
                  <p className="mt-1 text-sm">{expert.timezone || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio / Background</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {background || "No expert background has been added yet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work History</CardTitle>
              <CardDescription>Professional background currently recorded for this expert.</CardDescription>
            </CardHeader>
            <CardContent>
              {workHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Period</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workHistory.map((experience, index) => (
                      <TableRow key={`${experience.company}-${experience.jobTitle}-${index}`}>
                        <TableCell className="font-medium">{experience.company || "-"}</TableCell>
                        <TableCell>{experience.jobTitle || "-"}</TableCell>
                        <TableCell>{formatWorkPeriod(experience)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title="No work history"
                  description="Work history has not been added for this expert yet."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consultation History</CardTitle>
              <CardDescription>Calls already linked to this expert.</CardDescription>
            </CardHeader>
            <CardContent>
              {consultationsLoading ? (
                <DataTableSkeleton columns={5} rows={4} />
              ) : consultations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Project ID</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>CU Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultations.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>{formatDateTime(call.callDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {call.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.projectId}</TableCell>
                        <TableCell>{call.actualDurationMinutes ?? call.durationMinutes} min</TableCell>
                        <TableCell>{Number(call.cuUsed || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No consultation history"
                  description="No consultation records are linked to this expert yet."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Assignments</CardTitle>
              <CardDescription>Project assignment records already linked to this expert.</CardDescription>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <DataTableSkeleton columns={5} rows={4} />
              ) : assignments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.projectId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {assignment.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{assignment.pipelineStatus.replace(/_/g, " ")}</TableCell>
                        <TableCell className="capitalize">{assignment.sourceType.replace(/_/g, " ")}</TableCell>
                        <TableCell>{formatDate(assignment.assignedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No assignments"
                  description="This expert has not been assigned to any projects yet."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
              <CardDescription>Primary contact information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                  <a href={`mailto:${expert.email}`} className="font-medium text-primary hover:underline">
                    {expert.email}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                  <p className="font-medium">{expert.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{expert.whatsapp || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Linkedin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn</p>
                  {expert.linkedinUrl ? (
                    <a
                      href={expert.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-medium text-primary hover:underline"
                    >
                      {expert.linkedinUrl}
                    </a>
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>Current availability signals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={expert.status} type="expert" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available Now</span>
                <Badge variant={expert.availableNow ? "default" : "secondary"}>
                  {expert.availableNow ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next Available</span>
                <span className="font-medium">{formatDate(expert.nextAvailableDate)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
              <CardDescription>Expert-side commercial fields currently stored.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Hourly Rate
                </span>
                <span className="font-mono font-medium">{formatCurrency(expert.hourlyRate)}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing Info</p>
                <p className="mt-1 whitespace-pre-wrap">{expert.billingInfo || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>Recruiting and onboarding metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  Recruited By
                </span>
                <span className="font-medium">{expert.recruitedBy || expert.sourcedByRaId || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sourced At</span>
                <span className="font-medium">{formatDate(expert.sourcedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDate(expert.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expert</DialogTitle>
            <DialogDescription>Update the expert profile details used by the CRM.</DialogDescription>
          </DialogHeader>
          <ExpertProfileEditor expertId={expertId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
