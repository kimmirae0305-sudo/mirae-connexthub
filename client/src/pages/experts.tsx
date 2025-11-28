import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Users, Mail, Phone, Briefcase, DollarSign, X } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Expert, InsertExpert } from "@shared/schema";

const expertFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  expertise: z.string().min(1, "Expertise is required"),
  industry: z.string().min(1, "Industry is required"),
  yearsOfExperience: z.coerce.number().min(0, "Must be 0 or greater"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  bio: z.string().optional(),
  status: z.string().default("available"),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().optional(),
});

type ExpertFormData = z.infer<typeof expertFormSchema>;

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

const statuses = ["available", "busy", "inactive"];

export default function Experts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["available", "busy", "inactive"]);
  const [rateRange, setRateRange] = useState<[number, number]>([0, 500]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null);
  const [deletingExpert, setDeletingExpert] = useState<Expert | null>(null);
  const [viewingExpert, setViewingExpert] = useState<Expert | null>(null);

  const { data: experts, isLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const form = useForm<ExpertFormData>({
    resolver: zodResolver(expertFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      expertise: "",
      industry: "",
      yearsOfExperience: 0,
      hourlyRate: "",
      bio: "",
      status: "available",
      company: "",
      jobTitle: "",
      linkedinUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertExpert) => apiRequest("POST", "/api/experts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Expert registered successfully" });
    },
    onError: () => {
      toast({ title: "Failed to register expert", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertExpert & { id: number }) =>
      apiRequest("PATCH", `/api/experts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      setIsDialogOpen(false);
      setEditingExpert(null);
      form.reset();
      toast({ title: "Expert updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update expert", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/experts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      setDeletingExpert(null);
      toast({ title: "Expert removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove expert", variant: "destructive" });
    },
  });

  const filteredExperts = experts?.filter((expert) => {
    // Search filter
    const searchMatch =
      expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.expertise.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.industry.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const statusMatch = statusFilter.includes(expert.status);

    // Rate range filter
    const rate = Number(expert.hourlyRate);
    const rateMatch = rate >= rateRange[0] && rate <= rateRange[1];

    return searchMatch && statusMatch && rateMatch;
  });

  const hasActiveFilters =
    statusFilter.length < statuses.length ||
    rateRange[0] > 0 ||
    rateRange[1] < 500 ||
    searchQuery.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter(["available", "busy", "inactive"]);
    setRateRange([0, 500]);
  };

  const handleOpenDialog = (expert?: Expert) => {
    if (expert) {
      setEditingExpert(expert);
      form.reset({
        name: expert.name,
        email: expert.email,
        phone: expert.phone || "",
        expertise: expert.expertise,
        industry: expert.industry,
        yearsOfExperience: expert.yearsOfExperience,
        hourlyRate: expert.hourlyRate.toString(),
        bio: expert.bio || "",
        status: expert.status,
        company: expert.company || "",
        jobTitle: expert.jobTitle || "",
        linkedinUrl: expert.linkedinUrl || "",
      });
    } else {
      setEditingExpert(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ExpertFormData) => {
    const expertData: InsertExpert = {
      ...data,
      phone: data.phone || null,
      bio: data.bio || null,
      company: data.company || null,
      jobTitle: data.jobTitle || null,
      linkedinUrl: data.linkedinUrl || null,
    };

    if (editingExpert) {
      updateMutation.mutate({ ...expertData, id: editingExpert.id });
    } else {
      createMutation.mutate(expertData);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Experts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your expert network and view their profiles.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-register-expert">
          <Plus className="h-4 w-4" /> Register Expert
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, expertise, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:max-w-md"
              data-testid="input-search-experts"
            />
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/50 p-4 sm:gap-6">
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">Availability Status</h3>
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter.includes(status) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setStatusFilter((prev) =>
                        prev.includes(status)
                          ? prev.filter((s) => s !== status)
                          : [...prev, status]
                      );
                    }}
                    data-testid={`button-filter-status-${status}`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Hourly Rate Range</h3>
                <span className="text-sm text-muted-foreground font-mono">
                  ${rateRange[0]} - ${rateRange[1]}
                </span>
              </div>
              <Slider
                value={rateRange}
                onValueChange={(value) =>
                  setRateRange([value[0], value[1]])
                }
                min={0}
                max={500}
                step={10}
                className="w-full"
                data-testid="slider-rate-range"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="w-full justify-center gap-2"
                data-testid="button-reset-filters"
              >
                <X className="h-4 w-4" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredExperts?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No experts found"
          description={
            searchQuery
              ? "Try adjusting your search query."
              : "Register your first expert to build your network."
          }
          action={
            !searchQuery ? (
              <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-register-first-expert">
                <Plus className="h-4 w-4" /> Register Expert
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExperts?.map((expert) => (
            <Card
              key={expert.id}
              className="cursor-pointer transition-colors hover-elevate"
              onClick={() => setViewingExpert(expert)}
              data-testid={`card-expert-${expert.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(expert.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-medium text-foreground">{expert.name}</h3>
                      <p className="text-sm text-muted-foreground">{expert.expertise}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={expert.status} type="expert" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(expert);
                      }}
                      data-testid={`button-edit-expert-${expert.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingExpert(expert);
                      }}
                      data-testid={`button-delete-expert-${expert.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{expert.industry}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-mono">${Number(expert.hourlyRate).toFixed(0)}/hr</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpert ? "Edit Expert" : "Register New Expert"}</DialogTitle>
            <DialogDescription>
              {editingExpert
                ? "Update the expert's profile information."
                : "Add a new expert to your network."}
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
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-expert-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          data-testid="input-expert-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 8900" {...field} data-testid="input-expert-phone" />
                      </FormControl>
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
                          <SelectTrigger data-testid="select-expert-status">
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expertise"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expertise *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Supply Chain Management"
                          {...field}
                          data-testid="input-expertise"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expert-industry">
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="yearsOfExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of Experience *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-years-experience"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate ($) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="150"
                          {...field}
                          data-testid="input-hourly-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Director" {...field} data-testid="input-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="linkedinUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://linkedin.com/in/username"
                        {...field}
                        data-testid="input-linkedin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief professional background..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-bio"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-expert"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-expert"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingExpert
                      ? "Update Expert"
                      : "Register Expert"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExpert} onOpenChange={() => setViewingExpert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Expert Profile</DialogTitle>
          </DialogHeader>
          {viewingExpert && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border border-border">
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(viewingExpert.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-medium">{viewingExpert.name}</h3>
                  <p className="text-muted-foreground">
                    {viewingExpert.jobTitle}
                    {viewingExpert.company && ` at ${viewingExpert.company}`}
                  </p>
                  <StatusBadge status={viewingExpert.status} type="expert" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expertise
                  </p>
                  <p className="font-medium">{viewingExpert.expertise}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Industry
                  </p>
                  <p className="font-medium">{viewingExpert.industry}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Experience
                  </p>
                  <p className="font-medium">{viewingExpert.yearsOfExperience} years</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Hourly Rate
                  </p>
                  <p className="font-mono font-medium">
                    ${Number(viewingExpert.hourlyRate).toFixed(2)}
                  </p>
                </div>
              </div>

              {viewingExpert.bio && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Bio</p>
                  <p className="text-sm">{viewingExpert.bio}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${viewingExpert.email}`} className="text-primary hover:underline">
                      {viewingExpert.email}
                    </a>
                  </div>
                  {viewingExpert.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingExpert.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingExpert} onOpenChange={() => setDeletingExpert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Expert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deletingExpert?.name}" from your network? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-expert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExpert && deleteMutation.mutate(deletingExpert.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-expert"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
