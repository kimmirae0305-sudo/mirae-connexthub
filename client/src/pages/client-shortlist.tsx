import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Download, 
  Briefcase, 
  MapPin, 
  Clock, 
  Calendar,
  User,
  MessageSquare,
  Building2,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface AvailabilitySlot {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface EmploymentHistory {
  company: string;
  jobTitle: string;
  fromYear: number;
  toYear: number;
}

interface VettingAnswer {
  questionId: number;
  questionText: string;
  answerText: string | null;
  angleName: string | null;
}

interface ExpertProfile {
  name: string;
  email: string;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  timezone: string | null;
  yearsOfExperience: number | null;
  industry: string | null;
  expertise: string | null;
  biography: string | null;
}

interface ClientShortlistExpert {
  projectExpertId: number;
  expertId: number;
  pipelineStatus: string;
  angles: string[];
  respondedAt: string | null;
  profile: ExpertProfile;
  employmentHistory: EmploymentHistory[];
  vettingAnswers: VettingAnswer[];
  availability: {
    note: string | null;
    slots: AvailabilitySlot[];
  };
}

interface ClientShortlistResponse {
  projectId: number;
  projectTitle: string;
  totalExperts: number;
  experts: ClientShortlistExpert[];
}

export default function ClientShortlistPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: shortlistData, isLoading, error } = useQuery<ClientShortlistResponse>({
    queryKey: ["/api/projects", projectId, "client-shortlist"],
    enabled: projectId > 0,
  });

  const handleExportPDF = async () => {
    if (!shortlistData || shortlistData.totalExperts === 0) {
      toast({
        title: "No experts to export",
        description: "There are no accepted experts in this project shortlist.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/projects/${projectId}/client-shortlist-export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export shortlist");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `client_shortlist_project_${projectId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Exported ${shortlistData.totalExperts} expert(s) to PDF.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export shortlist to PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading shortlist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-destructive">Error loading client shortlist. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" data-testid="button-back-to-project">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-page-title">Client Shortlist</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-project-title">
              {shortlistData?.projectTitle || "Project"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-expert-count">
            {shortlistData?.totalExperts || 0} Expert(s)
          </Badge>
          <Button 
            onClick={handleExportPDF}
            disabled={isExporting || !shortlistData?.totalExperts}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export Shortlist"}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {!shortlistData?.experts?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No accepted experts available yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Experts who accept the consultation will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            shortlistData.experts.map((expert, index) => (
              <ExpertCard key={expert.projectExpertId} expert={expert} index={index} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ExpertCard({ expert, index }: { expert: ClientShortlistExpert; index: number }) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const displayedHistory = showAllHistory 
    ? expert.employmentHistory 
    : expert.employmentHistory.slice(0, 3);

  return (
    <Card data-testid={`card-expert-${expert.expertId}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold" data-testid={`text-expert-name-${expert.expertId}`}>
                  {expert.profile.name}
                </h2>
                {(expert.profile.jobTitle || expert.profile.company) && (
                  <p className="text-sm text-muted-foreground">
                    {[expert.profile.jobTitle, expert.profile.company].filter(Boolean).join(" at ")}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="capitalize">
              {expert.pipelineStatus}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
            {expert.profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {expert.profile.location}
              </span>
            )}
            {expert.profile.yearsOfExperience && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {expert.profile.yearsOfExperience} years experience
              </span>
            )}
            {expert.profile.timezone && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {expert.profile.timezone}
              </span>
            )}
            {expert.profile.industry && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {expert.profile.industry}
              </span>
            )}
          </div>

          {expert.angles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {expert.angles.map((angle, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {angle}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Employment History
          </h3>
          {expert.employmentHistory.length > 0 ? (
            <div className="space-y-2">
              {displayedHistory.map((job, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{job.jobTitle}</span>
                  <span className="text-muted-foreground">
                    {" "}at {job.company} ({job.fromYear} - {job.toYear || "Present"})
                  </span>
                </div>
              ))}
              {expert.employmentHistory.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="text-xs h-auto py-1"
                >
                  {showAllHistory 
                    ? "Show less" 
                    : `Show ${expert.employmentHistory.length - 3} more`}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No employment history available</p>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Vetting Questions & Answers
          </h3>
          {expert.vettingAnswers.length > 0 ? (
            <div className="space-y-4">
              {expert.vettingAnswers.map((vq, i) => (
                <div key={vq.questionId} className="text-sm">
                  <div className="font-medium text-foreground">
                    Q{i + 1}: {vq.angleName && <span className="text-primary">[{vq.angleName}] </span>}
                    {vq.questionText}
                  </div>
                  <div className="mt-1 text-muted-foreground pl-4 border-l-2 border-muted">
                    A{i + 1}: {vq.answerText || <span className="italic">No answer provided</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No vetting questions for this project</p>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Availability
          </h3>
          {expert.availability.slots.length > 0 ? (
            <div className="space-y-1">
              {expert.availability.slots.map((slot, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {slot.date}, {slot.startTime} - {slot.endTime} ({slot.timezone})
                  </Badge>
                </div>
              ))}
            </div>
          ) : expert.availability.note ? (
            <p className="text-sm text-muted-foreground">{expert.availability.note}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No availability submitted yet</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
