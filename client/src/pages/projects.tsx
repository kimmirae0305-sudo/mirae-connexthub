import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Briefcase, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, InsertProject } from "@shared/schema";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  description: z.string().optional(),
  industry: z.string().min(1, "Industry is required"),
  status: z.string().default("pending"),
  budget: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
  "Other",
];

const statuses = ["pending", "active", "completed", "archived"];

export default function Projects() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      clientName: "",
      description: "",
      industry: "",
      status: "pending",
      budget: "",
      startDate: "",
      endDate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertProject) => apiRequest("POST", "/api/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertProject & { id: number }) =>
      apiRequest("PATCH", `/api/projects/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
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
        clientName: project.clientName,
        description: project.description || "",
        industry: project.industry,
        status: project.status,
        budget: project.budget?.toString() || "",
        startDate: project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : "",
        endDate: project.endDate ? format(new Date(project.endDate), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingProject(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    const projectData: InsertProject = {
      ...data,
      budget: data.budget || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    };

    if (editingProject) {
      updateMutation.mutate({ ...projectData, id: editingProject.id });
    } else {
      createMutation.mutate(projectData);
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your project requests and track their progress.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-project">
          <Plus className="h-4 w-4" /> Add Project
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">All Projects</CardTitle>
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
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DataTableSkeleton columns={6} rows={5} />
          ) : filteredProjects?.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No projects found"
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create your first project to get started."
              }
              action={
                !searchQuery && statusFilter === "all" ? (
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
                    <TableHead className="text-xs font-semibold uppercase">Project Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Industry</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Created</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects?.map((project) => (
                    <TableRow key={project.id} className="hover-elevate" data-testid={`row-project-${project.id}`}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{project.industry}</TableCell>
                      <TableCell>
                        <StatusBadge status={project.status} type="project" />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter project description"
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

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-budget"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              undone and will also remove all associated vetting questions and expert assignments.
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
