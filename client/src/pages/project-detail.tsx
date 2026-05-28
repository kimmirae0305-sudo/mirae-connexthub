import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
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
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  Layers,
  Download,
  FileSearch,
  Phone,
  Video,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
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
import { resolveApiUrl } from "@/lib/apiUrl";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import { RegisterExpertForm } from "@/components/experts/RegisterExpertForm";
import { QuickInviteForm } from "@/components/experts/QuickInviteForm";
import type { Project, Expert, VettingQuestion, ProjectExpert, ProjectActivity, ProjectAngle, CallRecord, InsertCallRecord, InsertProject, ClientOrganization, Insight } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";

interface EnrichedExpert extends ProjectExpert {
  expert?: Expert;
  sourcedByRa?: { id: number; fullName: string; email?: string } | null;
}

type ExpertWorkHistoryItem = {
  company?: string;
  jobTitle?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  isCurrent?: boolean;
};

type ExpertWithMetrics = Expert & {
  priorProjectCount?: number;
  acceptanceRate?: number;
  matchedWorkHistory?: ExpertWorkHistoryItem[];
};

interface ProjectDetailData extends Project {
  createdByPm?: { id: number; fullName: string; email: string } | null;
  assignedRas?: { id: number; fullName: string; email: string }[];
  vettingQuestions?: VettingQuestion[];
  internalExperts?: EnrichedExpert[];
  raSourcedExperts?: EnrichedExpert[];
  projectAdvisors?: EnrichedExpert[];
  projectApplications?: EnrichedExpert[];
  activities?: ProjectActivity[];
  raInviteLinks?: any[];
  angles?: ProjectAngle[];
}

interface RAUser {
  id: number;
  fullName: string;
  email: string;
}

