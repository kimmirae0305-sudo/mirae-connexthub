import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
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

interface ExpertEditForm {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedinUrl: string;
  company: string;
  jobTitle: string;
  expertise: string;
  sectorExpertise: string;
  regionalExpertise: string;
  areasOfExpertise: string;
  industry: string;
  country: string;
  city: string;
  timezone: string;
  yearsOfExperience: string;
  hourlyRate: string;
  status: string;
  availableNow: boolean;
  nextAvailableDate: string;
  bio: string;
  biography: string;
  languages: string;
  billingInfo: string;
  workHistory: WorkExperience[];
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

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function expertToForm(expert: Expert): ExpertEditForm {
  return {
    name: expert.name || "",
    email: expert.email || "",
    phone: expert.phone || "",
    whatsapp: expert.whatsapp || "",
    linkedinUrl: expert.linkedinUrl || "",
    company: expert.company || "",
    jobTitle: expert.jobTitle || "",
    expertise: expert.expertise || "",
    sectorExpertise: expert.sectorExpertise || "",
    regionalExpertise: expert.regionalExpertise || "",
    areasOfExpertise: Array.isArray(expert.areasOfExpertise) ? expert.areasOfExpertise.join(", ") : "",
    industry: expert.industry || "",
    country: expert.country || "",
    city: expert.city || "",
    timezone: expert.timezone || "",
    yearsOfExperience: String(expert.yearsOfExperience ?? 0),
    hourlyRate: String(expert.hourlyRate ?? ""),
    status: expert.status || "available",
    availableNow: Boolean(expert.availableNow),
    nextAvailableDate: toDateInputValue(expert.nextAvailableDate),
    bio: expert.bio || "",
    biography: expert.biography || "",
    languages: Array.isArray(expert.languages) ? expert.languages.join(", ") : "",
    billingInfo: expert.billingInfo || "",
    workHistory: Array.isArray(expert.workHistory) ? (expert.workHistory as WorkExperience[]) : [],
  };
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ExpertDetail() {
  const params = useParams<{ id: string }>();
  const expertId = Number(params.id);
  const isValidExpertId = Number.isInteger(expertId) && expertId > 0;
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ExpertEditForm | null>(null);

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

  useEffect(() => {
    if (expert && !isEditing) {
      setFormData(expertToForm(expert));
    }
  }, [expert, isEditing]);

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Expert>) => {
      const response = await apiRequest("PATCH", `/api/experts/${expertId}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts", expertId] });
      queryClient.invalidateQueries({ queryKey: ["/api/experts-with-recruiter"] });
      setIsEditing(false);
      toast({ title: "Expert updated", description: "The expert profile was saved successfully." });
    },
    onError: (error) => {
      toast({
        title: "Failed to update expert",
        description: error instanceof Error ? error.message : "Please review the expert details and try again.",
        variant: "destructive",
      });
    },
  });

  const updateForm = <K extends keyof ExpertEditForm>(field: K, value: ExpertEditForm[K]) => {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleEdit = () => {
    if (expert) {
      setFormData(expertToForm(expert));
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    if (expert) {
      setFormData(expertToForm(expert));
    }
    setIsEditing(false);
  };

  const handleAddWorkHistory = () => {
    setFormData((current) =>
      current
        ? {
            ...current,
            workHistory: [
              ...current.workHistory,
              {
                company: "",
                jobTitle: "",
                fromMonth: 1,
                fromYear: new Date().getFullYear(),
                toMonth: 12,
                toYear: new Date().getFullYear(),
                isCurrent: false,
              },
            ],
          }
        : current
    );
  };

  const handleRemoveWorkHistory = (index: number) => {
    setFormData((current) =>
      current
        ? { ...current, workHistory: current.workHistory.filter((_, itemIndex) => itemIndex !== index) }
        : current
    );
  };

  const updateWorkHistory = <K extends keyof WorkExperience>(
    index: number,
    field: K,
    value: WorkExperience[K]
  ) => {
    setFormData((current) => {
      if (!current) return current;
      const workHistory = [...current.workHistory];
      workHistory[index] = { ...workHistory[index], [field]: value };
      return { ...current, workHistory };
    });
  };

  const handleSave = () => {
    if (!formData) return;
    if (!formData.name.trim() || !formData.email.trim() || !formData.expertise.trim() || !formData.industry.trim()) {
      toast({
        title: "Required fields missing",
        description: "Name, email, expertise, and industry are required.",
        variant: "destructive",
      });
      return;
    }

    const yearsOfExperience = Number(formData.yearsOfExperience);
    const hourlyRate = Number(formData.hourlyRate);
    if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0) {
      toast({ title: "Invalid experience", description: "Years of experience must be 0 or greater.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      toast({ title: "Invalid hourly rate", description: "Hourly rate must be 0 or greater.", variant: "destructive" });
      return;
    }

    updateMutation.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      whatsapp: formData.whatsapp.trim(),
      linkedinUrl: formData.linkedinUrl.trim(),
      company: formData.company.trim(),
      jobTitle: formData.jobTitle.trim(),
      expertise: formData.expertise.trim(),
      sectorExpertise: formData.sectorExpertise.trim(),
      regionalExpertise: formData.regionalExpertise.trim(),
      areasOfExpertise: splitCsv(formData.areasOfExpertise),
      industry: formData.industry.trim(),
      country: formData.country.trim(),
      city: formData.city.trim(),
      timezone: formData.timezone.trim(),
      yearsOfExperience,
      hourlyRate: hourlyRate.toFixed(2),
      status: formData.status,
      availableNow: formData.availableNow,
      nextAvailableDate: formData.nextAvailableDate ? new Date(`${formData.nextAvailableDate}T00:00:00`) : null,
      bio: formData.bio.trim(),
      biography: formData.biography.trim(),
      languages: splitCsv(formData.languages),
      billingInfo: formData.billingInfo.trim(),
      workHistory: formData.workHistory,
    });
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
        {isEditing ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={updateMutation.isPending}
              data-testid="button-cancel-expert-detail-edit"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-expert-detail"
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        ) : (
          <Button onClick={handleEdit} data-testid="button-edit-expert-detail">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Expert
          </Button>
        )}
      </div>

      {isEditing && formData ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit Expert Profile</CardTitle>
              <CardDescription>Update the expert information directly on this profile page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Basic Information</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={formData.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      data-testid="input-detail-expert-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      data-testid="input-detail-expert-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Availability Status</label>
                    <Select value={formData.status} onValueChange={(value) => updateForm("status", value)}>
                      <SelectTrigger data-testid="select-detail-expert-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Current Title</label>
                    <Input
                      value={formData.jobTitle}
                      onChange={(event) => updateForm("jobTitle", event.target.value)}
                      data-testid="input-detail-expert-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Current Company</label>
                    <Input
                      value={formData.company}
                      onChange={(event) => updateForm("company", event.target.value)}
                      data-testid="input-detail-expert-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Years of Experience</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.yearsOfExperience}
                      onChange={(event) => updateForm("yearsOfExperience", event.target.value)}
                      data-testid="input-detail-expert-years"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Contact</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={formData.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      data-testid="input-detail-expert-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">WhatsApp</label>
                    <Input
                      value={formData.whatsapp}
                      onChange={(event) => updateForm("whatsapp", event.target.value)}
                      data-testid="input-detail-expert-whatsapp"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">LinkedIn URL</label>
                    <Input
                      value={formData.linkedinUrl}
                      onChange={(event) => updateForm("linkedinUrl", event.target.value)}
                      data-testid="input-detail-expert-linkedin"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Expertise and Market Coverage</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expertise</label>
                    <Input
                      value={formData.expertise}
                      onChange={(event) => updateForm("expertise", event.target.value)}
                      data-testid="input-detail-expert-expertise"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Industry</label>
                    <Input
                      value={formData.industry}
                      onChange={(event) => updateForm("industry", event.target.value)}
                      data-testid="input-detail-expert-industry"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sector Expertise</label>
                    <Input
                      value={formData.sectorExpertise}
                      onChange={(event) => updateForm("sectorExpertise", event.target.value)}
                      data-testid="input-detail-expert-sector"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Regional Expertise</label>
                    <Input
                      value={formData.regionalExpertise}
                      onChange={(event) => updateForm("regionalExpertise", event.target.value)}
                      data-testid="input-detail-expert-region"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Areas of Expertise</label>
                    <Input
                      value={formData.areasOfExpertise}
                      onChange={(event) => updateForm("areasOfExpertise", event.target.value)}
                      placeholder="Comma-separated areas"
                      data-testid="input-detail-expert-areas"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Location and Availability</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Input
                      value={formData.country}
                      onChange={(event) => updateForm("country", event.target.value)}
                      data-testid="input-detail-expert-country"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={formData.city}
                      onChange={(event) => updateForm("city", event.target.value)}
                      data-testid="input-detail-expert-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timezone</label>
                    <Input
                      value={formData.timezone}
                      onChange={(event) => updateForm("timezone", event.target.value)}
                      data-testid="input-detail-expert-timezone"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Next Available Date</label>
                    <Input
                      type="date"
                      value={formData.nextAvailableDate}
                      onChange={(event) => updateForm("nextAvailableDate", event.target.value)}
                      data-testid="input-detail-expert-next-available"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={formData.availableNow}
                      onCheckedChange={(checked) => updateForm("availableNow", checked === true)}
                      data-testid="checkbox-detail-expert-available-now"
                    />
                    Available now
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Commercial</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hourly Rate</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={(event) => updateForm("hourlyRate", event.target.value)}
                      data-testid="input-detail-expert-rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Languages</label>
                    <Input
                      value={formData.languages}
                      onChange={(event) => updateForm("languages", event.target.value)}
                      placeholder="Comma-separated languages"
                      data-testid="input-detail-expert-languages"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Billing Info</label>
                    <Textarea
                      value={formData.billingInfo}
                      onChange={(event) => updateForm("billingInfo", event.target.value)}
                      data-testid="textarea-detail-expert-billing"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Bio / Background</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Short Bio</label>
                    <Textarea
                      value={formData.bio}
                      onChange={(event) => updateForm("bio", event.target.value)}
                      className="min-h-32"
                      data-testid="textarea-detail-expert-bio"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Detailed Biography</label>
                    <Textarea
                      value={formData.biography}
                      onChange={(event) => updateForm("biography", event.target.value)}
                      className="min-h-32"
                      data-testid="textarea-detail-expert-biography"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Work History</h2>
                  <Button variant="outline" size="sm" onClick={handleAddWorkHistory} data-testid="button-add-detail-work-history">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Role
                  </Button>
                </div>
                {formData.workHistory.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Job Title</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Present</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.workHistory.map((experience, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input
                                value={experience.company || ""}
                                onChange={(event) => updateWorkHistory(index, "company", event.target.value)}
                                data-testid={`input-detail-work-company-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={experience.jobTitle || ""}
                                onChange={(event) => updateWorkHistory(index, "jobTitle", event.target.value)}
                                data-testid={`input-detail-work-title-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Select
                                  value={String(experience.fromMonth || 1)}
                                  onValueChange={(value) => updateWorkHistory(index, "fromMonth", Number(value))}
                                >
                                  <SelectTrigger className="w-24" data-testid={`select-detail-work-from-month-${index}`}>
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
                                  className="w-24"
                                  value={experience.fromYear || ""}
                                  onChange={(event) => updateWorkHistory(index, "fromYear", Number(event.target.value))}
                                  data-testid={`input-detail-work-from-year-${index}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Select
                                  value={String(experience.toMonth || 12)}
                                  onValueChange={(value) => updateWorkHistory(index, "toMonth", Number(value))}
                                  disabled={Boolean(experience.isCurrent)}
                                >
                                  <SelectTrigger className="w-24" data-testid={`select-detail-work-to-month-${index}`}>
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
                                  className="w-24"
                                  value={experience.toYear || ""}
                                  disabled={Boolean(experience.isCurrent)}
                                  onChange={(event) => updateWorkHistory(index, "toYear", Number(event.target.value))}
                                  data-testid={`input-detail-work-to-year-${index}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={Boolean(experience.isCurrent)}
                                onCheckedChange={(checked) => updateWorkHistory(index, "isCurrent", checked === true)}
                                data-testid={`checkbox-detail-work-current-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveWorkHistory(index)}
                                data-testid={`button-remove-detail-work-history-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Briefcase}
                    title="No work history"
                    description="Add roles to capture this expert's professional background."
                    action={
                      <Button variant="outline" onClick={handleAddWorkHistory}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Role
                      </Button>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
