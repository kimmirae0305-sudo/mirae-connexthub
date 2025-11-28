import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, UserPlus, ArrowRight, Trash2, Search, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Project, Expert, ProjectExpert, InsertProjectExpert } from "@shared/schema";

export default function Assignments() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [removingAssignment, setRemovingAssignment] = useState<ProjectExpert | null>(null);
  const [notes, setNotes] = useState("");

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts, isLoading: expertsLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<ProjectExpert[]>({
    queryKey: ["/api/project-experts"],
  });

  const assignMutation = useMutation({
    mutationFn: (data: InsertProjectExpert) =>
      apiRequest("POST", "/api/project-experts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-experts"] });
      setIsDialogOpen(false);
      setNotes("");
      toast({ title: "Expert assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign expert", variant: "destructive" });
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

  const handleAssign = (expertId: number) => {
    if (!selectedProjectId) return;
    assignMutation.mutate({
      projectId: selectedProjectId,
      expertId,
      status: "assigned",
      notes: notes || null,
    });
  };

  const isLoading = projectsLoading || expertsLoading || assignmentsLoading;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Project Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Assign experts to your projects.
          </p>
        </div>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle className="text-base font-medium">Assigned Experts</CardTitle>
              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                {projectAssignments?.length || 0} assigned
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
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4"
                        data-testid={`assigned-expert-${expert.id}`}
                      >
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
                        <div className="flex items-center gap-2">
                          <StatusBadge status={assignment.status} type="assignment" />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemovingAssignment(assignment)}
                            data-testid={`button-remove-expert-${expert.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
              <CardTitle className="text-base font-medium">Available Experts</CardTitle>
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
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Expert to Project</DialogTitle>
            <DialogDescription>
              Select an expert to assign to "{selectedProject?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Expert</label>
              <Select
                onValueChange={(val) => {
                  handleAssign(Number(val));
                }}
              >
                <SelectTrigger data-testid="select-expert-to-assign">
                  <SelectValue placeholder="Choose an expert" />
                </SelectTrigger>
                <SelectContent>
                  {availableExperts?.map((expert) => (
                    <SelectItem key={expert.id} value={expert.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{expert.name}</span>
                        <span className="text-muted-foreground">- {expert.expertise}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
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
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
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