const projectEditSchema = z.object({
  name: z.string().min(1, "Project title is required"),
  clientOrganizationId: z.string().optional(),
  clientName: z.string().min(1, "Client name is required"),
  industry: z.string().min(1, "Industry is required"),
  status: z.string().min(1, "Status is required"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  cuRatePerCU: z.string().optional(),
  projectOverview: z.string().optional(),
  description: z.string().optional(),
});

type ProjectEditFormData = z.infer<typeof projectEditSchema>;

const projectStatusOptions = ["new", "sourcing", "shortlisted", "confirmed", "completed", "cancelled"];
const projectIndustryOptions = [
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

const toDateInput = (value?: Date | string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const projectId = parseInt(id || "0");

  const [selectedExperts, setSelectedExperts] = useState<Set<number>>(new Set());
  const [selectedRaIds, setSelectedRaIds] = useState<number[]>([]);
  const [isAssignRaModalOpen, setIsAssignRaModalOpen] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isQuickInviteModalOpen, setIsQuickInviteModalOpen] = useState(false);
  const [reviewingApplication, setReviewingApplication] = useState<EnrichedExpert | null>(null);
  const [viewingAdvisor, setViewingAdvisor] = useState<EnrichedExpert | null>(null);
  const [isProjectEditMode, setIsProjectEditMode] = useState(false);
  
  // Angles & VQ state
  const [expandedAngles, setExpandedAngles] = useState<Set<number>>(new Set());
  const [isAngleModalOpen, setIsAngleModalOpen] = useState(false);
  const [editingAngle, setEditingAngle] = useState<ProjectAngle | null>(null);
  const [angleTitle, setAngleTitle] = useState("");
  const [angleDescription, setAngleDescription] = useState("");
  const [isVQModalOpen, setIsVQModalOpen] = useState(false);
  const [editingVQ, setEditingVQ] = useState<VettingQuestion | null>(null);
  const [vqAngleId, setVQAngleId] = useState<number | null>(null);
  const [vqQuestion, setVQQuestion] = useState("");
  const [vqQuestionType, setVQQuestionType] = useState<"screening" | "insight" | "general">("insight");
  const [vqIsRequired, setVQIsRequired] = useState(false);
  
  // Internal Experts angle filter state
  const [internalExpertsAngleFilter, setInternalExpertsAngleFilter] = useState<string>("all");
  
  // Bulk invite modal state
  const [isBulkInviteModalOpen, setIsBulkInviteModalOpen] = useState(false);
  const [selectedInternalExpertIds, setSelectedInternalExpertIds] = useState<Set<number>>(new Set());
  const [bulkInviteAngleIds, setBulkInviteAngleIds] = useState<number[]>([]);
  
  // Expert Search modal state
  const [isExpertSearchModalOpen, setIsExpertSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCurrentEmployer, setSearchCurrentEmployer] = useState("");
  const [searchPastEmployers, setSearchPastEmployers] = useState("");
  const [includeCurrentEmployer, setIncludeCurrentEmployer] = useState(true);
  const [includePastEmployers, setIncludePastEmployers] = useState(true);
  const [searchCompanyName, setSearchCompanyName] = useState("");
  const [searchCompanyScope, setSearchCompanyScope] = useState<"current" | "past" | "any">("any");
  const currentDate = new Date();
  const currentMonthValue = String(currentDate.getMonth() + 1);
  const currentYearValue = String(currentDate.getFullYear());
  const maxEmploymentMonthIndex = (currentDate.getFullYear() - 1970) * 12 + currentDate.getMonth();
  const [employmentPeriodEnabled, setEmploymentPeriodEnabled] = useState(false);
  const [employmentPeriodRange, setEmploymentPeriodRange] = useState<[number, number]>([0, maxEmploymentMonthIndex]);
  const [employmentStartMonth, setEmploymentStartMonth] = useState("1");
  const [employmentStartYear, setEmploymentStartYear] = useState("1990");
  const [employmentEndMonth, setEmploymentEndMonth] = useState(currentMonthValue);
  const [employmentEndYear, setEmploymentEndYear] = useState(currentYearValue);
  const isCurrentRoleScope = searchCompanyScope === "current";
  const [searchMinExp, setSearchMinExp] = useState("");
  const [searchMaxExp, setSearchMaxExp] = useState("");
  const [searchSeniority, setSearchSeniority] = useState<"any" | "20" | "15" | "10" | "5" | "1-2">("any");
  const [searchAvailableOnly, setSearchAvailableOnly] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchJobTitle, setSearchJobTitle] = useState("");
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchLanguage, setSearchLanguage] = useState("");
  const [searchMinHoursWorked, setSearchMinHoursWorked] = useState("");
  const [searchHasPriorProjects, setSearchHasPriorProjects] = useState(false);
  const [searchMinAcceptanceRate, setSearchMinAcceptanceRate] = useState("");
  
  // Register Expert modal state
  const [isRegisterExpertModalOpen, setIsRegisterExpertModalOpen] = useState(false);
  
  // Shortlist export state
  const [isExportingShortlist, setIsExportingShortlist] = useState(false);
  
  // Consultations tab state
  const [isScheduleCallModalOpen, setIsScheduleCallModalOpen] = useState(false);
  const [isCompleteCallModalOpen, setIsCompleteCallModalOpen] = useState(false);
  const [isEditCallModalOpen, setIsEditCallModalOpen] = useState(false);
  const [selectedCallRecord, setSelectedCallRecord] = useState<CallRecord | null>(null);
  const [consultationStatusFilter, setConsultationStatusFilter] = useState<string>("all");
  
  // Auth for role-based UI
  const { user } = useAuth();
  const isRA = user?.role === "ra" || user?.role?.toLowerCase() === "research associate";

  useEffect(() => {
    if (searchCompanyScope === "current") {
      setEmploymentEndMonth(currentMonthValue);
      setEmploymentEndYear(currentYearValue);
    }
  }, [searchCompanyScope, currentMonthValue, currentYearValue]);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seniorityOptions = [
    { value: "any", label: "Any" },
    { value: "20", label: "20+ yrs" },
    { value: "15", label: "15+ yrs" },
    { value: "10", label: "10+ yrs" },
    { value: "5", label: "5+ yrs" },
    { value: "1-2", label: "1-2 yrs" },
  ] as const;
  const applySeniorityFilter = (value: typeof searchSeniority) => {
    setSearchSeniority(value);
    if (value === "any") {
      setSearchMinExp("");
      setSearchMaxExp("");
    } else if (value === "1-2") {
      setSearchMinExp("1");
      setSearchMaxExp("2");
    } else {
      setSearchMinExp(value);
      setSearchMaxExp("");
    }
  };
  const formatEmploymentMonthIndex = (index: number) => {
    if (index >= maxEmploymentMonthIndex) return "Present";
    const year = 1970 + Math.floor(index / 12);
    const month = index % 12;
    return `${monthLabels[month]} ${year}`;
  };
  const formatWorkHistoryPeriod = (item: ExpertWorkHistoryItem) => {
    const fromMonth = item.fromMonth ?? 1;
    const fromYear = item.fromYear ?? "";
    const start = fromYear ? `${monthLabels[fromMonth - 1] || "Jan"} ${fromYear}` : "Unknown";
    const end = item.isCurrent
      ? "Present"
      : item.toYear
      ? `${monthLabels[(item.toMonth ?? 12) - 1] || "Dec"} ${item.toYear}`
      : "Present";
    return `${start} - ${end}`;
  };

  const { data: projectDetail, isLoading: projectLoading, refetch: refetchProject } = useQuery<ProjectDetailData>({
    queryKey: ["/api/projects", projectId, "detail"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/projects/${projectId}/detail`), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: clientOrganizations } = useQuery<ClientOrganization[]>({
    queryKey: ["/api/client-organizations"],
  });

  const projectEditForm = useForm<ProjectEditFormData>({
    resolver: zodResolver(projectEditSchema),
    defaultValues: {
      name: "",
      clientOrganizationId: "",
      clientName: "",
      industry: "",
      status: "new",
      startDate: "",
      dueDate: "",
      cuRatePerCU: "",
      projectOverview: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!projectDetail || isProjectEditMode) return;
    projectEditForm.reset({
      name: projectDetail.name || "",
      clientOrganizationId: projectDetail.clientOrganizationId ? String(projectDetail.clientOrganizationId) : "",
      clientName: projectDetail.clientName || "",
      industry: projectDetail.industry || "",
      status: projectDetail.status || "new",
      startDate: toDateInput(projectDetail.startDate),
      dueDate: toDateInput(projectDetail.dueDate || projectDetail.endDate),
      cuRatePerCU: projectDetail.cuRatePerCU || "",
      projectOverview: projectDetail.projectOverview || "",
      description: projectDetail.description || "",
    });
  }, [projectDetail, isProjectEditMode, projectEditForm]);

  const { data: allRAs } = useQuery<RAUser[]>({
    queryKey: ["/api/users/ras"],
    queryFn: async () => {
      console.log("[RA DEBUG] Frontend: Fetching RAs from /api/users/ras");
      const res = await fetch(resolveApiUrl("/api/users/ras"), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) {
        console.error("[RA DEBUG] Frontend: Failed to fetch RAs, status:", res.status);
        throw new Error("Failed to fetch RAs");
      }
      const data = await res.json();
      console.log("[RA DEBUG] Frontend: RAs fetched for project", projectId, ":", data);
      return data;
    },
  });

  const { data: allExperts } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl("/api/experts"), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch experts");
      return res.json();
    },
  });

  // Call records for this project (Consultations tab)
  const { data: projectCallRecords, isLoading: callRecordsLoading } = useQuery<CallRecord[]>({
    queryKey: ["/api/call-records", { projectId }],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/call-records?projectId=${projectId}`), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch call records");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ["/api/insights"],
  });

  // Expert search results query with metrics
  const { data: expertSearchResults, isLoading: expertSearchLoading, refetch: refetchExpertSearch } = useQuery<ExpertWithMetrics[]>({
    queryKey: [
      "/api/experts/search",
      { 
        query: searchQuery, country: searchCountry, minExp: searchMinExp, maxExp: searchMaxExp, 
        jobTitle: searchJobTitle, industry: searchIndustry, language: searchLanguage,
        hasPriorProjects: searchHasPriorProjects,
        companyName: searchCompanyName,
        companyScope: searchCompanyScope,
        employmentPeriodEnabled,
        employmentStartMonth,
        employmentStartYear,
        employmentEndMonth,
        employmentEndYear,
        availableOnly: searchAvailableOnly,
        minHoursWorked: searchMinHoursWorked, minAcceptanceRate: searchMinAcceptanceRate,
        excludeProjectId: projectId
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (searchCompanyName) {
        params.append("companyName", searchCompanyName);
        params.append("companyScope", searchCompanyScope);
      }
      if (employmentPeriodEnabled && searchCompanyName) {
        params.append("employmentFromMonth", employmentStartMonth);
        params.append("employmentFromYear", employmentStartYear);
        params.append("employmentToMonth", employmentEndMonth);
        params.append("employmentToYear", employmentEndYear);
      }
      if (searchCountry) params.append("country", searchCountry);
      if (searchMinExp) params.append("minYearsExperience", searchMinExp);
      if (searchMaxExp) params.append("maxYearsExperience", searchMaxExp);
      if (searchJobTitle) params.append("jobTitle", searchJobTitle);
      if (searchIndustry) params.append("industry", searchIndustry);
      if (searchLanguage) params.append("language", searchLanguage);
      if (searchAvailableOnly) params.append("availableOnly", "true");
      if (searchMinHoursWorked) params.append("minHoursWorked", searchMinHoursWorked);
      if (searchMinAcceptanceRate) params.append("minAcceptanceRate", searchMinAcceptanceRate);
      if (searchHasPriorProjects) params.append("hasPriorProjects", "true");
      if (projectId) params.append("excludeProjectId", String(projectId));
      const res = await fetch(resolveApiUrl(`/api/experts/search?${params}`), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isExpertSearchModalOpen,
  });

  const expertsToShow = allExperts;

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

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectEditFormData) => {
      const selectedClientOrg = clientOrganizations?.find(
        (org) => String(org.id) === data.clientOrganizationId
      );
      const payload: Partial<InsertProject> = {
        name: data.name,
        clientOrganizationId: data.clientOrganizationId ? Number(data.clientOrganizationId) : null,
        clientName: selectedClientOrg?.name || data.clientName,
        industry: data.industry,
        status: data.status,
        startDate: data.startDate ? new Date(`${data.startDate}T00:00:00`) : null,
        dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00`) : null,
        cuRatePerCU: data.cuRatePerCU || null,
        projectOverview: data.projectOverview || null,
        description: data.description || null,
      };
      return apiRequest("PATCH", `/api/projects/${projectId}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      await refetchProject();
      setIsProjectEditMode(false);
      toast({ title: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const regenerateRaInviteLinkMutation = useMutation({
    mutationFn: async ({ raId }: { raId: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/ra-invite-link`, { raId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      const fullUrl = data.inviteUrl?.startsWith("http")
        ? data.inviteUrl
        : `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(fullUrl);
      toast({ title: "Recruitment link regenerated and copied" });
    },
    onError: () => {
      toast({ title: "Failed to regenerate recruitment link", variant: "destructive" });
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

  const markAdvisorInvitedMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await apiRequest("POST", `/api/project-experts/${assignmentId}/mark-invited`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      toast({
        title: "Advisor marked invited",
        description: "No email was sent. This only updates the internal project invite status.",
      });
    },
    onError: () => {
      toast({ title: "Failed to update advisor invite status", variant: "destructive" });
    },
  });

  const bulkInviteMutation = useMutation({
    mutationFn: async (data: { projectExpertIds: number[]; angleIds: number[]; channel?: string }) => {
      console.log("[INVITES] Frontend: Starting bulk invitation request");
      try {
        const res = await apiRequest("POST", `/api/projects/${projectId}/invitations/bulk-send`, data);
        console.log("[INVITES] Frontend: Response status:", res.status);
        const result = await res.json();
        console.log("[INVITES] Bulk invite response", res.status, result);
        
        // Check if we have a successful response with at least some invitations sent
        if (res.ok && result?.summary?.sent > 0) {
          console.log("[INVITES] Frontend: Success - at least one invitation sent");
          return result;
        }
        
        // If status is OK but no invitations were sent, still treat as success
        if (res.ok) {
          console.log("[INVITES] Frontend: Status OK, returning response");
          return result;
        }
        
        // If we got here, something went wrong
        throw new Error(result?.error || "Failed to send invitations");
      } catch (err) {
        console.error("[INVITES] Frontend: Error in mutationFn:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("[INVITES] Frontend: onSuccess called with data:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setSelectedInternalExpertIds(new Set());
      setBulkInviteAngleIds([]);
      setIsBulkInviteModalOpen(false);
      const sent = data?.summary?.sent || 0;
      const failed = data?.summary?.failed || 0;
      const total = data?.summary?.total || 0;
      
      // Always show success if at least one invitation was sent
      if (sent > 0) {
        console.log("[INVITES] Frontend: Showing success toast - sent:", sent, "failed:", failed);
        toast({ 
          title: `Invitations sent: ${sent}${failed > 0 ? ` (${failed} failed)` : ''}`,
          variant: "default"
        });
      } else if (total > 0) {
        console.log("[INVITES] Frontend: All invitations failed");
        toast({ 
          title: "Failed to send all invitations",
          variant: "destructive"
        });
      } else {
        console.log("[INVITES] Frontend: No invitations to send");
        toast({ title: "No invitations sent", variant: "default" });
      }
    },
    onError: (error) => {
      console.error("[INVITES] Frontend: onError called with error:", error);
      toast({ title: "Failed to send invitations", variant: "destructive" });
    },
  });

  const attachExpertMutation = useMutation({
    mutationFn: async (expertId: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/experts/bulk`, {
        expertIds: [expertId],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      toast({ title: "Expert attached to project" });
    },
    onError: () => {
      toast({ title: "Failed to attach expert", variant: "destructive" });
    },
  });

  // Angles mutations
  const createAngleMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/angles`, {
        ...data,
        orderIndex: (projectDetail?.angles?.length || 0),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsAngleModalOpen(false);
      setAngleTitle("");
      setAngleDescription("");
      toast({ title: "Angle created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create angle", variant: "destructive" });
    },
  });

  const updateAngleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title?: string; description?: string } }) => {
      const res = await apiRequest("PATCH", `/api/angles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsAngleModalOpen(false);
      setEditingAngle(null);
      setAngleTitle("");
      setAngleDescription("");
      toast({ title: "Angle updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update angle", variant: "destructive" });
    },
  });

  const deleteAngleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/angles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      toast({ title: "Angle deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete angle", variant: "destructive" });
    },
  });

  // Call Record mutations (Consultations tab)
  const createCallMutation = useMutation({
    mutationFn: (data: InsertCallRecord) => apiRequest("POST", "/api/call-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      setIsScheduleCallModalOpen(false);
      scheduleCallForm.reset();
      toast({ title: "Consultation scheduled successfully" });
    },
    onError: () => {
      toast({ title: "Failed to schedule consultation", variant: "destructive" });
    },
  });

  const completeCallMutation = useMutation({
    mutationFn: (data: { actualDurationMinutes: number; recordingUrl?: string; notes?: string }) =>
      apiRequest("POST", `/api/call-records/${selectedCallRecord?.id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsCompleteCallModalOpen(false);
      setSelectedCallRecord(null);
      completeCallForm.reset();
      toast({ title: "Consultation marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to complete consultation", variant: "destructive" });
    },
  });

  const cancelCallMutation = useMutation({
    mutationFn: (callId: number) =>
      apiRequest("POST", `/api/call-records/${callId}/cancel`, { reason: "Cancelled by user" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      toast({ title: "Consultation cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel consultation", variant: "destructive" });
    },
  });

  /**
   * Edit Call Mutation - Updates duration and CU Used
   * Uses PATCH /api/call-records/:id endpoint
   * CU formula: ceil(durationMinutes / 15) * 0.25
   */
  const editCallMutation = useMutation({
    mutationFn: (data: { durationMinutes: number; cuUsed: string }) =>
      apiRequest("PATCH", `/api/call-records/${selectedCallRecord?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsEditCallModalOpen(false);
      setSelectedCallRecord(null);
      editCallForm.reset();
      toast({ title: "Consultation updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update consultation", variant: "destructive" });
    },
  });

  // Schedule Call Form
  const scheduleCallFormSchema = z.object({
    expertId: z.number().min(1, "Expert is required"),
    callDate: z.string().min(1, "Call date is required"),
    durationMinutes: z.number().min(1, "Duration is required"),
    scheduledStartTime: z.string().optional(),
    scheduledEndTime: z.string().optional(),
    zoomLink: z.string().optional(),
    notes: z.string().optional(),
  });

  type ScheduleCallFormData = z.infer<typeof scheduleCallFormSchema>;

  const scheduleCallForm = useForm<ScheduleCallFormData>({
    resolver: zodResolver(scheduleCallFormSchema),
    defaultValues: {
      expertId: 0,
      callDate: format(new Date(), "yyyy-MM-dd"),
      durationMinutes: 30,
      scheduledStartTime: "",
      scheduledEndTime: "",
      zoomLink: "",
      notes: "",
    },
  });

  // Complete Call Form
  const completeCallFormSchema = z.object({
    actualDurationMinutes: z.number().min(1, "Duration is required"),
    recordingUrl: z.string().optional(),
    notes: z.string().optional(),
  });

  type CompleteCallFormData = z.infer<typeof completeCallFormSchema>;

  const completeCallForm = useForm<CompleteCallFormData>({
    resolver: zodResolver(completeCallFormSchema),
    defaultValues: {
      actualDurationMinutes: 30,
      recordingUrl: "",
      notes: "",
    },
  });

  /**
   * Edit Call Form Schema
   * Duration must be > 0
   * CU Used must be >= 0 and in 0.25 increments
   */
  const editCallFormSchema = z.object({
    durationMinutes: z.number().min(1, "Duration must be greater than 0"),
    cuUsed: z.number().min(0, "CU Used must be 0 or greater").refine(
      (val) => val % 0.25 === 0,
      "CU Used must be in 0.25 increments (e.g., 0.25, 0.50, 0.75, 1.00)"
    ),
  });

  type EditCallFormData = z.infer<typeof editCallFormSchema>;

  const editCallForm = useForm<EditCallFormData>({
    resolver: zodResolver(editCallFormSchema),
    defaultValues: {
      durationMinutes: 30,
      cuUsed: 0.5,
    },
  });

  /**
   * Calculate CU from duration
   * CU formula: ceil(durationMinutes / 15) * 0.25
   * (1 CU = 60 minutes, charged in 0.25 CU / 15 min increments)
   */
  const calculateCuFromDuration = (minutes: number): number => {
    return Math.ceil(minutes / 15) * 0.25;
  };

  const onEditCallSubmit = (data: EditCallFormData) => {
    editCallMutation.mutate({
      durationMinutes: data.durationMinutes,
      cuUsed: data.cuUsed.toString(),
    });
  };

  const onScheduleCallSubmit = (data: ScheduleCallFormData) => {
    const cuUsed = Math.ceil((data.durationMinutes / 60) * 4) / 4;
    const callData: InsertCallRecord = {
      projectId,
      expertId: data.expertId,
      callDate: new Date(data.callDate),
      durationMinutes: data.durationMinutes,
      cuUsed: cuUsed.toString(),
      status: data.scheduledStartTime ? "scheduled" : "pending",
      scheduledStartTime: data.scheduledStartTime ? new Date(data.scheduledStartTime) : null,
      scheduledEndTime: data.scheduledEndTime ? new Date(data.scheduledEndTime) : null,
      zoomLink: data.zoomLink || null,
      notes: data.notes || null,
    };
    createCallMutation.mutate(callData);
  };

  const onCompleteCallSubmit = (data: CompleteCallFormData) => {
    completeCallMutation.mutate(data);
  };

  // Helper functions for Consultations tab
  const getExpertNameById = (expertId: number) => {
    return allExperts?.find((e) => e.id === expertId)?.name || "Unknown";
  };

  const getRaNameById = (raId: number | null) => {
    if (!raId) return "—";
    return allRAs?.find((ra) => ra.id === raId)?.fullName || "Unknown";
  };

  const filteredProjectCalls = projectCallRecords?.filter((record) =>
    consultationStatusFilter === "all" || record.status === consultationStatusFilter
  );

  const projectScheduledCalls = projectCallRecords?.filter((r) => r.status === "scheduled").length || 0;
  const projectCompletedCalls = projectCallRecords?.filter((r) => r.status === "completed").length || 0;
  const projectTotalCuUsed = projectCallRecords
    ?.filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + parseFloat(r.cuUsed || "0"), 0) || 0;

  // Vetting Questions mutations
  const createVQMutation = useMutation({
    mutationFn: async (data: { question: string; angleId: number | null; questionType: string; isRequired: boolean }) => {
      const existingVQs = projectDetail?.vettingQuestions?.filter(vq => vq.angleId === data.angleId) || [];
      const res = await apiRequest("POST", `/api/vetting-questions`, {
        ...data,
        projectId,
        orderIndex: existingVQs.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsVQModalOpen(false);
      setVQQuestion("");
      setVQAngleId(null);
      setVQQuestionType("insight");
      setVQIsRequired(false);
      toast({ title: "Vetting question created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create vetting question", variant: "destructive" });
    },
  });

  const updateVQMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<VettingQuestion> }) => {
      const res = await apiRequest("PATCH", `/api/vetting-questions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setIsVQModalOpen(false);
      setEditingVQ(null);
      setVQQuestion("");
      setVQAngleId(null);
      setVQQuestionType("insight");
      setVQIsRequired(false);
      toast({ title: "Vetting question updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update vetting question", variant: "destructive" });
    },
  });

  const deleteVQMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vetting-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      toast({ title: "Vetting question deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete vetting question", variant: "destructive" });
    },
  });

  // Helper functions for Angles
  const toggleAngleExpanded = (angleId: number) => {
    const newExpanded = new Set(expandedAngles);
    if (newExpanded.has(angleId)) {
      newExpanded.delete(angleId);
    } else {
      newExpanded.add(angleId);
    }
    setExpandedAngles(newExpanded);
  };

  const openAddAngleModal = () => {
    setEditingAngle(null);
    setAngleTitle("");
    setAngleDescription("");
    setIsAngleModalOpen(true);
  };

  const openEditAngleModal = (angle: ProjectAngle) => {
    setEditingAngle(angle);
    setAngleTitle(angle.title);
    setAngleDescription(angle.description || "");
    setIsAngleModalOpen(true);
  };

  const handleSaveAngle = () => {
    if (!angleTitle.trim()) return;
    if (editingAngle) {
      updateAngleMutation.mutate({ 
        id: editingAngle.id, 
        data: { title: angleTitle, description: angleDescription || undefined } 
      });
    } else {
      createAngleMutation.mutate({ 
        title: angleTitle, 
        description: angleDescription || undefined 
      });
    }
  };

  const openAddVQModal = (angleId: number | null) => {
    setEditingVQ(null);
    setVQAngleId(angleId);
    setVQQuestion("");
    setVQQuestionType("insight");
    setVQIsRequired(false);
    setIsVQModalOpen(true);
  };

  const openEditVQModal = (vq: VettingQuestion) => {
    setEditingVQ(vq);
    setVQAngleId(vq.angleId || null);
    setVQQuestion(vq.question);
    setVQQuestionType((vq.questionType as "screening" | "insight" | "general") || "insight");
    setVQIsRequired(vq.isRequired || false);
    setIsVQModalOpen(true);
  };

  const handleSaveVQ = () => {
    if (!vqQuestion.trim()) return;
    if (editingVQ) {
      updateVQMutation.mutate({
        id: editingVQ.id,
        data: { 
          question: vqQuestion, 
          angleId: vqAngleId, 
          questionType: vqQuestionType,
          isRequired: vqIsRequired 
        },
      });
    } else {
      createVQMutation.mutate({
        question: vqQuestion,
        angleId: vqAngleId,
        questionType: vqQuestionType,
        isRequired: vqIsRequired,
      });
    }
  };

  const getVQsForAngle = (angleId: number | null) => {
    return (projectDetail?.vettingQuestions || [])
      .filter(vq => vq.angleId === angleId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  // Get angle names for display based on expert's angleIds
  const getAngleBadges = (pe: EnrichedExpert) => {
    if (!pe.angleIds || pe.angleIds.length === 0) return null;
    const angleNames = pe.angleIds
      .map(id => projectDetail?.angles?.find(a => a.id === id)?.title)
      .filter(Boolean);
    return angleNames;
  };

  const projectAdvisors = useMemo(() => {
    if (projectDetail?.projectAdvisors) return projectDetail.projectAdvisors;
    const byId = new Map<number, EnrichedExpert>();
    [...(projectDetail?.internalExperts || []), ...(projectDetail?.raSourcedExperts || [])].forEach((advisor) => {
      byId.set(advisor.id, advisor);
    });
    return Array.from(byId.values());
  }, [projectDetail?.projectAdvisors, projectDetail?.internalExperts, projectDetail?.raSourcedExperts]);

  // Filter project advisors by angle
  const filteredInternalExperts = useMemo(() => {
    const experts = projectAdvisors;
    if (internalExpertsAngleFilter === "all") return experts;
    if (internalExpertsAngleFilter === "none") {
      return experts.filter(pe => !pe.angleIds || pe.angleIds.length === 0);
    }
    const angleId = parseInt(internalExpertsAngleFilter);
    return experts.filter(pe => pe.angleIds?.includes(angleId));
  }, [projectAdvisors, internalExpertsAngleFilter]);

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

  // =====================================================
  // SHORTLIST EXPORT HANDLER
  // Button location: Internal Experts Pipeline section header (next to "Search & Add")
  // Exports experts with pipelineStatus = "interested" as CSV
  // =====================================================
  const handleExportShortlist = async () => {
    // Check if there are any experts with "interested" pipeline status
    const shortlistedExperts = (projectDetail?.internalExperts || [])
      .filter(pe => pe.pipelineStatus === "interested");
    
    if (shortlistedExperts.length === 0) {
      toast({
        title: "No shortlisted experts to export yet.",
        description: "Experts must have 'Interested' pipeline status to be included.",
        variant: "default",
      });
      return;
    }

    setIsExportingShortlist(true);
    try {
      const response = await fetch(resolveApiUrl(`/api/projects/${projectId}/export-shortlist`), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export shortlist");
      }

      // Get the CSV content as a blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortlist_project_${projectId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Shortlist exported successfully",
        description: `${shortlistedExperts.length} expert(s) exported to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export shortlist",
        variant: "destructive",
      });
    } finally {
      setIsExportingShortlist(false);
    }
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
      case "submitted":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Application Submitted</Badge>;
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
      case "pending_review":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Pending Review</Badge>;
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
      case "scheduled":
        return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20">Scheduled</Badge>;
      case "invited":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Invited</Badge>;
      case "assigned":
        return <Badge variant="secondary">Added</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const hasReviewableApplication = (pe: EnrichedExpert) =>
    pe.applicationStatus === "submitted" ||
    Boolean(pe.acceptedAt) ||
    Boolean(pe.expectedHourlyRateUsd) ||
    (Array.isArray(pe.vqAnswers) && pe.vqAnswers.length > 0);

  const getAdvisorSourceLabel = (pe: EnrichedExpert) => {
    if (pe.sourceType === "internal_db") return "Internal DB";
    if (pe.sourceType === "ra_external" || pe.sourceType === "ra_sourced" || pe.sourceType === "quick_invite") return "RA-sourced";
    if (pe.sourcedByRa) return "RA-sourced";
    return "Admin";
  };

  const getAdvisorStatusBadge = (pe: EnrichedExpert) => {
    if (pe.applicationStatus === "submitted") {
      return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Application Submitted</Badge>;
    }
    if (pe.status === "pending_review" || pe.pipelineStatus === "pending_review") {
      return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Pending Review</Badge>;
    }
    if (pe.invitationStatus === "invited") {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Invited</Badge>;
    }
    return <Badge variant="secondary">Added</Badge>;
  };

  const shouldShowAdvisorInvitationStatus = (pe: EnrichedExpert) => {
    if (!pe.invitationStatus || pe.invitationStatus === "not_invited") return false;
    if (pe.applicationStatus === "submitted" && pe.invitationStatus === "submitted") return false;
    if (pe.invitationStatus === "invited" && pe.status !== "pending_review") return false;
    if (pe.invitationStatus === pe.status) return false;
    return true;
  };

  const shouldShowAdvisorPipelineStatus = (pe: EnrichedExpert) => {
    if (!pe.pipelineStatus) return false;
    if (pe.applicationStatus === "submitted" && pe.pipelineStatus === "pending_review") return false;
    if (pe.pipelineStatus === pe.status) return false;
    if (pe.pipelineStatus === "assigned") return false;
    if (pe.pipelineStatus === "invited" && pe.invitationStatus === "invited") return false;
    return true;
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

  const projectApplications = projectDetail.projectApplications || projectAdvisors.filter(hasReviewableApplication);
  const canViewProjectRevenue = ["admin", "finance"].includes(user?.role?.toLowerCase() || "");
  const summaryCuUsed = projectTotalCuUsed || parseFloat(projectDetail.totalCuUsed || "0") || 0;
  const projectCuRate = parseFloat(projectDetail.cuRatePerCU || "");
  const estimatedProjectRevenue =
    Number.isFinite(projectCuRate) && summaryCuUsed > 0 ? summaryCuUsed * projectCuRate : null;
  const summaryMetrics = [
    {
      label: "Added Advisors",
      value: String(projectAdvisors.length),
      helper: "Project-linked experts",
    },
    {
      label: "Applications Submitted",
      value: String(projectApplications.length),
      helper: "Reviewable applications",
    },
    {
      label: "RA-Sourced Experts",
      value: String(projectDetail.raSourcedExperts?.length || 0),
      helper: "External sourcing",
    },
    {
      label: "Scheduled Calls",
      value: String(projectScheduledCalls),
      helper: "Upcoming consultations",
    },
    {
      label: "Completed Calls",
      value: String(projectCompletedCalls),
      helper: "Finished consultations",
    },
    {
      label: "CU Used",
      value: summaryCuUsed.toFixed(2),
      helper: "Completed call CU",
    },
  ];
  const projectInsightCount = (() => {
    const callIds = new Set((projectCallRecords || []).map((call) => call.id));
    const callIdStrings = new Set((projectCallRecords || []).map((call) => String(call.id)));
    return insights.filter((insight) => {
      if (insight.callRecordId && callIds.has(insight.callRecordId)) return true;
      if (insight.consultationId && callIdStrings.has(insight.consultationId)) return true;
      return false;
    }).length;
  })();

  const assignedRaCount = projectDetail.assignedRas?.length || projectDetail.assignedRaIds?.length || (projectDetail.assignedRaId ? 1 : 0);
  const raSourcedCount = projectDetail.raSourcedExperts?.length || 0;
  const projectClosed = ["completed", "closed"].includes((projectDetail.status || "").toLowerCase());
  const lifecycleBaseStages = [
    {
      label: "Client Request",
      isComplete: Boolean(projectDetail.clientRequestNotes || projectDetail.clientName || projectDetail.id),
      evidence: projectDetail.clientRequestNotes ? "Request notes captured" : "Project record created",
      actionLabel: "Completed",
    },
    {
      label: "Project Setup",
      isComplete: Boolean(projectDetail.name && projectDetail.industry),
      evidence: projectDetail.projectOverview ? "Overview and basics ready" : "Core fields available",
      actionLabel: projectDetail.name && projectDetail.industry ? "Completed" : "Needs Action",
    },
    {
      label: "RA Assignment",
      isComplete: assignedRaCount > 0,
      evidence: `${assignedRaCount} assigned`,
      actionLabel: assignedRaCount > 0 ? "Completed" : "Needs Action",
    },
    {
      label: "Expert Sourcing",
      isComplete: Boolean((projectDetail.raSourcedExperts?.length || 0) > 0 || projectAdvisors.length > 0),
      evidence: `${projectAdvisors.length} advisor${projectAdvisors.length === 1 ? "" : "s"} connected; ${raSourcedCount} RA-sourced`,
      actionLabel: projectAdvisors.length > 0 || raSourcedCount > 0 ? "In Progress" : "Needs Action",
    },
    {
      label: "Applications Review",
      isComplete: projectApplications.length > 0,
      evidence: `${projectApplications.length} submitted`,
      actionLabel: projectApplications.length > 0 ? "In Progress" : "Pending",
    },
    {
      label: "Client Shortlist",
      isComplete: projectAdvisors.length > 0,
      evidence: `${projectAdvisors.length} advisor${projectAdvisors.length === 1 ? "" : "s"} in pool`,
      actionLabel: projectAdvisors.length > 0 ? "In Progress" : "Pending",
    },
    {
      label: "Calls Scheduled",
      isComplete: projectScheduledCalls > 0 || projectCompletedCalls > 0,
      evidence: `${projectScheduledCalls} scheduled`,
      actionLabel: projectScheduledCalls > 0 || projectCompletedCalls > 0 ? "In Progress" : "Pending",
    },
    {
      label: "Calls Completed",
      isComplete: projectCompletedCalls > 0,
      evidence: `${projectCompletedCalls} completed`,
      actionLabel: projectCompletedCalls > 0 ? "In Progress" : "Pending",
    },
    {
      label: "Insights Captured",
      isComplete: projectInsightCount > 0,
      evidence: `${projectInsightCount} insight${projectInsightCount === 1 ? "" : "s"}`,
      actionLabel: projectInsightCount > 0 ? "In Progress" : projectCompletedCalls > 0 ? "Needs Action" : "Pending",
    },
    {
      label: "Project Closed",
      isComplete: projectClosed,
      evidence: `Status: ${projectDetail.status || "not set"}`,
      actionLabel: projectClosed ? "Completed" : "Pending",
    },
  ];
  const firstIncompleteLifecycleIndex = lifecycleBaseStages.findIndex((stage) => !stage.isComplete);
  const lifecycleStages = lifecycleBaseStages.map((stage, index) => ({
    ...stage,
    state: stage.isComplete
      ? "complete"
      : index === firstIncompleteLifecycleIndex
        ? "current"
        : "pending",
    statusLabel: stage.isComplete
      ? stage.actionLabel
      : index === firstIncompleteLifecycleIndex && stage.actionLabel !== "Pending"
        ? stage.actionLabel
        : "Pending",
  }));

  const reviewedWorkHistory = Array.isArray(reviewingApplication?.expert?.workHistory)
    ? reviewingApplication.expert.workHistory as ExpertWorkHistoryItem[]
    : [];
  const reviewedAnswers = Array.isArray(reviewingApplication?.vqAnswers)
    ? reviewingApplication.vqAnswers as Array<{ questionText?: string; answerText?: string }>
    : [];

  const startProjectEdit = () => {
    projectEditForm.reset({
      name: projectDetail.name || "",
      clientOrganizationId: projectDetail.clientOrganizationId ? String(projectDetail.clientOrganizationId) : "",
      clientName: projectDetail.clientName || "",
      industry: projectDetail.industry || "",
      status: projectDetail.status || "new",
      startDate: toDateInput(projectDetail.startDate),
      dueDate: toDateInput(projectDetail.dueDate || projectDetail.endDate),
      cuRatePerCU: projectDetail.cuRatePerCU || "",
      projectOverview: projectDetail.projectOverview || "",
      description: projectDetail.description || "",
    });
    setIsProjectEditMode(true);
  };

  const cancelProjectEdit = () => {
    projectEditForm.reset({
      name: projectDetail.name || "",
      clientOrganizationId: projectDetail.clientOrganizationId ? String(projectDetail.clientOrganizationId) : "",
      clientName: projectDetail.clientName || "",
      industry: projectDetail.industry || "",
      status: projectDetail.status || "new",
      startDate: toDateInput(projectDetail.startDate),
      dueDate: toDateInput(projectDetail.dueDate || projectDetail.endDate),
      cuRatePerCU: projectDetail.cuRatePerCU || "",
      projectOverview: projectDetail.projectOverview || "",
      description: projectDetail.description || "",
    });
    setIsProjectEditMode(false);
  };

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
            {isProjectEditMode ? (
              <Input
                className="h-10 max-w-xl text-2xl font-semibold"
                aria-label="Project title"
                {...projectEditForm.register("name")}
              />
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">{projectDetail.name}</h1>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isProjectEditMode ? (
                <Select
                  value={projectEditForm.watch("status")}
                  onValueChange={(value) => projectEditForm.setValue("status", value, { shouldDirty: true })}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge status={projectDetail.status} type="project" />
              )}
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
        <div className="flex gap-2">
          {isProjectEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={cancelProjectEdit}
                disabled={updateProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={projectEditForm.handleSubmit((data) => updateProjectMutation.mutate(data))}
                disabled={updateProjectMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          ) : (
            <Button onClick={startProjectEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Project Lifecycle
          </CardTitle>
          <CardDescription>
            Read-only operational progress derived from project activity, advisor, application, call, and insight data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {lifecycleStages.map((stage, index) => (
              <div
                key={stage.label}
                className={`rounded-md border p-3 ${
                  stage.state === "complete"
                    ? "border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/20"
                    : stage.state === "current"
                      ? "border-primary/30 bg-primary/5"
                      : "bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      stage.state === "complete"
                        ? "bg-green-600 text-white"
                        : stage.state === "current"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {stage.state === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stage.evidence}</p>
                    <Badge
                      variant={
                        stage.statusLabel === "Completed"
                          ? "default"
                          : stage.statusLabel === "Needs Action"
                            ? "destructive"
                            : stage.statusLabel === "In Progress"
                              ? "secondary"
                              : "outline"
                      }
                      className="mt-2"
                    >
                      {stage.statusLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Project Summary
          </CardTitle>
          <CardDescription>
            Read-only operational snapshot from project advisors, applications, consultations, and CU usage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-3 sm:grid-cols-2 ${canViewProjectRevenue ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
            {summaryMetrics.map((metric) => (
              <div key={metric.label} className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>
              </div>
            ))}
            {canViewProjectRevenue && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Estimated Revenue</p>
                <p className="mt-1 text-2xl font-semibold">
                  {estimatedProjectRevenue === null
                    ? "N/A"
                    : `$${estimatedProjectRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">CU used x project rate</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="angles-vq" data-testid="tab-angles-vq">
            Angles & VQ {projectDetail.angles?.length ? `(${projectDetail.angles.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="existing-experts" data-testid="tab-existing-experts">
            Existing Experts {projectAdvisors.length ? `(${projectAdvisors.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ra-sourcing" data-testid="tab-ra-sourcing">
            RA Sourcing {projectDetail.raSourcedExperts?.length ? `(${projectDetail.raSourcedExperts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="applications" data-testid="tab-applications">
            Applications {projectApplications.length ? `(${projectApplications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="consultations" data-testid="tab-consultations">
            Consultations {projectCallRecords?.length ? `(${projectCallRecords.length})` : ""}
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
                    {isProjectEditMode ? (
                      <div className="space-y-2">
                        <Select
                          value={projectEditForm.watch("clientOrganizationId")}
                          onValueChange={(value) => {
                            const selectedOrg = clientOrganizations?.find((org) => String(org.id) === value);
                            projectEditForm.setValue("clientOrganizationId", value, { shouldDirty: true });
                            if (selectedOrg) {
                              projectEditForm.setValue("clientName", selectedOrg.name, { shouldDirty: true });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select client organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientOrganizations?.map((org) => (
                              <SelectItem key={org.id} value={String(org.id)}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input placeholder="Client name" {...projectEditForm.register("clientName")} />
                      </div>
                    ) : (
                      <p className="font-medium">{projectDetail.clientName}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    {isProjectEditMode ? (
                      <Select
                        value={projectEditForm.watch("industry")}
                        onValueChange={(value) => projectEditForm.setValue("industry", value, { shouldDirty: true })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectIndustryOptions.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{projectDetail.industry}</p>
                    )}
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
                    {isProjectEditMode ? (
                      <Input type="date" {...projectEditForm.register("startDate")} />
                    ) : (
                      <p className="font-medium">
                        {projectDetail.startDate
                          ? format(new Date(projectDetail.startDate), "MMM dd, yyyy")
                          : "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    {isProjectEditMode ? (
                      <Input type="date" {...projectEditForm.register("dueDate")} />
                    ) : (
                      <p className="font-medium">
                        {projectDetail.dueDate
                          ? format(new Date(projectDetail.dueDate), "MMM dd, yyyy")
                          : "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CU Used</p>
                    <p className="font-mono font-medium">{parseFloat(projectDetail.totalCuUsed || "0").toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rate per CU</p>
                    {isProjectEditMode ? (
                      <Input type="number" min="0" step="0.01" {...projectEditForm.register("cuRatePerCU")} />
                    ) : (
                      <p className="font-mono font-medium">${parseFloat(projectDetail.cuRatePerCU || "1150").toFixed(0)}</p>
                    )}
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

          {(isProjectEditMode || projectDetail.projectOverview) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {isProjectEditMode ? (
                  <Textarea
                    rows={5}
                    placeholder="Summarize the project context, objectives, and scope..."
                    {...projectEditForm.register("projectOverview")}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{projectDetail.projectOverview}</p>
                )}
              </CardContent>
            </Card>
          )}

          {(isProjectEditMode || projectDetail.description) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                {isProjectEditMode ? (
                  <Textarea
                    rows={4}
                    placeholder="Add internal project description..."
                    {...projectEditForm.register("description")}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{projectDetail.description}</p>
                )}
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

        {/* Angles & VQ Tab */}
        <TabsContent value="angles-vq" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Expert Angles
                  </CardTitle>
                  <CardDescription>
                    Define angles (expert profiles) and their vetting questions
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openAddAngleModal} data-testid="button-add-angle">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Angle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!projectDetail.angles || projectDetail.angles.length === 0) ? (
                <EmptyState
                  icon={Layers}
                  title="No angles defined"
                  description="Create angles to organize experts by profile type and define specific vetting questions for each"
                  action={
                    <Button size="sm" onClick={openAddAngleModal} data-testid="button-add-angle-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Angle
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {projectDetail.angles
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((angle) => {
                      const isExpanded = expandedAngles.has(angle.id);
                      const vqs = getVQsForAngle(angle.id);
                      return (
                        <div key={angle.id} className="border rounded-lg">
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
                            onClick={() => toggleAngleExpanded(angle.id)}
                            data-testid={`angle-header-${angle.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <h3 className="font-medium">{angle.title}</h3>
                                {angle.description && (
                                  <p className="text-sm text-muted-foreground">{angle.description}</p>
                                )}
                              </div>
                              <Badge variant="secondary" className="ml-2">
                                {vqs.length} question{vqs.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditAngleModal(angle)}
                                data-testid={`button-edit-angle-${angle.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(`Delete angle "${angle.title}" and all its vetting questions?`)) {
                                    deleteAngleMutation.mutate(angle.id);
                                  }
                                }}
                                data-testid={`button-delete-angle-${angle.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t p-4 bg-muted/30">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-muted-foreground">Vetting Questions</h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAddVQModal(angle.id)}
                                  data-testid={`button-add-vq-${angle.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Question
                                </Button>
                              </div>
                              {vqs.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No questions yet</p>
                              ) : (
                                <div className="space-y-2">
                                  {vqs.map((vq, index) => (
                                    <div
                                      key={vq.id}
                                      className="flex items-start gap-3 p-3 rounded-lg bg-background border"
                                      data-testid={`vq-item-${vq.id}`}
                                    >
                                      <span className="font-mono text-sm text-muted-foreground w-6 flex-shrink-0">
                                        {index + 1}.
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-sm">{vq.question}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          {vq.questionType && (
                                            <Badge
                                              variant="outline"
                                              className={
                                                vq.questionType === "screening"
                                                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                                  : vq.questionType === "insight"
                                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                                  : ""
                                              }
                                            >
                                              {vq.questionType}
                                            </Badge>
                                          )}
                                          {vq.isRequired && (
                                            <Badge variant="secondary" className="text-xs">Required</Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openEditVQModal(vq)}
                                          data-testid={`button-edit-vq-${vq.id}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            if (confirm("Delete this vetting question?")) {
                                              deleteVQMutation.mutate(vq.id);
                                            }
                                          }}
                                          data-testid={`button-delete-vq-${vq.id}`}
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unassigned VQs (legacy or general questions) */}
          {getVQsForAngle(null).length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      General Vetting Questions
                    </CardTitle>
                    <CardDescription>
                      Questions not assigned to any specific angle
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openAddVQModal(null)} data-testid="button-add-general-vq">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getVQsForAngle(null).map((vq, index) => (
                    <div
                      key={vq.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`general-vq-item-${vq.id}`}
                    >
                      <span className="font-mono text-sm text-muted-foreground w-6 flex-shrink-0">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="text-sm">{vq.question}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {vq.questionType && (
                            <Badge
                              variant="outline"
                              className={
                                vq.questionType === "screening"
                                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                  : vq.questionType === "insight"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  : ""
                              }
                            >
                              {vq.questionType}
                            </Badge>
                          )}
                          {vq.isRequired && (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditVQModal(vq)}
                          data-testid={`button-edit-general-vq-${vq.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this vetting question?")) {
                              deleteVQMutation.mutate(vq.id);
                            }
                          }}
                          data-testid={`button-delete-general-vq-${vq.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="existing-experts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Added Advisors
                  </CardTitle>
                  <CardDescription>
                    Existing expert profiles linked to this project. Invite status is tracked internally; no email is sent from this action yet.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="default"
                    onClick={() => setIsExpertSearchModalOpen(true)}
                    data-testid="button-search-experts"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search & Add Experts
                  </Button>
                  <Link href={`/projects/${projectId}/client-shortlist`}>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-client-shortlist"
                    >
                      <FileSearch className="h-4 w-4 mr-2" />
                      Client Shortlist
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportShortlist}
                    disabled={isExportingShortlist}
                    data-testid="button-export-shortlist"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExportingShortlist ? "Exporting..." : "Export Shortlist"}
                  </Button>
                  {projectDetail?.angles && projectDetail.angles.length > 0 && (
                    <Select value={internalExpertsAngleFilter} onValueChange={setInternalExpertsAngleFilter}>
                      <SelectTrigger className="w-[180px]" data-testid="select-angle-filter">
                        <SelectValue placeholder="Filter by Angle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Angles</SelectItem>
                        <SelectItem value="none">No Angle Assigned</SelectItem>
                        {projectDetail.angles.map((angle) => (
                          <SelectItem key={angle.id} value={angle.id.toString()}>
                            {angle.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredInternalExperts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={internalExpertsAngleFilter !== "all" ? "No advisors match this filter" : "No added advisors yet"}
                  description={internalExpertsAngleFilter !== "all" ? "Try selecting a different angle filter." : "Use Search & Add Experts to link existing expert profiles to this project."}
                />
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredInternalExperts.map((pe) => {
                      const angleNames = getAngleBadges(pe);
                      const location = [pe.expert?.city, pe.expert?.country].filter(Boolean).join(", ");
                      const inviteStatus = pe.invitationStatus || "not_invited";
                      return (
                        <Card key={pe.id} data-testid={`card-added-advisor-${pe.id}`}>
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{pe.expert?.name || `Expert #${pe.expertId}`}</p>
                                <p className="text-sm text-muted-foreground">
                                  {pe.expert?.jobTitle || "Current title not set"}
                                  {pe.expert?.company ? ` at ${pe.expert.company}` : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">{location || "Location not set"}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {getAdvisorStatusBadge(pe)}
                                {shouldShowAdvisorInvitationStatus(pe) && getInvitationStatusBadge(inviteStatus)}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">Source: {getAdvisorSourceLabel(pe)}</Badge>
                              {pe.expert?.industry && <Badge variant="outline">{pe.expert.industry}</Badge>}
                              {pe.expert?.expertise && <Badge variant="outline">{pe.expert.expertise}</Badge>}
                              {shouldShowAdvisorPipelineStatus(pe) && getPipelineStatusBadge(pe.pipelineStatus)}
                            </div>

                            {angleNames && angleNames.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {angleNames.map((name, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    <Layers className="h-3 w-3 mr-1" />
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingAdvisor(pe)}
                                data-testid={`button-view-advisor-${pe.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </Button>
                              {hasReviewableApplication(pe) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReviewingApplication(pe)}
                                  data-testid={`button-view-advisor-application-${pe.id}`}
                                >
                                  <ClipboardList className="h-4 w-4 mr-2" />
                                  View Application
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAdvisorInvitedMutation.mutate(pe.id)}
                                disabled={markAdvisorInvitedMutation.isPending || inviteStatus === "invited"}
                                data-testid={`button-invite-advisor-${pe.id}`}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Invite to Project
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExpertMutation.mutate(pe.id)}
                                className="text-destructive"
                                data-testid={`button-remove-advisor-${pe.id}`}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove from Project
                              </Button>
                            </div>

                            {(pe.lastActivityAt || pe.invitedAt) && (
                              <p className="text-xs text-muted-foreground">
                                Last activity: {formatDistanceToNow(new Date(pe.lastActivityAt || pe.invitedAt!), { addSuffix: true })}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Angles</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Invitation Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Pipeline</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">VQ Answers</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Last Activity</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInternalExperts.map((pe) => {
                        const angleNames = getAngleBadges(pe);
                        return (
                          <TableRow key={pe.id} data-testid={`row-internal-expert-${pe.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedInternalExpertIds.has(pe.id)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedInternalExpertIds);
                                  if (checked) {
                                    newSelected.add(pe.id);
                                  } else {
                                    newSelected.delete(pe.id);
                                  }
                                  setSelectedInternalExpertIds(newSelected);
                                }}
                                data-testid={`checkbox-internal-expert-${pe.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{pe.expert?.name || `Expert #${pe.expertId}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {pe.expert?.email} {pe.expert?.jobTitle ? `• ${pe.expert.jobTitle}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {angleNames && angleNames.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {angleNames.map((name, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <Layers className="h-3 w-3 mr-1" />
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
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
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
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
                  {projectDetail.assignedRas.map((ra) => {
                    const raInviteLink = projectDetail.raInviteLinks?.find(
                      (link: any) => link.inviteType === "ra" && link.raId === ra.id
                    );
                    const recruitmentUrl = raInviteLink ? `/r/${raInviteLink.token}` : null;

                    return (
                    <div key={ra.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{ra.fullName}</p>
                          <p className="text-xs text-muted-foreground">{ra.email}</p>
                          {recruitmentUrl && (
                            <p className="text-xs font-mono text-muted-foreground mt-1">{recruitmentUrl}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {recruitmentUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={async () => {
                              await navigator.clipboard.writeText(`${window.location.origin}${recruitmentUrl}`);
                              toast({
                                title: "Link copied",
                                description: "Recruitment link copied to clipboard",
                              });
                            }}
                            data-testid={`button-copy-ra-link-${ra.id}`}
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => regenerateRaInviteLinkMutation.mutate({ raId: ra.id })}
                          disabled={regenerateRaInviteLinkMutation.isPending}
                          data-testid={`button-regenerate-ra-link-${ra.id}`}
                        >
                          <RefreshCw className={`h-3 w-3 ${regenerateRaInviteLinkMutation.isPending ? "animate-spin" : ""}`} />
                          Regenerate
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    RA-Sourced Experts Pipeline
                  </CardTitle>
                  <CardDescription>
                    Experts sourced by RAs through external channels
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickInviteModalOpen(true)}
                  className="gap-2"
                  data-testid="button-quick-invite"
                >
                  <Plus className="h-4 w-4" />
                  Invite New Expert
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const pendingInvites = projectDetail.raInviteLinks?.filter(
                  (link: any) => link.status === "pending_onboarding" || link.status === "onboarded"
                ) || [];
                
                const hasExperts = projectDetail.raSourcedExperts && projectDetail.raSourcedExperts.length > 0;
                const hasPending = pendingInvites.length > 0;
                
                if (!hasExperts && !hasPending) {
                  return (
                    <EmptyState
                      icon={ExternalLink}
                      title="No RA-sourced experts yet"
                      description="Click 'Invite New Expert' to generate an invite link."
                    />
                  );
                }
                
                return (
                  <div className="space-y-6">
                    {hasPending && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          Pending Invites ({pendingInvites.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold uppercase">Candidate</TableHead>
                                <TableHead className="text-xs font-semibold uppercase">Contact</TableHead>
                                <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                                <TableHead className="text-xs font-semibold uppercase">Created</TableHead>
                                <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingInvites.map((invite: any) => (
                                <TableRow key={invite.id} data-testid={`row-pending-invite-${invite.id}`}>
                                  <TableCell>
                                    <p className="font-medium">{invite.candidateName || "Unknown"}</p>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                      {invite.candidateEmail || "-"}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {invite.status === "pending_onboarding" ? "Awaiting Onboarding" : "Awaiting Decision"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {invite.createdAt
                                      ? formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1"
                                      onClick={async () => {
                                        const fullUrl = `${window.location.origin}/r/${invite.token}`;
                                        await navigator.clipboard.writeText(fullUrl);
                                        toast({
                                          title: "Link copied",
                                          description: "Invite link copied to clipboard",
                                        });
                                      }}
                                      data-testid={`button-copy-invite-${invite.id}`}
                                    >
                                      <Copy className="h-3 w-3" />
                                      Copy Link
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    
                    {hasExperts && (
                      <div>
                        {hasPending && (
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Onboarded Experts ({projectDetail.raSourcedExperts?.length || 0})
                          </h4>
                        )}
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
                              {projectDetail.raSourcedExperts?.map((pe) => (
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
                                        <DropdownMenuItem onClick={() => setReviewingApplication(pe)}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          Review application
                                        </DropdownMenuItem>
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
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Project Applications
              </CardTitle>
              <CardDescription>
                Review submitted onboarding forms and project VQ answers from RA-sourced experts or existing advisors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectApplications.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No submitted applications yet"
                  description="Submitted onboarding forms will appear here for RA and PM review."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase">Expert</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Rate</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Consent</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Answers</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Availability</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Conflict Check</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Submitted</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectApplications.map((pe) => (
                        <TableRow key={pe.id} data-testid={`row-project-application-${pe.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pe.expert?.name || `Expert #${pe.expertId}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {pe.expert?.email} {pe.expert?.jobTitle ? `- ${pe.expert.jobTitle}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {pe.expectedHourlyRateUsd ? `$${Number(pe.expectedHourlyRateUsd).toFixed(0)}/hr` : "-"}
                          </TableCell>
                          <TableCell>
                            {pe.termsAccepted && pe.lgpdAccepted ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                Complete
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Missing</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {Array.isArray(pe.vqAnswers) && pe.vqAnswers.length > 0 ? (
                              <Badge variant="outline">{pe.vqAnswers.length} answers</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-sm">
                            {pe.availabilityNote || "-"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-sm">
                            {pe.conflictCheck || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {pe.acceptedAt
                              ? formatDistanceToNow(new Date(pe.acceptedAt), { addSuffix: true })
                              : pe.respondedAt
                              ? formatDistanceToNow(new Date(pe.respondedAt), { addSuffix: true })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewingApplication(pe)}
                              data-testid={`button-review-application-${pe.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Review
                            </Button>
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

        <TabsContent value="consultations" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{projectScheduledCalls}</p>
                    <p className="text-sm text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{projectCompletedCalls}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <DollarSign className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{projectTotalCuUsed.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">CUs Used</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call Records Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Project Consultations
                  </CardTitle>
                  <CardDescription>
                    All calls and consultations for this project
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={consultationStatusFilter}
                    onValueChange={setConsultationStatusFilter}
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-consultation-status-filter">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no-show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isRA && (
                    <Button
                      onClick={() => setIsScheduleCallModalOpen(true)}
                      data-testid="button-schedule-call"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Call
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {callRecordsLoading ? (
                <DataTableSkeleton columns={7} rows={3} />
              ) : !filteredProjectCalls || filteredProjectCalls.length === 0 ? (
                <EmptyState
                  icon={Phone}
                  title="No consultations found"
                  description={
                    consultationStatusFilter !== "all"
                      ? "No calls match the current filter."
                      : "Schedule a call to get started."
                  }
                  action={
                    !isRA ? (
                      <Button onClick={() => setIsScheduleCallModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Call
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expert</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>CU Used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned RA</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjectCalls.map((record) => (
                        <TableRow key={record.id} data-testid={`row-call-record-${record.id}`}>
                          <TableCell className="font-medium">
                            {getExpertNameById(record.expertId)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(record.callDate), "MMM dd, yyyy")}
                            {record.scheduledStartTime && (
                              <span className="block text-xs text-muted-foreground">
                                {format(new Date(record.scheduledStartTime), "HH:mm")}
                                {record.scheduledEndTime && ` - ${format(new Date(record.scheduledEndTime), "HH:mm")}`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {record.actualDurationMinutes || record.durationMinutes} min
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{parseFloat(record.cuUsed || "0").toFixed(2)}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} type="call" />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getRaNameById(record.assignedRaId)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {record.zoomLink && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(record.zoomLink!, "_blank")}
                                  >
                                    <Video className="h-4 w-4 mr-2" />
                                    Join Call
                                  </DropdownMenuItem>
                                )}
                                {!isRA && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedCallRecord(record);
                                      editCallForm.setValue("durationMinutes", record.durationMinutes || 30);
                                      editCallForm.setValue("cuUsed", parseFloat(record.cuUsed || "0.5"));
                                      setIsEditCallModalOpen(true);
                                    }}
                                    data-testid={`button-edit-call-${record.id}`}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Call
                                  </DropdownMenuItem>
                                )}
                                {(record.status === "pending" || record.status === "scheduled") && !isRA && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedCallRecord(record);
                                      completeCallForm.setValue(
                                        "actualDurationMinutes",
                                        record.durationMinutes || 30
                                      );
                                      setIsCompleteCallModalOpen(true);
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark Completed
                                  </DropdownMenuItem>
                                )}
                                {(record.status === "pending" || record.status === "scheduled") && !isRA && (
                                  <DropdownMenuItem
                                    onClick={() => cancelCallMutation.mutate(record.id)}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel Call
                                  </DropdownMenuItem>
                                )}
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

      {/* Angle Modal */}
      <Dialog open={isAngleModalOpen} onOpenChange={setIsAngleModalOpen}>
        <DialogContent className="max-w-md" aria-describedby="angle-modal-description">
          <DialogHeader>
            <DialogTitle>{editingAngle ? "Edit Angle" : "Add Angle"}</DialogTitle>
            <DialogDescription id="angle-modal-description">
              {editingAngle
                ? "Update the angle details"
                : "Create a new angle to organize experts by profile type"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g., Battery Cell Engineers"
                value={angleTitle}
                onChange={(e) => setAngleTitle(e.target.value)}
                data-testid="input-angle-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                placeholder="Brief description of this expert profile type..."
                value={angleDescription}
                onChange={(e) => setAngleDescription(e.target.value)}
                rows={3}
                data-testid="input-angle-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAngleModalOpen(false);
                setEditingAngle(null);
                setAngleTitle("");
                setAngleDescription("");
              }}
              data-testid="button-cancel-angle"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAngle}
              disabled={!angleTitle.trim() || createAngleMutation.isPending || updateAngleMutation.isPending}
              data-testid="button-save-angle"
            >
              {createAngleMutation.isPending || updateAngleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VQ Modal */}
      <Dialog open={isVQModalOpen} onOpenChange={setIsVQModalOpen}>
        <DialogContent className="max-w-lg" aria-describedby="vq-modal-description">
          <DialogHeader>
            <DialogTitle>{editingVQ ? "Edit Vetting Question" : "Add Vetting Question"}</DialogTitle>
            <DialogDescription id="vq-modal-description">
              {editingVQ
                ? "Update the vetting question details"
                : "Add a new question for experts to answer"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question</label>
              <Textarea
                placeholder="Enter your vetting question..."
                value={vqQuestion}
                onChange={(e) => setVQQuestion(e.target.value)}
                rows={3}
                data-testid="input-vq-question"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Question Type</label>
                <Select value={vqQuestionType} onValueChange={(v) => setVQQuestionType(v as "screening" | "insight" | "general")}>
                  <SelectTrigger data-testid="select-vq-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="insight">Insight</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Angle</label>
                <Select 
                  value={vqAngleId?.toString() || "none"} 
                  onValueChange={(v) => setVQAngleId(v === "none" ? null : parseInt(v))}
                >
                  <SelectTrigger data-testid="select-vq-angle">
                    <SelectValue placeholder="Select angle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General (No Angle)</SelectItem>
                    {projectDetail?.angles?.map((angle) => (
                      <SelectItem key={angle.id} value={angle.id.toString()}>
                        {angle.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="vq-required"
                checked={vqIsRequired}
                onCheckedChange={(checked) => setVQIsRequired(!!checked)}
                data-testid="checkbox-vq-required"
              />
              <label htmlFor="vq-required" className="text-sm font-medium cursor-pointer">
                Required question
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsVQModalOpen(false);
                setEditingVQ(null);
                setVQQuestion("");
                setVQAngleId(null);
                setVQQuestionType("insight");
                setVQIsRequired(false);
              }}
              data-testid="button-cancel-vq"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveVQ}
              disabled={!vqQuestion.trim() || createVQMutation.isPending || updateVQMutation.isPending}
              data-testid="button-save-vq"
            >
              {createVQMutation.isPending || updateVQMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Invite Modal */}
      <Dialog open={isBulkInviteModalOpen} onOpenChange={setIsBulkInviteModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invitations</DialogTitle>
            <DialogDescription>
              Send invitations to {selectedInternalExpertIds.size} expert(s){projectDetail?.angles && projectDetail.angles.length > 0 ? " and optionally assign angles" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Angles (Optional)</label>
              <p className="text-xs text-muted-foreground mb-2">Select which angles these experts should be invited for (leave empty to invite without angle assignment)</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {projectDetail?.angles && projectDetail.angles.length > 0 ? (
                  projectDetail.angles.map((angle) => (
                    <div key={angle.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`angle-${angle.id}`}
                        checked={bulkInviteAngleIds.includes(angle.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkInviteAngleIds([...bulkInviteAngleIds, angle.id]);
                          } else {
                            setBulkInviteAngleIds(bulkInviteAngleIds.filter(id => id !== angle.id));
                          }
                        }}
                        data-testid={`checkbox-angle-${angle.id}`}
                      />
                      <label htmlFor={`angle-${angle.id}`} className="text-sm cursor-pointer">
                        {angle.title}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No angles available</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkInviteModalOpen(false)}
              data-testid="button-cancel-bulk-invite"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const peIds = Array.from(selectedInternalExpertIds);
                bulkInviteMutation.mutate({
                  projectExpertIds: peIds,
                  angleIds: bulkInviteAngleIds,
                  channel: "email",
                });
              }}
              disabled={
                selectedInternalExpertIds.size === 0 ||
                bulkInviteMutation.isPending
              }
              data-testid="button-send-bulk-invites"
            >
              {bulkInviteMutation.isPending ? "Sending..." : "Send Invitations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Added Advisor Profile Modal */}
      <Dialog open={!!viewingAdvisor} onOpenChange={(open) => !open && setViewingAdvisor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingAdvisor?.expert?.name || "Advisor profile"}</DialogTitle>
            <DialogDescription>
              Existing expert profile linked to this project.
            </DialogDescription>
          </DialogHeader>
          {viewingAdvisor?.expert && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Email</p>
                  <p className="text-sm">{viewingAdvisor.expert.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Phone</p>
                  <p className="text-sm">{viewingAdvisor.expert.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Current title</p>
                  <p className="text-sm">{viewingAdvisor.expert.jobTitle || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Current company</p>
                  <p className="text-sm">{viewingAdvisor.expert.company || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Location</p>
                  <p className="text-sm">
                    {[viewingAdvisor.expert.city, viewingAdvisor.expert.country].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Hourly rate</p>
                  <p className="text-sm">
                    {viewingAdvisor.expert.hourlyRate ? `$${viewingAdvisor.expert.hourlyRate}/hr` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Industry</p>
                  <p className="text-sm">{viewingAdvisor.expert.industry || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Expertise</p>
                  <p className="text-sm">{viewingAdvisor.expert.expertise || "-"}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Added status</p>
                  <div className="mt-1"><Badge variant="secondary">Added</Badge></div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Invite status</p>
                  <div className="mt-1">{getInvitationStatusBadge(viewingAdvisor.invitationStatus || "not_invited")}</div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pipeline</p>
                  <div className="mt-1">{getPipelineStatusBadge(viewingAdvisor.pipelineStatus)}</div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Bio</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{viewingAdvisor.expert.bio || "No bio added yet."}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Work history</p>
                {Array.isArray(viewingAdvisor.expert.workHistory) && viewingAdvisor.expert.workHistory.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {(viewingAdvisor.expert.workHistory as ExpertWorkHistoryItem[]).map((item, index) => (
                      <div key={index} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{item.company || "Company not set"}</p>
                        <p className="text-sm text-muted-foreground">{item.jobTitle || "Job title not set"}</p>
                        <p className="text-xs text-muted-foreground">{formatWorkHistoryPeriod(item)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No work history added yet.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expert Search Modal */}
      <Dialog open={isExpertSearchModalOpen} onOpenChange={setIsExpertSearchModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Filter Experts</DialogTitle>
            <DialogDescription>
              Use keywords, location, seniority, company scope, and employment period to narrow down experts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4 overflow-y-auto flex-1">
            <div className="space-y-5 rounded-md border p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Biography keywords</label>
                <Input
                  placeholder='e.g. "energy AND logistics NOT oil"'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-query"
                />
                <p className="text-xs text-muted-foreground">Searches name, expertise, title, company, industry, and bio.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    placeholder="Brazil, Japan, United States..."
                    value={searchCountry}
                    onChange={(e) => setSearchCountry(e.target.value)}
                    data-testid="input-search-country"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job title / role</label>
                  <Input
                    placeholder="Director, VP, Manager"
                    value={searchJobTitle}
                    onChange={(e) => setSearchJobTitle(e.target.value)}
                    data-testid="input-search-job-title"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Seniority (work experience)</label>
                <div className="flex flex-wrap gap-2">
                  {seniorityOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={searchSeniority === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => applySeniorityFilter(option.value)}
                      data-testid={`button-seniority-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company name</label>
                  <Input
                    placeholder="e.g. McKinsey, Amazon..."
                    value={searchCompanyName}
                    onChange={(e) => setSearchCompanyName(e.target.value)}
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Scope</label>
                  <Select value={searchCompanyScope} onValueChange={(value) => setSearchCompanyScope(value as typeof searchCompanyScope)}>
                    <SelectTrigger data-testid="select-company-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current role only</SelectItem>
                      <SelectItem value="past">Past roles</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="employment-period-enabled"
                    checked={employmentPeriodEnabled}
                    onCheckedChange={(checked) => setEmploymentPeriodEnabled(checked === true)}
                    data-testid="checkbox-employment-period"
                  />
                  <label htmlFor="employment-period-enabled" className="text-sm font-medium cursor-pointer">
                    Employment period
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Filter for experts who were at the selected company during this month-level range.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start</label>
                    <div className="flex gap-2">
                      <Select value={employmentStartMonth} onValueChange={setEmploymentStartMonth} disabled={!employmentPeriodEnabled}>
                        <SelectTrigger data-testid="select-employment-start-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthLabels.map((month, index) => (
                            <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1970}
                        max={currentDate.getFullYear()}
                        value={employmentStartYear}
                        onChange={(e) => setEmploymentStartYear(e.target.value)}
                        disabled={!employmentPeriodEnabled}
                        data-testid="input-employment-start-year"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End</label>
                    {isCurrentRoleScope ? (
                      <div
                        className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground"
                        data-testid="text-employment-end-present"
                      >
                        Present
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Select value={employmentEndMonth} onValueChange={setEmploymentEndMonth} disabled={!employmentPeriodEnabled}>
                          <SelectTrigger data-testid="select-employment-end-month">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthLabels.map((month, index) => (
                              <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1970}
                          max={currentDate.getFullYear()}
                          value={employmentEndYear}
                          onChange={(e) => setEmploymentEndYear(e.target.value)}
                          disabled={!employmentPeriodEnabled}
                          data-testid="input-employment-end-year"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Industry / sector</label>
                  <Input
                    placeholder="Energy, Mining, Healthcare"
                    value={searchIndustry}
                    onChange={(e) => setSearchIndustry(e.target.value)}
                    data-testid="input-search-industry"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Input
                    placeholder="English, Portuguese, Spanish"
                    value={searchLanguage}
                    onChange={(e) => setSearchLanguage(e.target.value)}
                    data-testid="input-search-language"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min hours worked</label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={searchMinHoursWorked}
                    onChange={(e) => setSearchMinHoursWorked(e.target.value)}
                    data-testid="input-min-hours-worked"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="available-only-redesign"
                    checked={searchAvailableOnly}
                    onCheckedChange={(checked) => setSearchAvailableOnly(checked === true)}
                    data-testid="checkbox-available-only-redesign"
                  />
                  <label htmlFor="available-only-redesign" className="text-sm font-medium cursor-pointer">
                    Available experts only
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="prior-projects-redesign"
                    checked={searchHasPriorProjects}
                    onCheckedChange={(checked) => setSearchHasPriorProjects(checked === true)}
                    data-testid="checkbox-prior-projects-redesign"
                  />
                  <label htmlFor="prior-projects-redesign" className="text-sm font-medium cursor-pointer">
                    Prior project involvement
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Min accept rate (%)</label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={searchMinAcceptanceRate}
                    onChange={(e) => setSearchMinAcceptanceRate(e.target.value)}
                    className="h-8 w-20"
                    data-testid="input-min-acceptance-rate-redesign"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchQuery("");
                  setSearchCompanyName("");
                  setSearchCompanyScope("any");
                  setEmploymentPeriodEnabled(false);
                  setEmploymentStartMonth("1");
                  setEmploymentStartYear("1990");
                  setEmploymentEndMonth(currentMonthValue);
                  setEmploymentEndYear(currentYearValue);
                  applySeniorityFilter("any");
                  setSearchCountry("");
                  setSearchJobTitle("");
                  setSearchIndustry("");
                  setSearchLanguage("");
                  setSearchAvailableOnly(false);
                  setSearchMinHoursWorked("");
                  setSearchMinAcceptanceRate("");
                  setSearchHasPriorProjects(false);
                }}
                data-testid="button-clear-expert-filters"
              >
                Clear all filters
              </Button>
              <Button
                type="button"
                onClick={() => refetchExpertSearch()}
                data-testid="button-apply-expert-filters"
              >
                Apply filters
              </Button>
            </div>

            <div className="hidden">
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Keywords / Expertise</label>
                  <Input
                    placeholder="Search by name, skills, bio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-query"
                  />
                  <p className="text-xs text-muted-foreground">Multiple keywords separated by space or comma</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Current Employer</label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-current-employer"
                        checked={includeCurrentEmployer}
                        onCheckedChange={(checked) => setIncludeCurrentEmployer(checked === true)}
                        data-testid="checkbox-include-current-employer"
                      />
                      <label htmlFor="include-current-employer" className="text-xs text-muted-foreground">
                        Search current employer
                      </label>
                    </div>
                  </div>
                  <Input
                    placeholder="e.g., Google, Tesla"
                    value={searchCurrentEmployer}
                    onChange={(e) => setSearchCurrentEmployer(e.target.value)}
                    disabled={!includeCurrentEmployer}
                    data-testid="input-current-employer"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Past Employers</label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-past-employers"
                        checked={includePastEmployers}
                        onCheckedChange={(checked) => setIncludePastEmployers(checked === true)}
                        data-testid="checkbox-include-past-employers"
                      />
                      <label htmlFor="include-past-employers" className="text-xs text-muted-foreground">
                        Search past employers
                      </label>
                    </div>
                  </div>
                  <Input
                    placeholder="e.g., Apple, Microsoft, Amazon"
                    value={searchPastEmployers}
                    onChange={(e) => setSearchPastEmployers(e.target.value)}
                    disabled={!includePastEmployers}
                    data-testid="input-past-employers"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of company names</p>
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Employment Period</label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employment-period-enabled"
                        checked={employmentPeriodEnabled}
                        onCheckedChange={(checked) => setEmploymentPeriodEnabled(checked === true)}
                        data-testid="checkbox-employment-period"
                      />
                      <label htmlFor="employment-period-enabled" className="text-xs text-muted-foreground">
                        Filter by period
                      </label>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={maxEmploymentMonthIndex}
                    step={1}
                    value={employmentPeriodRange}
                    onValueChange={(value) => setEmploymentPeriodRange(value as [number, number])}
                    disabled={!employmentPeriodEnabled}
                    data-testid="slider-employment-period"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatEmploymentMonthIndex(employmentPeriodRange[0])}</span>
                    <span>{formatEmploymentMonthIndex(employmentPeriodRange[1])}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Applies only when a current or past employer search term is entered.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Years of Experience</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={searchMinExp}
                      onChange={(e) => setSearchMinExp(e.target.value)}
                      data-testid="input-min-exp"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={searchMaxExp}
                      onChange={(e) => setSearchMaxExp(e.target.value)}
                      data-testid="input-max-exp"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="available-only"
                    checked={searchAvailableOnly}
                    onCheckedChange={(checked) => setSearchAvailableOnly(checked === true)}
                    data-testid="checkbox-available-only"
                  />
                  <label htmlFor="available-only" className="text-sm font-medium cursor-pointer">
                    Only show currently available experts
                  </label>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country / Location</label>
                  <Input
                    placeholder="e.g., Brazil, São Paulo, Rio"
                    value={searchCountry}
                    onChange={(e) => setSearchCountry(e.target.value)}
                    data-testid="input-search-country"
                  />
                  <p className="text-xs text-muted-foreground">Multiple locations separated by commas</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Title / Role</label>
                  <Input
                    placeholder="e.g., Director, VP, Manager"
                    value={searchJobTitle}
                    onChange={(e) => setSearchJobTitle(e.target.value)}
                    data-testid="input-search-job-title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Industry / Sector</label>
                  <Input
                    placeholder="e.g., Energy, Mining, Healthcare"
                    value={searchIndustry}
                    onChange={(e) => setSearchIndustry(e.target.value)}
                    data-testid="input-search-industry"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of industries</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Input
                    placeholder="e.g., English, Portuguese, Spanish"
                    value={searchLanguage}
                    onChange={(e) => setSearchLanguage(e.target.value)}
                    data-testid="input-search-language"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of languages</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Hours Worked</label>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      value={searchMinHoursWorked}
                      onChange={(e) => setSearchMinHoursWorked(e.target.value)}
                      data-testid="input-min-hours-worked"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Accept Rate (%)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 50"
                      value={searchMinAcceptanceRate}
                      onChange={(e) => setSearchMinAcceptanceRate(e.target.value)}
                      data-testid="input-min-acceptance-rate"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="prior-projects"
                    checked={searchHasPriorProjects}
                    onCheckedChange={(checked) => setSearchHasPriorProjects(checked === true)}
                    data-testid="checkbox-prior-projects"
                  />
                  <label htmlFor="prior-projects" className="text-sm font-medium cursor-pointer">
                    Only show experts with prior project involvement
                  </label>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {expertSearchLoading ? "Searching..." : `${expertSearchResults?.length || 0} experts found`}
                </p>
              </div>
              {expertSearchLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading results...</p>
              )}
              {!expertSearchLoading && expertSearchResults && expertSearchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No experts match your filters</p>
              )}
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {expertSearchResults?.map((expert: ExpertWithMetrics) => {
                  const isAssigned = assignedExpertIds.has(expert.id);
                  return (
                    <Card key={expert.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid={`text-expert-name-${expert.id}`}>{expert.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{expert.jobTitle || expert.expertise} {expert.company ? `at ${expert.company}` : ""}</p>
                          {expert.matchedWorkHistory && expert.matchedWorkHistory.length > 0 && (
                            <div className="mt-2 space-y-1 rounded-md bg-muted/40 p-2">
                              {expert.matchedWorkHistory.slice(0, 2).map((item, index) => (
                                <p key={`${item.company}-${item.jobTitle}-${index}`} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{item.company || "Unknown company"}</span>
                                  {item.jobTitle ? ` | ${item.jobTitle}` : ""}
                                  {" | "}
                                  {formatWorkHistoryPeriod(item)}
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {expert.country && (
                              <Badge variant="secondary" className="text-xs">{expert.country}</Badge>
                            )}
                            {expert.yearsOfExperience && (
                              <Badge variant="secondary" className="text-xs">{expert.yearsOfExperience}y exp</Badge>
                            )}
                            {expert.industry && (
                              <Badge variant="secondary" className="text-xs">{expert.industry}</Badge>
                            )}
                            {expert.priorProjectCount !== undefined && expert.priorProjectCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {expert.priorProjectCount} prior project{expert.priorProjectCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {expert.acceptanceRate !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                {expert.acceptanceRate}% accept rate
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {!isAssigned && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => attachExpertMutation.mutate(expert.id)}
                              disabled={attachExpertMutation.isPending}
                              data-testid={`button-attach-expert-${expert.id}`}
                            >
                              {attachExpertMutation.isPending ? "..." : "Attach"}
                            </Button>
                          )}
                          {isAssigned && (
                            <Badge variant="outline" className="text-xs">Already in Project</Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExpertSearchModalOpen(false);
                setSearchQuery("");
                setSearchCurrentEmployer("");
                setSearchPastEmployers("");
                setIncludeCurrentEmployer(true);
                setIncludePastEmployers(true);
                setEmploymentPeriodEnabled(false);
                setEmploymentPeriodRange([0, maxEmploymentMonthIndex]);
                setSearchCountry("");
                setSearchMinExp("");
                setSearchMaxExp("");
                setSearchJobTitle("");
                setSearchIndustry("");
                setSearchLanguage("");
                setSearchAvailableOnly(false);
                setSearchMinHoursWorked("");
                setSearchMinAcceptanceRate("");
                setSearchHasPriorProjects(false);
              }}
              data-testid="button-close-search"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickInviteModalOpen} onOpenChange={setIsQuickInviteModalOpen}>
        <DialogContent className="max-w-md" aria-describedby="quick-invite-description">
          <DialogDescription id="quick-invite-description" className="sr-only">
            Generate a quick invite link for a new candidate
          </DialogDescription>
          <QuickInviteForm
            projectId={projectId}
            onSuccess={() => {
              refetchProject();
              queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
            }}
            onCancel={() => setIsQuickInviteModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewingApplication} onOpenChange={(open) => !open && setReviewingApplication(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submitted Application</DialogTitle>
            <DialogDescription>
              Review the expert's public onboarding details and project answers.
            </DialogDescription>
          </DialogHeader>
          {reviewingApplication && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Full name</p>
                  <p className="font-medium">{reviewingApplication.expert?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{reviewingApplication.expert?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone / WhatsApp</p>
                  <p className="font-medium">{reviewingApplication.expert?.whatsapp || reviewingApplication.expert?.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {[reviewingApplication.expert?.city, reviewingApplication.expert?.country].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current title</p>
                  <p className="font-medium">{reviewingApplication.expert?.jobTitle || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current company</p>
                  <p className="font-medium">{reviewingApplication.expert?.company || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected hourly rate</p>
                  <p className="font-mono font-medium">
                    {reviewingApplication.expectedHourlyRateUsd ? `$${Number(reviewingApplication.expectedHourlyRateUsd).toFixed(0)}/hr` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sourced by</p>
                  <p className="font-medium">{reviewingApplication.sourcedByRa?.fullName || "-"}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Bio</h3>
                <p className="whitespace-pre-wrap rounded-md border p-3 text-sm text-muted-foreground">
                  {reviewingApplication.expert?.bio || "No bio added yet."}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Work history</h3>
                {reviewedWorkHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No work history submitted.</p>
                ) : (
                  <div className="space-y-2">
                    {reviewedWorkHistory.map((item, index) => (
                      <div key={index} className="rounded-md border p-3">
                        <p className="font-medium">{item.jobTitle || "-"}</p>
                        <p className="text-sm text-muted-foreground">{item.company || "-"}</p>
                        <p className="text-xs text-muted-foreground">{formatWorkHistoryPeriod(item)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Availability</h3>
                  <p className="whitespace-pre-wrap rounded-md border p-3 text-sm">
                    {reviewingApplication.availabilityNote || "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Conflict check</h3>
                  <p className="whitespace-pre-wrap rounded-md border p-3 text-sm">
                    {reviewingApplication.conflictCheck || "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Vetting question answers</h3>
                {reviewedAnswers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vetting answers submitted.</p>
                ) : (
                  <div className="space-y-2">
                    {reviewedAnswers.map((answer, index) => (
                      <div key={index} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{answer.questionText || `Question ${index + 1}`}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{answer.answerText || "-"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingApplication(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Call Modal */}
      <Dialog open={isScheduleCallModalOpen} onOpenChange={setIsScheduleCallModalOpen}>
        <DialogContent className="max-w-md" aria-describedby="schedule-call-description">
          <DialogHeader>
            <DialogTitle>Schedule Consultation</DialogTitle>
            <DialogDescription id="schedule-call-description">
              Schedule a new consultation call for this project
            </DialogDescription>
          </DialogHeader>
          <Form {...scheduleCallForm}>
            <form onSubmit={scheduleCallForm.handleSubmit(onScheduleCallSubmit)} className="space-y-4">
              <FormField
                control={scheduleCallForm.control}
                name="expertId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expert</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(parseInt(v))}
                      >
                        <SelectTrigger data-testid="select-schedule-expert">
                          <SelectValue placeholder="Select expert" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const projectExpertIds = new Set([
                              ...(projectDetail?.internalExperts?.map((pe) => pe.expertId) || []),
                              ...(projectDetail?.raSourcedExperts?.map((pe) => pe.expertId) || []),
                            ]);
                            const projectExperts = allExperts?.filter((e) =>
                              projectExpertIds.has(e.id)
                            );
                            return projectExperts?.map((expert) => (
                              <SelectItem key={expert.id} value={String(expert.id)}>
                                {expert.name}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={scheduleCallForm.control}
                name="callDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-schedule-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={scheduleCallForm.control}
                  name="scheduledStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-schedule-start-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleCallForm.control}
                  name="scheduledEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-schedule-end-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={scheduleCallForm.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        data-testid="input-schedule-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={scheduleCallForm.control}
                name="zoomLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Link (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://zoom.us/..."
                        {...field}
                        data-testid="input-schedule-zoom-link"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={scheduleCallForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Call agenda, topics to cover..."
                        {...field}
                        data-testid="input-schedule-notes"
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
                  onClick={() => {
                    setIsScheduleCallModalOpen(false);
                    scheduleCallForm.reset();
                  }}
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCallMutation.isPending}
                  data-testid="button-confirm-schedule"
                >
                  {createCallMutation.isPending ? "Scheduling..." : "Schedule Call"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Complete Call Modal */}
      <Dialog open={isCompleteCallModalOpen} onOpenChange={setIsCompleteCallModalOpen}>
        <DialogContent className="max-w-md" aria-describedby="complete-call-description">
          <DialogHeader>
            <DialogTitle>Complete Consultation</DialogTitle>
            <DialogDescription id="complete-call-description">
              Mark this consultation as completed and record the actual duration
            </DialogDescription>
          </DialogHeader>
          <Form {...completeCallForm}>
            <form onSubmit={completeCallForm.handleSubmit(onCompleteCallSubmit)} className="space-y-4">
              {selectedCallRecord && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium">{getExpertNameById(selectedCallRecord.expertId)}</p>
                  <p className="text-xs text-muted-foreground">
                    Scheduled: {format(new Date(selectedCallRecord.callDate), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
              <FormField
                control={completeCallForm.control}
                name="actualDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        data-testid="input-complete-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeCallForm.control}
                name="recordingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recording URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        {...field}
                        data-testid="input-complete-recording"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={completeCallForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Call summary, key takeaways..."
                        {...field}
                        data-testid="input-complete-notes"
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
                  onClick={() => {
                    setIsCompleteCallModalOpen(false);
                    setSelectedCallRecord(null);
                    completeCallForm.reset();
                  }}
                  data-testid="button-cancel-complete"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={completeCallMutation.isPending}
                  data-testid="button-confirm-complete"
                >
                  {completeCallMutation.isPending ? "Completing..." : "Mark Completed"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Call Modal */}
      <Dialog open={isEditCallModalOpen} onOpenChange={setIsEditCallModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Consultation</DialogTitle>
            <DialogDescription>
              Update the duration and CU usage for this consultation.
              CU auto-calculates based on duration (1 CU = 60 min, billed in 0.25 CU / 15 min increments).
            </DialogDescription>
          </DialogHeader>
          <Form {...editCallForm}>
            <form onSubmit={editCallForm.handleSubmit(onEditCallSubmit)} className="space-y-4">
              <FormField
                control={editCallForm.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value) || 0;
                          field.onChange(minutes);
                          // Auto-calculate CU when duration changes
                          const calculatedCu = calculateCuFromDuration(minutes);
                          editCallForm.setValue("cuUsed", calculatedCu);
                        }}
                        data-testid="input-edit-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCallForm.control}
                name="cuUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CU Used (manual override allowed)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.25"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-edit-cu"
                      />
                    </FormControl>
                    <FormDescription>
                      Auto-calculated: {calculateCuFromDuration(editCallForm.watch("durationMinutes"))} CU. 
                      Override if needed (must be in 0.25 increments).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditCallModalOpen(false);
                    setSelectedCallRecord(null);
                    editCallForm.reset();
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editCallMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {editCallMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
