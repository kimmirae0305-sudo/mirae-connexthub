import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Plus, Trash2, Search, Briefcase, Filter, Eye, X, FolderKanban } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, InsertProject, ClientOrganization, VettingQuestion } from "@shared/schema";

const vettingQuestionSchema = z.object({
  question: z.string().min(1, "Question is required"),
});

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  projectOverview: z.string().optional(),
  clientOrganizationId: z.number().optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientPocName: z.string().optional(),
  clientPocEmail: z.string().email().optional().or(z.literal("")),
  description: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  status: z.string().default("new"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  vettingQuestions: z.array(vettingQuestionSchema).optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Manufacturing",
  "Energy",
  "Retail",
  "Consulting",
  "Legal",
  "Real Estate",
  "Education",
  "Pharmaceuticals",
  "Telecommunications",
  "Automotive",
  "Aerospace",
  "Agriculture",
  "Other",
];

const statuses = [
  { value: "new", label: "New" },
  { value: "sourcing", label: "Sourcing" },
  { value: "pending_client_review", label: "Client Review" },
  { value: "client_selected", label: "Client Selected" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Projects() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  
  // Check if user is RA (Research Associate)
  const isRA = user && normalizeRole(user.role) === "ra";

  const getProjectDetailPath = (projectId: number) =>
    location.startsWith("/app/") ? `/app/projects/${projectId}` : `/projects/${projectId}`;

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clientOrganizations } = useQuery<ClientOrganization[]>({
    queryKey: ["/api/client-organizations"],
  });

  const { data: existingVettingQuestions } = useQuery<VettingQuestion[]>({
    queryKey: ["/api/vetting-questions", editingProject?.id],
    enabled: !!editingProject,
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      projectOverview: "",
      clientName: "",
      clientPocName: "",
      clientPocEmail: "",
      description: "",
      industry: "",
      status: "new",
      startDate: "",
      endDate: "",
      vettingQuestions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "vettingQuestions",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormData & { id: number }) => {
      const { vettingQuestions, id, ...projectData } = data;
      const projectPayload: Partial<InsertProject> = {
        ...projectData,
        projectOverview: projectData.projectOverview || null,
        clientOrganizationId: projectData.clientOrganizationId || null,
        clientPocName: projectData.clientPocName || null,
        clientPocEmail: projectData.clientPocEmail || null,
        description: projectData.description || null,
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
      };
      
      await apiRequest("PATCH", `/api/projects/${id}`, projectPayload);
      
      if (existingVettingQuestions) {
        for (const q of existingVettingQuestions) {
          await apiRequest("DELETE", `/api/vetting-questions/${q.id}`);
        }
      }
      
      if (vettingQuestions && vettingQuestions.length > 0) {
        for (let i = 0; i < vettingQuestions.length; i++) {
          await apiRequest("POST", "/api/vetting-questions", {
            projectId: id,
            question: vettingQuestions[i].question,
            orderIndex: i,
            isRequired: true,
          });
        }
      }
      
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vetting-questions"] });
      setIsDialogOpen(false);
      setEditingProject(null);
      form.reset();
      toast({ title: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDeletingProject(null);
      toast({ title: "Project deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (project: Project) => {
    setEditingProject(project);
    form.reset({
      name: project.name,
      projectOverview: project.projectOverview || "",
      clientOrganizationId: project.clientOrganizationId || undefined,
      clientName: project.clientName,
      clientPocName: project.clientPocName || "",
      clientPocEmail: project.clientPocEmail || "",
      description: project.description || "",
      industry: project.industry,
      status: project.status,
      startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
      endDate: project.endDate ? format(new Date(project.endDate), "yyyy-MM-dd") : "",
      vettingQuestions: [],
    });
    setIsDialogOpen(true);
  };

  const loadExistingQuestions = () => {
    if (existingVettingQuestions && existingVettingQuestions.length > 0) {
      form.setValue('vettingQuestions', existingVettingQuestions.map(q => ({ question: q.question })));
    }
  };

  const onSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateMutation.mutate({ ...data, id: editingProject.id });
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {isRA ? "My Projects" : "Projects"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRA 
              ? "View and manage projects you're assigned to."
              : "Manage project requests and track their progress through the workflow."
            }
          </p>
        </div>
        {!isRA && (
          <Button onClick={() => setLocation("/projects/new")} className="gap-2" data-testid="button-add-project">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === "new").length || 0}</div>
            <p className="text-xs text-muted-foreground">New Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === "sourcing").length || 0}</div>
            <p className="text-xs text-muted-foreground">Sourcing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === "pending_client_review").length || 0}</div>
            <p className="text-xs text-muted-foreground">Client Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === "completed").length || 0}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">
              {isRA ? "My Assigned Projects" : "All Projects"}
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:w-64"
                  data-testid="input-search-projects"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={isRA ? 6 : 7} rows={5} />
          ) : filteredProjects?.length === 0 ? (
            <EmptyState
              icon={isRA ? FolderKanban : Briefcase}
              title={isRA ? "No projects assigned yet" : "No projects found"}
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : isRA
                    ? "Once you're assigned to a project, it will appear here."
                    : "Create your first project to get started."
              }
              action={
                !isRA && !searchQuery && statusFilter === "all" ? (
                  <Button onClick={() => setLocation("/projects/new")} className="gap-2" data-testid="button-create-empty-project">
                    <Plus className="h-4 w-4" /> Create Project
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Industry</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                    {!isRA && <TableHead className="text-xs font-semibold uppercase">CU Used</TableHead>}
                    <TableHead className="text-xs font-semibold uppercase">Created</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects?.map((project) => (
                    <TableRow key={project.id} className="hover-elevate cursor-pointer" data-testid={`row-project-${project.id}`}>
                      <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))}>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          {project.clientPocName && (
                            <p className="text-xs text-muted-foreground">POC: {project.clientPocName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))} className="text-muted-foreground">{project.clientName}</TableCell>
                      <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))} className="text-muted-foreground">{project.industry}</TableCell>
                      <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))}>
                        <StatusBadge status={project.status} type="project" />
                      </TableCell>
                      {!isRA && (
                        <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))} className="font-mono text-sm">
                          {parseFloat(project.totalCuUsed || "0").toFixed(1)}
                        </TableCell>
                      )}
                      <TableCell onClick={() => setLocation(getProjectDetailPath(project.id))} className="font-mono text-xs text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(getProjectDetailPath(project.id))}
                            data-testid={`button-view-project-${project.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!isRA && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingProject(project)}
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This action cannot be
              undone and will also remove all associated vetting questions, expert assignments, and call records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProject && deleteMutation.mutate(deletingProject.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
