import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Users,
  ClipboardList,
  Search,
  Mail,
  MessageCircle,
  Check,
  X,
  Clock,
  UserPlus,
  Send,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Link2,
  Copy,
  Activity,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  ExternalLink,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, Expert, VettingQuestion, ProjectExpert, ProjectActivity } from "@shared/schema";

interface EnrichedExpert extends ProjectExpert {
  expert?: Expert;
  sourcedByRa?: { id: number; fullName: string } | null;
}

interface ProjectDetailData extends Project {
  createdByPm?: { id: number; fullName: string; email: string } | null;
  assignedRas?: { id: number; fullName: string; email: string }[];
  vettingQuestions?: VettingQuestion[];
  internalExperts?: EnrichedExpert[];
  raSourcedExperts?: EnrichedExpert[];
  activities?: ProjectActivity[];
  raInviteLinks?: any[];
}

interface RAUser {
  id: number;
  fullName: string;
  email: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const projectId = parseInt(id || "0");

  const [expertSearchQuery, setExpertSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [selectedExperts, setSelectedExperts] = useState<Set<number>>(new Set());
  const [selectedRaIds, setSelectedRaIds] = useState<number[]>([]);
  const [isAssignRaModalOpen, setIsAssignRaModalOpen] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { data: projectDetail, isLoading: projectLoading, refetch: refetchProject } = useQuery<ProjectDetailData>({
    queryKey: ["/api/projects", projectId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/detail`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: allRAs } = useQuery<RAUser[]>({
    queryKey: ["/api/users/ras"],
  });

  const { data: allExperts } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<Expert[]>({
    queryKey: [
      "/api/experts/search",
      { q: expertSearchQuery, country: countryFilter, minRate, maxRate },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (expertSearchQuery) params.append("q", expertSearchQuery);
      if (countryFilter) params.append("country", countryFilter);
      if (minRate) params.append("minRate", minRate);
      if (maxRate) params.append("maxRate", maxRate);
      const res = await fetch(`/api/experts/search?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      return res.json();
    },
    enabled: !!(expertSearchQuery || countryFilter || minRate || maxRate),
  });

  const expertsToShow = (expertSearchQuery || countryFilter || minRate || maxRate) ? searchResults : allExperts;

  const assignedExpertIds = new Set([
    ...(projectDetail?.internalExperts?.map((pe) => pe.expertId) || []),
    ...(projectDetail?.raSourcedExperts?.map((pe) => pe.expertId) || []),
  ]);

  const assignRasMutation = useMutation({
    mutationFn: async (raIds: number[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/assign-ras`, { raIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsAssignRaModalOpen(false);
      toast({ title: "RAs assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign RAs", variant: "destructive" });
    },
  });

  const attachExpertsMutation = useMutation({
    mutationFn: async (expertIds: number[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/experts/bulk`, { expertIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setSelectedExperts(new Set());
      toast({ title: data.message || "Experts attached successfully" });
    },
    onError: () => {
      toast({ title: "Failed to attach experts", variant: "destructive" });
    },
  });

  const generateInviteLinkMutation = useMutation({
    mutationFn: async ({ expertId }: { expertId: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/experts/${expertId}/invite-link`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(data.inviteUrl);
      toast({ title: "Invite link copied to clipboard" });
      setTimeout(() => setCopiedLink(null), 3000);
    },
    onError: () => {
      toast({ title: "Failed to generate invite link", variant: "destructive" });
    },
  });

  const generateRaInviteLinkMutation = useMutation({
    mutationFn: async ({ raId }: { raId: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/ra-invite-link`, { raId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(data.inviteUrl);
      toast({ title: "RA invite link copied to clipboard" });
      setTimeout(() => setCopiedLink(null), 3000);
    },
    onError: () => {
      toast({ title: "Failed to generate RA invite link", variant: "destructive" });
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/activities`, {
        activityType: "note_added",
        description,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setActivityNote("");
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const removeExpertMutation = useMutation({
    mutationFn: (assignmentId: number) => apiRequest("DELETE", `/api/project-experts/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      toast({ title: "Expert removed from project" });
    },
    onError: () => {
      toast({ title: "Failed to remove expert", variant: "destructive" });
    },
  });

  const handleSelectExpert = (expertId: number, checked: boolean) => {
    const newSelected = new Set(selectedExperts);
    if (checked) {
      newSelected.add(expertId);
    } else {
      newSelected.delete(expertId);
    }
    setSelectedExperts(newSelected);
  };

  const handleAttachExperts = () => {
    if (selectedExperts.size === 0) return;
    attachExpertsMutation.mutate(Array.from(selectedExperts));
  };

  const getInvitationStatusIcon = (status?: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "opened":
        return <Eye className="h-4 w-4 text-blue-500" />;
      case "invited":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getInvitationStatusBadge = (status?: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Accepted</Badge>;
      case "declined":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Declined</Badge>;
      case "opened":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Opened</Badge>;
      case "invited":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Invited</Badge>;
      default:
        return <Badge variant="secondary">Not Invited</Badge>;
    }
  };

  const getPipelineStatusBadge = (status?: string) => {
    switch (status) {
      case "interested":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Interested</Badge>;
      case "shortlisted":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Shortlisted</Badge>;
      case "accepted":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Accepted</Badge>;
      case "declined":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Declined</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "expert_invited":
        return <Send className="h-4 w-4 text-blue-500" />;
      case "expert_opened":
        return <Eye className="h-4 w-4 text-purple-500" />;
      case "expert_accepted":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "expert_declined":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "ra_assigned":
        return <UserCheck className="h-4 w-4 text-orange-500" />;
      case "note_added":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "project_created":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (projectLoading) {
    return (
      <div className="p-8">
        <DataTableSkeleton columns={4} rows={3} />
      </div>
    );
  }

  if (!projectDetail) {
    return (
      <div className="p-8">
        <EmptyState
          icon={ClipboardList}
          title="Project not found"
          description="The project you're looking for doesn't exist."
          action={
            <Button onClick={() => setLocation("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/projects")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{projectDetail.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={projectDetail.status} type="project" />
              <span className="text-sm text-muted-foreground">{projectDetail.clientName}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{projectDetail.industry}</span>
              {projectDetail.createdByPm && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">PM: {projectDetail.createdByPm.fullName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="existing-experts" data-testid="tab-existing-experts">
            Existing Experts {projectDetail.internalExperts?.length ? `(${projectDetail.internalExperts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ra-sourcing" data-testid="tab-ra-sourcing">
            RA Sourcing {projectDetail.raSourcedExperts?.length ? `(${projectDetail.raSourcedExperts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            Activity {projectDetail.activities?.length ? `(${projectDetail.activities.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Client Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{projectDetail.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="font-medium">{projectDetail.industry}</p>
                  </div>
                  {projectDetail.clientCompany && (
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">{projectDetail.clientCompany}</p>
                    </div>
                  )}
                  {projectDetail.region && (
                    <div>
                      <p className="text-sm text-muted-foreground">Region</p>
                      <p className="font-medium">{projectDetail.region}</p>
                    </div>
                  )}
                  {projectDetail.clientPocName && (
                    <div>
                      <p className="text-sm text-muted-foreground">POC Name</p>
                      <p className="font-medium">{projectDetail.clientPocName}</p>
                    </div>
                  )}
                  {projectDetail.clientPocEmail && (
                    <div>
                      <p className="text-sm text-muted-foreground">POC Email</p>
                      <p className="font-medium text-sm">{projectDetail.clientPocEmail}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline & Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {projectDetail.startDate
                        ? format(new Date(projectDetail.startDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {projectDetail.dueDate
                        ? format(new Date(projectDetail.dueDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CU Used</p>
                    <p className="font-mono font-medium">{parseFloat(projectDetail.totalCuUsed || "0").toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rate per CU</p>
                    <p className="font-mono font-medium">${parseFloat(projectDetail.cuRatePerCU || "1150").toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-mono text-sm">{format(new Date(projectDetail.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                  {projectDetail.updatedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Updated</p>
                      <p className="font-mono text-sm">{format(new Date(projectDetail.updatedAt), "MMM dd, yyyy")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {projectDetail.projectOverview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectDetail.projectOverview}</p>
              </CardContent>
            </Card>
          )}

          {projectDetail.clientRequestNotes && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Client Request Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectDetail.clientRequestNotes}</p>
              </CardContent>
            </Card>
          )}

          {projectDetail.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detailed Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectDetail.description}</p>
              </CardContent>
            </Card>
          )}

          {projectDetail.vettingQuestions && projectDetail.vettingQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Vetting Questions (Insight Hub)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {projectDetail.vettingQuestions
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((q, index) => (
                      <div key={q.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                        <span className="font-mono text-sm text-muted-foreground w-6 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <p className="text-sm">{q.question}</p>
                          {q.isRequired && (
                            <Badge variant="secondary" className="mt-1 text-xs">Required</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Assigned RAs
              </CardTitle>
              <CardDescription>Research Associates assigned to source experts for this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {projectDetail.assignedRas && projectDetail.assignedRas.length > 0 ? (
                  projectDetail.assignedRas.map((ra) => (
                    <Badge key={ra.id} variant="outline" className="gap-1">
                      <UserCheck className="h-3 w-3" />
                      {ra.fullName}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No RAs assigned yet</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRaIds(projectDetail.assignedRas?.map(r => r.id) || []);
                  setIsAssignRaModalOpen(true);
                }}
                data-testid="button-assign-ras"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Manage RA Assignments
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="existing-experts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Internal Expert Database
              </CardTitle>
              <CardDescription>
                Search and invite experts from the internal database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, company, title, expertise..."
                    value={expertSearchQuery}
                    onChange={(e) => setExpertSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-experts"
                  />
                </div>
                <Input
                  placeholder="Country/Timezone"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="w-full sm:w-40"
                  data-testid="input-country-filter"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Min Rate"
                    type="number"
                    value={minRate}
                    onChange={(e) => setMinRate(e.target.value)}
                    className="w-24"
                    data-testid="input-min-rate"
                  />
                  <Input
                    placeholder="Max Rate"
                    type="number"
                    value={maxRate}
                    onChange={(e) => setMaxRate(e.target.value)}
                    className="w-24"
                    data-testid="input-max-rate"
                  />
                </div>
              </div>

              {selectedExperts.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{selectedExperts.size} expert(s) selected</span>
                  <Button
                    onClick={handleAttachExperts}
                    disabled={attachExpertsMutation.isPending}
                    data-testid="button-attach-experts"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {attachExpertsMutation.isPending ? "Attaching..." : "Add to Project"}
                  </Button>
                </div>
              )}

              {searchLoading ? (
                <DataTableSkeleton columns={6} rows={5} />
              ) : !expertsToShow || expertsToShow.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No experts found"
                  description="Try adjusting your search criteria or add experts first."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Company</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Country</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Rate</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expertsToShow.map((expert) => {
                        const isAssigned = assignedExpertIds.has(expert.id);
                        return (
                          <TableRow key={expert.id} data-testid={`row-expert-${expert.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedExperts.has(expert.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectExpert(expert.id, checked as boolean)
                                }
                                disabled={isAssigned}
                                data-testid={`checkbox-expert-${expert.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{expert.name}</p>
                                <p className="text-xs text-muted-foreground">{expert.jobTitle}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{expert.company || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {expert.country || expert.timezone || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              ${parseFloat(expert.hourlyRate).toFixed(0)}/hr
                            </TableCell>
                            <TableCell>
                              {isAssigned ? (
                                <Badge variant="secondary">In Project</Badge>
                              ) : (
                                <StatusBadge status={expert.status} type="expert" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Internal Experts Pipeline
              </CardTitle>
              <CardDescription>
                Experts from internal database assigned to this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!projectDetail.internalExperts || projectDetail.internalExperts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No internal experts yet"
                  description="Use the search above to add experts from your database."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Invitation Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Pipeline</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">VQ Answers</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Last Activity</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectDetail.internalExperts.map((pe) => (
                        <TableRow key={pe.id} data-testid={`row-internal-expert-${pe.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pe.expert?.name || `Expert #${pe.expertId}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {pe.expert?.email} {pe.expert?.jobTitle ? `• ${pe.expert.jobTitle}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getInvitationStatusIcon(pe.invitationStatus)}
                              {getInvitationStatusBadge(pe.invitationStatus)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getPipelineStatusBadge(pe.pipelineStatus)}
                          </TableCell>
                          <TableCell>
                            {pe.vqAnswers && Array.isArray(pe.vqAnswers) && pe.vqAnswers.length > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                {pe.vqAnswers.length} answers
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {pe.lastActivityAt
                              ? formatDistanceToNow(new Date(pe.lastActivityAt), { addSuffix: true })
                              : pe.invitedAt
                              ? formatDistanceToNow(new Date(pe.invitedAt), { addSuffix: true })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {pe.invitationStatus !== "accepted" && pe.invitationStatus !== "declined" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => generateInviteLinkMutation.mutate({ expertId: pe.expertId })}
                                  disabled={generateInviteLinkMutation.isPending}
                                  title="Generate and copy invite link"
                                  data-testid={`button-invite-link-${pe.id}`}
                                >
                                  {copiedLink?.includes(String(pe.expertId)) ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => removeExpertMutation.mutate(pe.id)}
                                    className="text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Remove from project
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ra-sourcing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Assigned RAs & Invite Links
                  </CardTitle>
                  <CardDescription>
                    RAs can use their personalized invite links to onboard new experts
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRaIds(projectDetail.assignedRas?.map(r => r.id) || []);
                    setIsAssignRaModalOpen(true);
                  }}
                  data-testid="button-manage-ras"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage RAs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!projectDetail.assignedRas || projectDetail.assignedRas.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="No RAs assigned"
                  description="Assign RAs to enable external expert sourcing."
                />
              ) : (
                <div className="space-y-3">
                  {projectDetail.assignedRas.map((ra) => (
                    <div key={ra.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{ra.fullName}</p>
                          <p className="text-xs text-muted-foreground">{ra.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateRaInviteLinkMutation.mutate({ raId: ra.id })}
                        disabled={generateRaInviteLinkMutation.isPending}
                        data-testid={`button-ra-invite-${ra.id}`}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy Invite Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                RA-Sourced Experts Pipeline
              </CardTitle>
              <CardDescription>
                Experts sourced by RAs through external channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!projectDetail.raSourcedExperts || projectDetail.raSourcedExperts.length === 0 ? (
                <EmptyState
                  icon={ExternalLink}
                  title="No RA-sourced experts yet"
                  description="Experts onboarded through RA invite links will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Sourced By</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Pipeline Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">VQ Answers</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Onboarded</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectDetail.raSourcedExperts.map((pe) => (
                        <TableRow key={pe.id} data-testid={`row-ra-expert-${pe.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pe.expert?.name || `Expert #${pe.expertId}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {pe.expert?.email} {pe.expert?.jobTitle ? `• ${pe.expert.jobTitle}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {pe.sourcedByRa ? (
                              <Badge variant="outline" className="gap-1">
                                <UserCheck className="h-3 w-3" />
                                {pe.sourcedByRa.fullName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getPipelineStatusBadge(pe.pipelineStatus)}
                          </TableCell>
                          <TableCell>
                            {pe.vqAnswers && Array.isArray(pe.vqAnswers) && pe.vqAnswers.length > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                {pe.vqAnswers.length} answers
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {pe.respondedAt
                              ? formatDistanceToNow(new Date(pe.respondedAt), { addSuffix: true })
                              : pe.invitedAt
                              ? formatDistanceToNow(new Date(pe.invitedAt), { addSuffix: true })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => removeExpertMutation.mutate(pe.id)}
                                  className="text-destructive"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Remove from project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Add Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note or update about this project..."
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-activity-note"
                />
                <Button
                  onClick={() => addActivityMutation.mutate(activityNote)}
                  disabled={!activityNote.trim() || addActivityMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
              <CardDescription>
                History of all activities and updates for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!projectDetail.activities || projectDetail.activities.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Activities will appear here as the project progresses."
                />
              ) : (
                <div className="space-y-4">
                  {projectDetail.activities
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((activity) => (
                      <div key={activity.id} className="flex gap-3 p-3 rounded-lg border">
                        <div className="flex-shrink-0 mt-0.5">
                          {getActivityIcon(activity.activityType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(activity.createdAt), "MMM dd, yyyy 'at' HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAssignRaModalOpen} onOpenChange={setIsAssignRaModalOpen}>
        <DialogContent className="max-w-md" aria-describedby="assign-ra-description">
          <DialogHeader>
            <DialogTitle>Assign RAs to Project</DialogTitle>
            <DialogDescription id="assign-ra-description">
              Select RAs who will source experts for this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {allRAs?.map((ra) => (
              <div
                key={ra.id}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover-elevate"
                onClick={() => {
                  setSelectedRaIds((prev) =>
                    prev.includes(ra.id)
                      ? prev.filter((id) => id !== ra.id)
                      : [...prev, ra.id]
                  );
                }}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedRaIds.includes(ra.id)}
                    onCheckedChange={(checked) => {
                      setSelectedRaIds((prev) =>
                        checked
                          ? [...prev, ra.id]
                          : prev.filter((id) => id !== ra.id)
                      );
                    }}
                    data-testid={`checkbox-ra-${ra.id}`}
                  />
                  <div>
                    <p className="font-medium">{ra.fullName}</p>
                    <p className="text-xs text-muted-foreground">{ra.email}</p>
                  </div>
                </div>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground text-center py-4">
                No RAs available
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignRaModalOpen(false)}
              data-testid="button-cancel-assign-ra"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignRasMutation.mutate(selectedRaIds)}
              disabled={assignRasMutation.isPending}
              data-testid="button-confirm-assign-ra"
            >
              {assignRasMutation.isPending ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
