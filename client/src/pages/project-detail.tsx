import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, Expert, VettingQuestion, ProjectExpert } from "@shared/schema";

interface ProjectExpertWithExpert extends ProjectExpert {
  expert?: Expert;
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
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set());
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteChannel, setInviteChannel] = useState<"email" | "whatsapp">("email");

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: vettingQuestions } = useQuery<VettingQuestion[]>({
    queryKey: ["/api/vetting-questions", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/vetting-questions?projectId=${projectId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch vetting questions");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: projectExperts, isLoading: assignmentsLoading } = useQuery<ProjectExpert[]>({
    queryKey: ["/api/project-experts", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/project-experts?projectId=${projectId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch project experts");
      return res.json();
    },
    enabled: !!projectId,
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

  const assignedExpertIds = new Set(projectExperts?.map((pe) => pe.expertId) || []);

  const attachExpertsMutation = useMutation({
    mutationFn: async (expertIds: number[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/experts/bulk`, {
        expertIds,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts", projectId] });
      setSelectedExperts(new Set());
      toast({ title: data.message || "Experts attached successfully" });
    },
    onError: () => {
      toast({ title: "Failed to attach experts", variant: "destructive" });
    },
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: async ({ projectExpertIds, channel }: { projectExpertIds: number[]; channel: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/invitations/send`, {
        projectExpertIds,
        channel,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts", projectId] });
      setSelectedAssignments(new Set());
      setIsInviteModalOpen(false);
      toast({ title: data.message || "Invitations sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send invitations", variant: "destructive" });
    },
  });

  const removeExpertMutation = useMutation({
    mutationFn: (assignmentId: number) => apiRequest("DELETE", `/api/project-experts/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts", projectId] });
      toast({ title: "Expert removed from project" });
    },
    onError: () => {
      toast({ title: "Failed to remove expert", variant: "destructive" });
    },
  });

  const getExpertById = (expertId: number): Expert | undefined => {
    return allExperts?.find((e) => e.id === expertId);
  };

  const handleSelectExpert = (expertId: number, checked: boolean) => {
    const newSelected = new Set(selectedExperts);
    if (checked) {
      newSelected.add(expertId);
    } else {
      newSelected.delete(expertId);
    }
    setSelectedExperts(newSelected);
  };

  const handleSelectAssignment = (assignmentId: number, checked: boolean) => {
    const newSelected = new Set(selectedAssignments);
    if (checked) {
      newSelected.add(assignmentId);
    } else {
      newSelected.delete(assignmentId);
    }
    setSelectedAssignments(newSelected);
  };

  const handleAttachExperts = () => {
    if (selectedExperts.size === 0) return;
    attachExpertsMutation.mutate(Array.from(selectedExperts));
  };

  const handleSendInvitations = () => {
    if (selectedAssignments.size === 0) return;
    sendInvitationsMutation.mutate({
      projectExpertIds: Array.from(selectedAssignments),
      channel: inviteChannel,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "invited":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (projectLoading) {
    return (
      <div className="p-8">
        <DataTableSkeleton columns={4} rows={3} />
      </div>
    );
  }

  if (!project) {
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
            <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={project.status} type="project" />
              <span className="text-sm text-muted-foreground">{project.clientName}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{project.industry}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="vetting" data-testid="tab-vetting">
            Vetting Questions {vettingQuestions?.length ? `(${vettingQuestions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">Expert Search</TabsTrigger>
          <TabsTrigger value="attached" data-testid="tab-attached">
            Attached Experts {projectExperts?.length ? `(${projectExperts.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{project.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="font-medium">{project.industry}</p>
                  </div>
                  {project.clientPocName && (
                    <div>
                      <p className="text-sm text-muted-foreground">POC Name</p>
                      <p className="font-medium">{project.clientPocName}</p>
                    </div>
                  )}
                  {project.clientPocEmail && (
                    <div>
                      <p className="text-sm text-muted-foreground">POC Email</p>
                      <p className="font-medium">{project.clientPocEmail}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">CU Used</p>
                    <p className="font-mono font-medium">{parseFloat(project.totalCuUsed || "0").toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-mono text-sm">{format(new Date(project.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {project.startDate
                        ? format(new Date(project.startDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {project.endDate
                        ? format(new Date(project.endDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {project.projectOverview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{project.projectOverview}</p>
              </CardContent>
            </Card>
          )}

          {project.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detailed Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vetting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Vetting Questions
              </CardTitle>
              <CardDescription>
                Questions that experts will answer when accepting this project invitation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!vettingQuestions || vettingQuestions.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No vetting questions"
                  description="Add vetting questions when editing the project."
                />
              ) : (
                <div className="space-y-4">
                  {vettingQuestions
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Expert Search & Attach
              </CardTitle>
              <CardDescription>
                Search for experts and attach them to this project
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
                    {attachExpertsMutation.isPending ? "Attaching..." : "Attach to Project"}
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
                                <Badge variant="secondary">Already Attached</Badge>
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
        </TabsContent>

        <TabsContent value="attached" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Attached Experts
                  </CardTitle>
                  <CardDescription>
                    Experts assigned to this project and their invitation status
                  </CardDescription>
                </div>
                {selectedAssignments.size > 0 && (
                  <Button
                    onClick={() => setIsInviteModalOpen(true)}
                    data-testid="button-open-invite-modal"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitations ({selectedAssignments.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <DataTableSkeleton columns={6} rows={3} />
              ) : !projectExperts || projectExperts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No experts attached"
                  description="Search and attach experts from the Expert Search tab."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Invited At</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Responded</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">VQ Answers</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectExperts.map((pe) => {
                        const expert = getExpertById(pe.expertId);
                        const canInvite = pe.status === "assigned";
                        return (
                          <TableRow key={pe.id} data-testid={`row-assignment-${pe.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedAssignments.has(pe.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectAssignment(pe.id, checked as boolean)
                                }
                                disabled={!canInvite}
                                data-testid={`checkbox-assignment-${pe.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{expert?.name || `Expert #${pe.expertId}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {expert?.email || ""} {expert?.jobTitle ? `• ${expert.jobTitle}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(pe.status)}
                                <StatusBadge status={pe.status} type="assignment" />
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {pe.invitedAt
                                ? format(new Date(pe.invitedAt), "MMM dd, HH:mm")
                                : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {pe.respondedAt
                                ? format(new Date(pe.respondedAt), "MMM dd, HH:mm")
                                : "-"}
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
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExpertMutation.mutate(pe.id)}
                                disabled={removeExpertMutation.isPending}
                                data-testid={`button-remove-assignment-${pe.id}`}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
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
        </TabsContent>
      </Tabs>

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invitations</DialogTitle>
            <DialogDescription>
              Send project invitations to selected experts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Project</p>
              <p className="font-medium">{project.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Number of Experts</p>
              <p className="font-medium">{selectedAssignments.size}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Send via</p>
              <Select
                value={inviteChannel}
                onValueChange={(v) => setInviteChannel(v as "email" | "whatsapp")}
              >
                <SelectTrigger data-testid="select-invite-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Invitation Preview</p>
              <p className="text-muted-foreground">
                Each expert will receive a unique invitation link to view the project details
                and respond to {vettingQuestions?.length || 0} vetting question(s).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteModalOpen(false)}
              data-testid="button-cancel-invite"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              disabled={sendInvitationsMutation.isPending}
              data-testid="button-send-invitations"
            >
              {sendInvitationsMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitations
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
