import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Plus, Pencil, Trash2, Search, Users, DollarSign, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Expert, InsertExpert } from "@shared/schema";
import { format } from "date-fns";

interface ExpertWithRecruiter extends Expert {
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruitedAt?: string | Date | null;
}

interface PaginatedExpertsResponse {
  data: ExpertWithRecruiter[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface WorkExperience {
  company: string;
  jobTitle: string;
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  isCurrent: boolean;
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

const getMonthLabel = (month?: number) =>
  monthOptions.find((option) => option.value === month)?.label || "Jan";

const normalizeWorkExperience = (experience: Partial<WorkExperience>): WorkExperience => {
  const currentYear = new Date().getFullYear();
  return {
    company: experience.company ?? "",
    jobTitle: experience.jobTitle ?? "",
    fromMonth: experience.fromMonth ?? 1,
    fromYear: experience.fromYear ?? currentYear,
    toMonth: experience.toMonth ?? 12,
    toYear: experience.toYear ?? currentYear,
    isCurrent: experience.isCurrent ?? false,
  };
};

const formatWorkPeriod = (experience: Partial<WorkExperience>) => {
  const normalized = normalizeWorkExperience(experience);
  const start = `${getMonthLabel(normalized.fromMonth)} ${normalized.fromYear}`;
  const end = normalized.isCurrent
    ? "Present"
    : `${getMonthLabel(normalized.toMonth)} ${normalized.toYear}`;
  return `${start} - ${end}`;
};

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
  workHistory: z.array(z.object({
    company: z.string().min(1, "Company name required"),
    jobTitle: z.string().min(1, "Job title required"),
    fromMonth: z.coerce.number().min(1).max(12).default(1),
    fromYear: z.coerce.number().min(1900, "Year must be 1900 or later"),
    toMonth: z.coerce.number().min(1).max(12).default(12),
    toYear: z.coerce.number().min(1900, "Year must be 1900 or later"),
    isCurrent: z.boolean().default(false),
  }).refine(
    (exp) => exp.isCurrent || exp.fromYear < exp.toYear || (exp.fromYear === exp.toYear && exp.fromMonth <= exp.toMonth),
    { message: "Start date must be before end date", path: ["toYear"] }
  )).default([]),
}).refine(
  (data) => {
    // Ensure workHistory always exists (empty array if not provided)
    return data.workHistory !== undefined;
  },
  { message: "Work history must be an array" }
);

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
  const [rateRange, setRateRange] = useState<[number, number]>([0, 2000]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null);
  const [deletingExpert, setDeletingExpert] = useState<Expert | null>(null);
  const [workHistory, setWorkHistory] = useState<WorkExperience[]>([]);

