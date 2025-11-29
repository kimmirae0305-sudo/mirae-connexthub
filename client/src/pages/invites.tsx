import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Filter,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  X,
  Clock,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExpertInvitationLink, Project, Expert } from "@shared/schema";

interface InviteWithDetails extends ExpertInvitationLink {
  project?: Project;
  expert?: Expert;
}

export default function Invites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const normalizedRole = normalizeRole(user?.role);
  const isRa = normalizedRole === "ra";
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: invites = [], isLoading: invitesLoading, refetch } = useQuery<InviteWithDetails[]>({
    queryKey: ["/api/invitation-links"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: experts = [] } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const resendMutation = useMutation({
    mutationFn: async (invite: InviteWithDetails) => {
      if (!invite.projectId) {
        throw new Error("Cannot resend invite without project");
      }
      
      if (invite.expertId) {
        const projectExpertsResponse = await fetch(`/api/projects/${invite.projectId}/detail`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
        });
        if (!projectExpertsResponse.ok) throw new Error("Failed to find project expert");
        const projectDetail = await projectExpertsResponse.json();
        const projectExpert = projectDetail.internalExperts?.find(
          (pe: any) => pe.expertId === invite.expertId
        );
        if (projectExpert) {
          return apiRequest("POST", `/api/project-experts/${projectExpert.id}/invite`);
        }
        throw new Error("Expert not assigned to this project");
      }
      
      if (invite.inviteType === "ra" && invite.raId) {
        return apiRequest("POST", `/api/projects/${invite.projectId}/ra-invite-link`, {
          raId: invite.raId
        });
      }
      
      throw new Error("Cannot resend this type of invite");
    },
    onSuccess: () => {
      toast({
        title: "New Invitation Created",
        description: "A new invitation link has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitation-links"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Resend",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const enrichedInvites = useMemo(() => {
    return invites.map(invite => ({
      ...invite,
      project: projects.find(p => p.id === invite.projectId),
      expert: experts.find(e => e.id === invite.expertId),
    }));
  }, [invites, projects, experts]);

  const filteredInvites = useMemo(() => {
    return enrichedInvites.filter(invite => {
      if (statusFilter !== "all" && invite.status !== statusFilter) {
        return false;
      }
      
      if (projectFilter !== "all" && invite.projectId?.toString() !== projectFilter) {
        return false;
      }
      
      if (dateFrom && new Date(invite.createdAt) < dateFrom) {
        return false;
      }
      
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (new Date(invite.createdAt) > endOfDay) {
          return false;
        }
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const expertName = invite.expert?.name?.toLowerCase() || "";
        const candidateName = invite.candidateName?.toLowerCase() || "";
        const candidateEmail = invite.candidateEmail?.toLowerCase() || "";
        const projectName = invite.project?.name?.toLowerCase() || "";
        
        if (!expertName.includes(search) && 
            !candidateName.includes(search) && 
            !candidateEmail.includes(search) &&
            !projectName.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  }, [enrichedInvites, statusFilter, projectFilter, dateFrom, dateTo, searchTerm]);

  const getStatusBadge = (status: string, isActive: boolean, expiresAt: Date | null) => {
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    
    if (isExpired && status === "pending") {
      return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
    }
    
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Accepted</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "pending":
        return isActive 
          ? <Badge variant="secondary">Pending</Badge>
          : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInviteTypeBadge = (inviteType: string) => {
    switch (inviteType) {
      case "ra":
        return <Badge variant="outline" className="text-blue-600 border-blue-300">RA Sourcing</Badge>;
      case "existing":
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Existing Expert</Badge>;
      case "general":
        return <Badge variant="outline">General</Badge>;
      default:
        return <Badge variant="outline">{inviteType}</Badge>;
    }
  };

  const copyInviteLink = async (invite: InviteWithDetails) => {
    const baseUrl = window.location.origin;
    let inviteUrl: string;
    
    if (invite.inviteType === "existing" && invite.expertId) {
      inviteUrl = `${baseUrl}/expert/project-invite/${invite.token}`;
    } else if (invite.projectId) {
      inviteUrl = `${baseUrl}/invite/${invite.projectId}/${invite.inviteType}/${invite.token}`;
    } else {
      inviteUrl = `${baseUrl}/expert-invite/${invite.token}`;
    }
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(invite.token);
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard.",
      });
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setProjectFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || projectFilter !== "all" || dateFrom || dateTo;

  const stats = useMemo(() => {
    const total = enrichedInvites.length;
    const pending = enrichedInvites.filter(i => i.status === "pending" && i.isActive).length;
    const accepted = enrichedInvites.filter(i => i.status === "accepted").length;
    const declined = enrichedInvites.filter(i => i.status === "declined").length;
    const expired = enrichedInvites.filter(i => 
      i.status === "pending" && i.expiresAt && new Date(i.expiresAt) < new Date()
    ).length;
    
    return { total, pending, accepted, declined, expired };
  }, [enrichedInvites]);

  if (invitesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            {isRa ? "My Invitations" : "Invitation History"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRa 
              ? "Track invitations you've created for expert sourcing" 
              : "Manage and track all expert invitation links"}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-refresh-invites"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-invites">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-invites">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-accepted-invites">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Declined</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-declined-invites">{stats.declined}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">All Invitations</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-invites"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-project-filter">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[130px]" data-testid="button-date-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    Date Range
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">From Date</p>
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">To Date</p>
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                      className="w-full"
                    >
                      Clear Dates
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No invitations found</h3>
              <p className="text-muted-foreground mt-1">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results." 
                  : "Invitations will appear here once they are created."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert / Candidate</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvites.map((invite) => (
                    <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invite.expert?.name || invite.candidateName || "Unknown"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invite.expert?.email || invite.candidateEmail || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invite.project?.name || (
                          <span className="text-muted-foreground">No project</span>
                        )}
                      </TableCell>
                      <TableCell>{getInviteTypeBadge(invite.inviteType)}</TableCell>
                      <TableCell>
                        {getStatusBadge(invite.status || "pending", invite.isActive, invite.expiresAt)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invite.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {invite.expiresAt 
                          ? format(new Date(invite.expiresAt), "MMM d, yyyy")
                          : <span className="text-muted-foreground">Never</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${invite.id}`}>
                              Actions
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => copyInviteLink(invite)}
                              data-testid={`action-copy-link-${invite.id}`}
                            >
                              {copiedToken === invite.token ? (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Link
                                </>
                              )}
                            </DropdownMenuItem>
                            {invite.status === "pending" && invite.isActive && invite.projectId && (
                              <DropdownMenuItem
                                onClick={() => resendMutation.mutate(invite)}
                                disabled={resendMutation.isPending}
                                data-testid={`action-resend-${invite.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 mr-2 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                                Create New Invite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                              <a 
                                href={invite.inviteType === "existing" && invite.expertId 
                                  ? `/expert/project-invite/${invite.token}`
                                  : invite.projectId 
                                    ? `/invite/${invite.projectId}/${invite.inviteType}/${invite.token}`
                                    : `/expert-invite/${invite.token}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`action-view-link-${invite.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Link
                              </a>
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
          
          {filteredInvites.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredInvites.length} of {enrichedInvites.length} invitations
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
