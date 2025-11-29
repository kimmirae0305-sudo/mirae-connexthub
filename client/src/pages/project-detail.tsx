import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DataTableSkeleton } from "@/components/data-table-skeleton";
import type { Project, Expert, VettingQuestion, ProjectExpert, ProjectActivity, ProjectAngle } from "@shared/schema";

interface EnrichedExpert extends ProjectExpert {
  expert?: Expert;
  sourcedByRa?: { id: number; fullName: string } | null;
}

interface ProjectDetailData extends Project {
  createdByPm?: { id: number; fullName: string; email: string } | null;
  assignedRas?: { id: number; fullName: string; email: string }[];
  vettingQuestions?: VettingQuestion[];
  internalExperts?: EnrichedExpert[];
  raSourcedExperts?: EnrichedExpert[];
  activities?: ProjectActivity[];
  raInviteLinks?: any[];
  angles?: ProjectAngle[];
}

interface RAUser {
  id: number;
  fullName: string;
  email: string;
}

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
  const [searchCountry, setSearchCountry] = useState("");
  const [searchMinExp, setSearchMinExp] = useState("");
  const [searchMaxExp, setSearchMaxExp] = useState("");
  const [searchJobTitle, setSearchJobTitle] = useState("");
  const [searchIndustry, setSearchIndustry] = useState("");

  const { data: projectDetail, isLoading: projectLoading, refetch: refetchProject } = useQuery<ProjectDetailData>({
    queryKey: ["/api/projects", projectId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/detail`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: allRAs } = useQuery<RAUser[]>({
    queryKey: ["/api/users/ras"],
  });

  const { data: allExperts } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  // Expert search results query
  const { data: expertSearchResults, isLoading: expertSearchLoading } = useQuery<Expert[]>({
    queryKey: [
      "/api/experts/search",
      { query: searchQuery, country: searchCountry, minExp: searchMinExp, maxExp: searchMaxExp, jobTitle: searchJobTitle, industry: searchIndustry },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      if (searchCountry) params.append("country", searchCountry);
      if (searchMinExp) params.append("minYearsExperience", searchMinExp);
      if (searchMaxExp) params.append("maxYearsExperience", searchMaxExp);
      if (searchJobTitle) params.append("jobTitle", searchJobTitle);
      if (searchIndustry) params.append("industry", searchIndustry);
      const res = await fetch(`/api/experts/search?${params}`, {
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

  const generateRaInviteLinkMutation = useMutation({
    mutationFn: async ({ raId }: { raId: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/ra-invite-link`, { raId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(data.inviteUrl);
      toast({ title: "RA invite link copied to clipboard" });
      setTimeout(() => setCopiedLink(null), 3000);
    },
    onError: () => {
      toast({ title: "Failed to generate RA invite link", variant: "destructive" });
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

  const bulkInviteMutation = useMutation({
    mutationFn: async (data: { projectExpertIds: number[]; angleIds: number[]; channel?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/invitations/bulk-send`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "detail"] });
      setSelectedInternalExpertIds(new Set());
      setBulkInviteAngleIds([]);
      setIsBulkInviteModalOpen(false);
      toast({ title: "Invitations sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send invitations", variant: "destructive" });
    },
  });

  const attachExpertMutation = useMutation({
    mutationFn: async (expertId: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/attach-experts`, {
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

  // Filter internal experts by angle
  const filteredInternalExperts = useMemo(() => {
    const experts = projectDetail?.internalExperts || [];
    if (internalExpertsAngleFilter === "all") return experts;
    if (internalExpertsAngleFilter === "none") {
      return experts.filter(pe => !pe.angleIds || pe.angleIds.length === 0);
    }
    const angleId = parseInt(internalExpertsAngleFilter);
    return experts.filter(pe => pe.angleIds?.includes(angleId));
  }, [projectDetail?.internalExperts, internalExpertsAngleFilter]);

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
      default:
        return <Badge variant="secondary">-</Badge>;
    }
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
            <h1 className="text-2xl font-semibold text-foreground">{projectDetail.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={projectDetail.status} type="project" />
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
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="angles-vq" data-testid="tab-angles-vq">
            Angles & VQ {projectDetail.angles?.length ? `(${projectDetail.angles.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="existing-experts" data-testid="tab-existing-experts">
            Existing Experts {projectDetail.internalExperts?.length ? `(${projectDetail.internalExperts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ra-sourcing" data-testid="tab-ra-sourcing">
            RA Sourcing {projectDetail.raSourcedExperts?.length ? `(${projectDetail.raSourcedExperts.length})` : ""}
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
                    <p className="font-medium">{projectDetail.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="font-medium">{projectDetail.industry}</p>
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
                    <p className="font-medium">
                      {projectDetail.startDate
                        ? format(new Date(projectDetail.startDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {projectDetail.dueDate
                        ? format(new Date(projectDetail.dueDate), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CU Used</p>
                    <p className="font-mono font-medium">{parseFloat(projectDetail.totalCuUsed || "0").toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rate per CU</p>
                    <p className="font-mono font-medium">${parseFloat(projectDetail.cuRatePerCU || "1150").toFixed(0)}</p>
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

          {projectDetail.projectOverview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectDetail.projectOverview}</p>
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
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Internal Expert Database
              </CardTitle>
              <CardDescription>
                Search and invite experts from the internal database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Use the "Search & Add" button above to find and add experts from the database</p>

              {selectedExperts.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">{selectedExperts.size} expert(s) selected</span>
                  <Button
                    onClick={handleAttachExperts}
                    disabled={attachExpertsMutation.isPending}
                    data-testid="button-attach-experts"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {attachExpertsMutation.isPending ? "Attaching..." : "Add to Project"}
                  </Button>
                </div>
              )}

              {!expertsToShow || expertsToShow.length === 0 ? (
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
                                <Badge variant="secondary">In Project</Badge>
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Internal Experts Pipeline
                  </CardTitle>
                  <CardDescription>
                    Experts from internal database assigned to this project
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExpertSearchModalOpen(true)}
                    data-testid="button-search-experts"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search & Add
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
                  title={internalExpertsAngleFilter !== "all" ? "No experts match this filter" : "No internal experts yet"}
                  description={internalExpertsAngleFilter !== "all" ? "Try selecting a different angle filter." : "Use the search above to add experts from your database."}
                />
              ) : (
                <div className="space-y-3">
                  {selectedInternalExpertIds.size > 0 && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm">{selectedInternalExpertIds.size} expert(s) selected</span>
                      <Button
                        onClick={() => setIsBulkInviteModalOpen(true)}
                        disabled={bulkInviteMutation.isPending}
                        size="sm"
                        data-testid="button-create-invitations"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {bulkInviteMutation.isPending ? "Creating..." : "Create Invitations"}
                      </Button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
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
                  {projectDetail.assignedRas.map((ra) => (
                    <div key={ra.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{ra.fullName}</p>
                          <p className="text-xs text-muted-foreground">{ra.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateRaInviteLinkMutation.mutate({ raId: ra.id })}
                        disabled={generateRaInviteLinkMutation.isPending}
                        data-testid={`button-ra-invite-${ra.id}`}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy Invite Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                RA-Sourced Experts Pipeline
              </CardTitle>
              <CardDescription>
                Experts sourced by RAs through external channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!projectDetail.raSourcedExperts || projectDetail.raSourcedExperts.length === 0 ? (
                <EmptyState
                  icon={ExternalLink}
                  title="No RA-sourced experts yet"
                  description="Experts onboarded through RA invite links will appear here."
                />
              ) : (
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
                      {projectDetail.raSourcedExperts.map((pe) => (
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
              Select angles to assign to {selectedInternalExpertIds.size} expert(s) and send invitations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Angles</label>
              <p className="text-xs text-muted-foreground mb-2">Select which angles these experts should be invited for</p>
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

      {/* Expert Search Modal */}
      <Dialog open={isExpertSearchModalOpen} onOpenChange={setIsExpertSearchModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Search & Add Experts</DialogTitle>
            <DialogDescription>
              Find experts from your database with advanced filters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Keywords / Expertise</label>
                <Input
                  placeholder="Search by name, expertise, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-query"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Country / Location</label>
                <Input
                  placeholder="e.g., Brazil, São Paulo"
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  data-testid="input-search-country"
                />
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Title</label>
                <Input
                  placeholder="e.g., Director, Manager"
                  value={searchJobTitle}
                  onChange={(e) => setSearchJobTitle(e.target.value)}
                  data-testid="input-search-job-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <Input
                  placeholder="e.g., Finance, Healthcare"
                  value={searchIndustry}
                  onChange={(e) => setSearchIndustry(e.target.value)}
                  data-testid="input-search-industry"
                />
              </div>
            </div>

            {/* Results */}
            <div className="space-y-3 border-t pt-4">
              {expertSearchLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading results...</p>
              )}
              {!expertSearchLoading && expertSearchResults && expertSearchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No experts match your filters</p>
              )}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {expertSearchResults?.map((expert: Expert) => {
                  const isAssigned = assignedExpertIds.has(expert.id);
                  return (
                    <Card key={expert.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid={`text-expert-name-${expert.id}`}>{expert.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{expert.jobTitle || expert.expertise}</p>
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
                setSearchCountry("");
                setSearchMinExp("");
                setSearchMaxExp("");
                setSearchJobTitle("");
                setSearchIndustry("");
              }}
              data-testid="button-close-search"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
