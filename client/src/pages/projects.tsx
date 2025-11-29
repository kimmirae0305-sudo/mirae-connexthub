import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Briefcase, Filter, Eye, X, FolderKanban } from "lucide-react";
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
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  
  // Check if user is RA (Research Associate)
  const isRA = user && normalizeRole(user.role) === "ra";

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

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { vettingQuestions, ...projectData } = data;
      const projectPayload: InsertProject = {
        ...projectData,
        projectOverview: projectData.projectOverview || null,
        clientOrganizationId: projectData.clientOrganizationId || null,
        clientPocName: projectData.clientPocName || null,
        clientPocEmail: projectData.clientPocEmail || null,
        description: projectData.description || null,
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
      };
      
      const project = await apiRequest("POST", "/api/projects", projectPayload);
      const projectResult = await project.json();
      
      if (vettingQuestions && vettingQuestions.length > 0) {
        for (let i = 0; i < vettingQuestions.length; i++) {
          await apiRequest("POST", "/api/vetting-questions", {
            projectId: projectResult.id,
            question: vettingQuestions[i].question,
            orderIndex: i,
            isRequired: true,
          });
        }
      }
      
      return projectResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vetting-questions"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
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

  const handleOpenDialog = (project?: Project) => {
    if (project) {
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
    } else {
      setEditingProject(null);
      form.reset({
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
      });
    }
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
    } else {
      createMutation.mutate(data);
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
          <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-project">
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
                  <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-create-empty-project">
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
                      <TableCell onClick={() => setLocation(`/projects/${project.id}`)}>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          {project.clientPocName && (
                            <p className="text-xs text-muted-foreground">POC: {project.clientPocName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setLocation(`/projects/${project.id}`)} className="text-muted-foreground">{project.clientName}</TableCell>
                      <TableCell onClick={() => setLocation(`/projects/${project.id}`)} className="text-muted-foreground">{project.industry}</TableCell>
                      <TableCell onClick={() => setLocation(`/projects/${project.id}`)}>
                        <StatusBadge status={project.status} type="project" />
                      </TableCell>
                      {!isRA && (
                        <TableCell onClick={() => setLocation(`/projects/${project.id}`)} className="font-mono text-sm">
                          {parseFloat(project.totalCuUsed || "0").toFixed(1)}
                        </TableCell>
                      )}
                      <TableCell onClick={() => setLocation(`/projects/${project.id}`)} className="font-mono text-xs text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/projects/${project.id}`)}
                            data-testid={`button-view-project-${project.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!isRA && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(project)}
                                data-testid={`button-edit-project-${project.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingProject(project)}
                                data-testid={`button-delete-project-${project.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingProject(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update the project details below."
                : "Fill in the details to create a new project request."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} data-testid="input-client-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientOrganizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Organization</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-org">
                            <SelectValue placeholder="Select organization (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientOrganizations?.map((org) => (
                            <SelectItem key={org.id} value={org.id.toString()}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientPocName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client POC Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Point of contact name" {...field} data-testid="input-poc-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientPocEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client POC Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="poc@company.com" {...field} data-testid="input-poc-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {industries.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="projectOverview"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Overview</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief overview of the project..."
                        className="resize-none"
                        rows={2}
                        {...field}
                        data-testid="input-project-overview"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detailed Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter detailed project description"
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-project-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Vetting Questions</h3>
                    <p className="text-xs text-muted-foreground">
                      Add screening questions for experts to answer
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {editingProject && existingVettingQuestions && existingVettingQuestions.length > 0 && fields.length === 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadExistingQuestions}
                        data-testid="button-load-questions"
                      >
                        Load Existing ({existingVettingQuestions.length})
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ question: "" })}
                      data-testid="button-add-question"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Question
                    </Button>
                  </div>
                </div>

                {fields.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                    No vetting questions added yet. Click "Add Question" to add screening questions.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start">
                        <div className="flex-shrink-0 w-6 h-8 flex items-center justify-center text-xs text-muted-foreground font-mono">
                          {index + 1}.
                        </div>
                        <FormField
                          control={form.control}
                          name={`vettingQuestions.${index}.question`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Textarea
                                  placeholder="Enter your vetting question..."
                                  className="resize-none min-h-[60px]"
                                  {...field}
                                  data-testid={`input-vetting-question-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="flex-shrink-0"
                          data-testid={`button-remove-question-${index}`}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-project"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingProject
                      ? "Update Project"
                      : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
