import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, UserPlus, Trash2, Search, Send, Check, X, Link, Copy, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Project, Expert, ProjectExpert, InsertProjectExpert, ExpertInvitationLink } from "@shared/schema";

export default function Assignments() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteLinkDialogOpen, setIsInviteLinkDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [removingAssignment, setRemovingAssignment] = useState<ProjectExpert | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedExpertId, setSelectedExpertId] = useState<number | null>(null);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts, isLoading: expertsLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<ProjectExpert[]>({
    queryKey: ["/api/project-experts"],
  });

  const { data: invitationLinks } = useQuery<ExpertInvitationLink[]>({
    queryKey: ["/api/invitation-links"],
  });

  const assignMutation = useMutation({
    mutationFn: (data: InsertProjectExpert) =>
      apiRequest("POST", "/api/project-experts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts"] });
      setIsDialogOpen(false);
      setNotes("");
      setSelectedExpertId(null);
      toast({ title: "Expert assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign expert", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/project-experts/${id}/invite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts"] });
      toast({ title: "Invitation sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    },
  });

  const selectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/project-experts/${id}/select`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts"] });
      toast({ title: "Expert marked as client selected" });
    },
    onError: () => {
      toast({ title: "Failed to select expert", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/project-experts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts"] });
      setRemovingAssignment(null);
      toast({ title: "Expert removed from project" });
    },
    onError: () => {
      toast({ title: "Failed to remove expert", variant: "destructive" });
    },
  });

  const createInviteLinkMutation = useMutation({
    mutationFn: async (data: { projectId?: number; recruitedBy: string }) => {
      const res = await apiRequest("POST", "/api/invitation-links", data);
      return res.json() as Promise<ExpertInvitationLink>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitation-links"] });
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      setNewInviteLink(`${baseUrl}/register/${data.token}`);
      toast({ title: "Invitation link created" });
    },
    onError: () => {
      toast({ title: "Failed to create invitation link", variant: "destructive" });
    },
  });

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const projectAssignments = assignments?.filter((a) => a.projectId === selectedProjectId);
  const assignedExpertIds = new Set(projectAssignments?.map((a) => a.expertId));

  const availableExperts = experts?.filter(
    (e) =>
      !assignedExpertIds.has(e.id) &&
      (e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.expertise.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getExpert = (expertId: number) => experts?.find((e) => e.id === expertId);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAssign = () => {
    if (!selectedProjectId || !selectedExpertId) return;
    assignMutation.mutate({
      projectId: selectedProjectId,
      expertId: selectedExpertId,
      status: "assigned",
      notes: notes || null,
    });
  };

  const handleCreateInviteLink = () => {
    createInviteLinkMutation.mutate({
      projectId: selectedProjectId || undefined,
      recruitedBy: "pm@mirae.com",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Link copied to clipboard" });
  };

  const isLoading = projectsLoading || expertsLoading || assignmentsLoading;

  const assignedCount = projectAssignments?.filter(a => a.status === "assigned").length || 0;
  const invitedCount = projectAssignments?.filter(a => a.status === "invited").length || 0;
  const acceptedCount = projectAssignments?.filter(a => a.status === "accepted").length || 0;
  const selectedCount = projectAssignments?.filter(a => a.status === "client_selected").length || 0;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Expert Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Manage expert assignments and invitations for projects.
          </p>
        </div>
        <Button 
          onClick={() => setIsInviteLinkDialogOpen(true)} 
          variant="outline" 
          className="gap-2"
          data-testid="button-create-invite-link"
        >
          <Link className="h-4 w-4" /> Create Invite Link
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={selectedProjectId?.toString() || ""}
          onValueChange={(val) => setSelectedProjectId(val ? Number(val) : null)}
        >
          <SelectTrigger className="w-72" data-testid="select-assignment-project">
            <SelectValue placeholder="Select a project to manage" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : !selectedProjectId ? (
        <EmptyState
          icon={UserPlus}
          title="Select a project"
          description="Choose a project from the dropdown to manage expert assignments."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{assignedCount}</div>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{invitedCount}</div>
                <p className="text-xs text-muted-foreground">Invited</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{acceptedCount}</div>
                <p className="text-xs text-muted-foreground">Accepted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{selectedCount}</div>
                <p className="text-xs text-muted-foreground">Client Selected</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base font-medium">Assigned Experts</CardTitle>
                  <CardDescription>Manage expert invitations and status</CardDescription>
                </div>
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                  {projectAssignments?.length || 0} total
                </Badge>
              </CardHeader>
              <CardContent>
                {!projectAssignments?.length ? (
                  <EmptyState
                    icon={UserPlus}
                    title="No experts assigned"
                    description="Add experts from the available pool."
                  />
                ) : (
                  <div className="space-y-3">
                    {projectAssignments.map((assignment) => {
                      const expert = getExpert(assignment.expertId);
                      if (!expert) return null;
                      return (
                        <div
                          key={assignment.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
                          data-testid={`assigned-expert-${expert.id}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-border">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(expert.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{expert.name}</p>
                                <p className="text-sm text-muted-foreground">{expert.expertise}</p>
                              </div>
                            </div>
                            <StatusBadge status={assignment.status} type="assignment" />
                          </div>
                          
                          {assignment.availabilityNote && (
                            <div className="flex items-start gap-2 rounded bg-muted/50 p-2 text-sm">
                              <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <span>{assignment.availabilityNote}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {assignment.status === "assigned" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => inviteMutation.mutate(assignment.id)}
                                disabled={inviteMutation.isPending}
                                className="gap-1"
                                data-testid={`button-invite-${expert.id}`}
                              >
                                <Send className="h-3 w-3" /> Send Invite
                              </Button>
                            )}
                            {assignment.status === "accepted" && (
                              <Button
                                size="sm"
                                onClick={() => selectMutation.mutate(assignment.id)}
                                disabled={selectMutation.isPending}
                                className="gap-1"
                                data-testid={`button-select-${expert.id}`}
                              >
                                <Check className="h-3 w-3" /> Mark Client Selected
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemovingAssignment(assignment)}
                              className="text-destructive"
                              data-testid={`button-remove-expert-${expert.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base font-medium">Available Experts</CardTitle>
                  <CardDescription>Add experts to this project</CardDescription>
                </div>
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                  {availableExperts?.length || 0} available
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search experts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-available-experts"
                    />
                  </div>
                </div>
                {!availableExperts?.length ? (
                  <EmptyState
                    icon={UserPlus}
                    title={searchQuery ? "No experts found" : "All experts assigned"}
                    description={
                      searchQuery
                        ? "Try adjusting your search."
                        : "All available experts are already assigned to this project."
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {availableExperts.map((expert) => (
                      <div
                        key={expert.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4 hover-elevate"
                        data-testid={`available-expert-${expert.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarFallback className="bg-muted">
                              {getInitials(expert.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{expert.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{expert.expertise}</span>
                              <span className="text-muted-foreground">·</span>
                              <StatusBadge status={expert.status} type="expert" />
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedExpertId(expert.id);
                            setIsDialogOpen(true);
                          }}
                          disabled={assignMutation.isPending}
                          className="gap-1"
                          data-testid={`button-assign-expert-${expert.id}`}
                        >
                          <Plus className="h-4 w-4" /> Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Expert to Project</DialogTitle>
            <DialogDescription>
              Add notes about this assignment for "{selectedProject?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedExpertId && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(getExpert(selectedExpertId)?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getExpert(selectedExpertId)?.name}</p>
                  <p className="text-sm text-muted-foreground">{getExpert(selectedExpertId)?.expertise}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignment Notes (optional)</label>
              <Textarea
                placeholder="Add any notes about this assignment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-assignment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedExpertId(null);
                setNotes("");
              }}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Expert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteLinkDialogOpen} onOpenChange={setIsInviteLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Expert Invitation Link</DialogTitle>
            <DialogDescription>
              Generate a unique registration link to invite new experts to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {newInviteLink ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Share this link with the expert to register:
                </p>
                <div className="flex items-center gap-2">
                  <Input value={newInviteLink} readOnly className="flex-1 font-mono text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(newInviteLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {selectedProjectId
                    ? `This link will be associated with "${selectedProject?.name}".`
                    : "This will create a general invitation link."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsInviteLinkDialogOpen(false);
                setNewInviteLink(null);
              }}
            >
              Close
            </Button>
            {!newInviteLink && (
              <Button
                onClick={handleCreateInviteLink}
                disabled={createInviteLinkMutation.isPending}
              >
                {createInviteLinkMutation.isPending ? "Creating..." : "Generate Link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removingAssignment} onOpenChange={() => setRemovingAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Expert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this expert from the project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingAssignment && removeMutation.mutate(removingAssignment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