  const expertsQueryUrl = (() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      hourlyRateMin: String(rateRange[0]),
      hourlyRateMax: String(rateRange[1]),
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter.length > 0 && statusFilter.length < statuses.length) {
      params.set("availabilityStatus", statusFilter.join(","));
    } else if (statusFilter.length === statuses.length) {
      params.set("availabilityStatus", statusFilter.join(","));
    }
    return `/api/experts-with-recruiter?${params.toString()}`;
  })();

  const { data: expertsResponse, isLoading } = useQuery<PaginatedExpertsResponse>({
    queryKey: ["/api/experts-with-recruiter", page, pageSize, searchQuery, statusFilter, rateRange],
    queryFn: async () => {
      const res = await apiRequest("GET", expertsQueryUrl);
      return res.json();
    },
  });

  const experts = expertsResponse?.data || [];
  const totalPages = expertsResponse?.totalPages || 1;
  const totalCount = expertsResponse?.totalCount || 0;
  const paginationPages = Array.from(
    new Set(
      [
        1,
        page - 2,
        page - 1,
        page,
        page + 1,
        page + 2,
        totalPages,
      ].filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
    )
  ).sort((a, b) => a - b);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, rateRange]);

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
      workHistory: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertExpert) => apiRequest("POST", "/api/experts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts-with-recruiter"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Expert registered successfully" });
    },
    onError: () => {
      toast({ title: "Failed to register expert", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertExpert & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/experts/${data.id}`, data);
      return (await res.json()) as Expert;
    },
    onSuccess: (updatedExpert) => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts-with-recruiter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/experts", updatedExpert.id] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/experts-with-recruiter"] });
      setDeletingExpert(null);
      toast({ title: "Expert removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove expert", variant: "destructive" });
    },
  });

  const hasActiveFilters =
    statusFilter.length < statuses.length ||
    rateRange[0] > 0 ||
    rateRange[1] < 2000 ||
    searchQuery.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter(["available", "busy", "inactive"]);
    setRateRange([0, 2000]);
  };

  const handleOpenDialog = (expert?: Expert) => {
    if (expert) {
      setEditingExpert(expert);
      const expertWorkHistory = Array.isArray(expert.workHistory)
        ? (expert.workHistory as Partial<WorkExperience>[]).map(normalizeWorkExperience)
        : [];
      setWorkHistory(expertWorkHistory);
      form.reset({
        name: expert.name ?? "",
        email: expert.email ?? "",
        phone: expert.phone ?? "",
        expertise: expert.expertise ?? "",
        industry: expert.industry ?? "",
        yearsOfExperience: expert.yearsOfExperience ?? 0,
        hourlyRate: String(expert.hourlyRate ?? ""),
        bio: expert.bio ?? "",
        status: expert.status ?? "available",
        company: expert.company ?? "",
        jobTitle: expert.jobTitle ?? "",
        linkedinUrl: expert.linkedinUrl ?? "",
        workHistory: expertWorkHistory,
      });
    } else {
      setEditingExpert(null);
      setWorkHistory([]);
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
      workHistory: workHistory,
    };

    if (editingExpert) {
      updateMutation.mutate({ ...expertData, id: editingExpert.id });
    } else {
      createMutation.mutate(expertData);
    }
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
                max={2000}
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
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : experts.length === 0 ? (
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-medium">Expert Database</CardTitle>
              <p className="text-sm text-muted-foreground">
                Showing {experts.length} of {totalCount} expert{totalCount === 1 ? "" : "s"}.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px] text-xs font-semibold uppercase">Expert Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Expertise / Industry</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Hourly Rate</TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase">Availability Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Recruited by</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experts.map((expert) => (
                    <TableRow key={expert.id} data-testid={`row-expert-${expert.id}`}>
                      <TableCell>
                        <Link
                          href={`/experts/${expert.id}`}
                          className="font-medium text-primary hover:underline"
                          data-testid={`link-expert-detail-${expert.id}`}
                        >
                          {expert.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{expert.jobTitle || expert.company || expert.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{expert.expertise}</div>
                        <div className="text-xs text-muted-foreground">{expert.industry}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className="inline-flex items-center justify-end gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          {Number(expert.hourlyRate).toFixed(0)}/hr
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={expert.status} type="expert" />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{expert.recruiterName || "-"}</div>
                        {(expert.recruitedAt || expert.sourcedAt) && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(expert.recruitedAt || expert.sourcedAt), "MMM d, yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(expert)}
                            data-testid={`button-edit-expert-${expert.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingExpert(expert)}
                            data-testid={`button-delete-expert-${expert.id}`}
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

            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  data-testid="button-experts-previous-page"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                {paginationPages.map((pageNumber, index) => (
                  <div key={pageNumber} className="flex items-center gap-2">
                    {index > 0 && paginationPages[index - 1] !== pageNumber - 1 && (
                      <span className="text-sm text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={page === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNumber)}
                      data-testid={`button-experts-page-${pageNumber}`}
                    >
                      {pageNumber}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-experts-next-page"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingExpert(null);
          }
        }}
      >
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

              <div className="space-y-4 border-t border-b py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">Work History</h3>
                    <p className="text-xs text-muted-foreground mt-1">Employment timeline and job roles</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentYear = new Date().getFullYear();
                      setWorkHistory([
                        ...workHistory,
                        {
                          company: "",
                          jobTitle: "",
                          fromMonth: 1,
                          fromYear: currentYear,
                          toMonth: 12,
                          toYear: currentYear,
                          isCurrent: false,
                        },
                      ]);
                    }}
                    data-testid="button-add-work-history"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Experience
                  </Button>
                </div>

                {workHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No work history added yet. Click "Add Experience" to get started.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workHistory.map((exp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={exp.company}
                              onChange={(e) => {
                                const updated = [...workHistory];
                                updated[idx].company = e.target.value;
                                setWorkHistory(updated);
                              }}
                              placeholder="e.g. Acme Corp"
                              className="border-0 p-1 h-8"
                              data-testid={`input-work-company-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={exp.jobTitle}
                              onChange={(e) => {
                                const updated = [...workHistory];
                                updated[idx].jobTitle = e.target.value;
                                setWorkHistory(updated);
                              }}
                              placeholder="e.g. Senior Manager"
                              className="border-0 p-1 h-8"
                              data-testid={`input-work-jobtitle-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Select
                                value={String(exp.fromMonth)}
                                onValueChange={(value) => {
                                  const updated = [...workHistory];
                                  updated[idx].fromMonth = Number(value);
                                  setWorkHistory(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 w-24" data-testid={`select-work-frommonth-${idx}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {monthOptions.map((month) => (
                                    <SelectItem key={month.value} value={String(month.value)}>
                                      {month.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            <Input
                              type="number"
                              value={exp.fromYear}
                              onChange={(e) => {
                                const updated = [...workHistory];
                                updated[idx].fromYear = parseInt(e.target.value) || new Date().getFullYear();
                                setWorkHistory(updated);
                              }}
                              placeholder="2020"
                              className="border-0 p-1 w-24 h-8"
                              data-testid={`input-work-fromyear-${idx}`}
                              min="1900"
                            />
                            </div>
                          </TableCell>
                          <TableCell>
                            {exp.isCurrent ? (
                              <span className="text-sm text-muted-foreground">Present</span>
                            ) : (
                              <div className="flex gap-2">
                                <Select
                                  value={String(exp.toMonth)}
                                  onValueChange={(value) => {
                                    const updated = [...workHistory];
                                    updated[idx].toMonth = Number(value);
                                    setWorkHistory(updated);
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-24" data-testid={`select-work-tomonth-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {monthOptions.map((month) => (
                                      <SelectItem key={month.value} value={String(month.value)}>
                                        {month.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            <Input
                              type="number"
                              value={exp.toYear}
                              onChange={(e) => {
                                const updated = [...workHistory];
                                updated[idx].toYear = parseInt(e.target.value) || new Date().getFullYear();
                                setWorkHistory(updated);
                              }}
                              placeholder="2024"
                              className="border-0 p-1 w-24 h-8"
                              data-testid={`input-work-toyear-${idx}`}
                              min="1900"
                            />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={exp.isCurrent}
                              onCheckedChange={(checked) => {
                                const updated = [...workHistory];
                                updated[idx].isCurrent = checked === true;
                                setWorkHistory(updated);
                              }}
                              data-testid={`checkbox-work-current-${idx}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setWorkHistory(workHistory.filter((_, i) => i !== idx));
                              }}
                              data-testid={`button-remove-work-history-${idx}`}
                              className="h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
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
