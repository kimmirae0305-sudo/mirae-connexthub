import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Copy,
  CopyCheck,
  FileText,
  CheckCircle2
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

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function escapeHtmlNoBreaks(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateExpertHTML(expert: ClientShortlistExpert): string {
  const statusColor = expert.pipelineStatus === "accepted" 
    ? "#2563eb" 
    : expert.pipelineStatus === "scheduled" 
    ? "#16a34a" 
    : "#6366f1";

  const workHistoryRows = expert.employmentHistory.length > 0
    ? expert.employmentHistory.map(job => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${escapeHtmlNoBreaks(job.company) || "-"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${escapeHtmlNoBreaks(job.jobTitle) || "-"}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${job.fromYear} - ${job.toYear || "Present"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding: 8px 12px; font-size: 14px; color: #9ca3af; font-style: italic;">No employment history available</td></tr>`;

  const anglesHTML = expert.angles.length > 0
    ? expert.angles.map(angle => 
        `<span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin-right: 6px; margin-bottom: 4px;">${escapeHtmlNoBreaks(angle)}</span>`
      ).join("")
    : "";

  const bioHTML = expert.profile.biography
    ? `<p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${escapeHtml(expert.profile.biography)}</p>`
    : `<p style="margin: 0; font-size: 14px; color: #9ca3af; font-style: italic;">No biography available</p>`;

  const vqHTML = expert.vettingAnswers.length > 0
    ? expert.vettingAnswers.map((vq, i) => `
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
            Q${i + 1}: ${vq.angleName ? `<span style="color: #2563eb;">[${escapeHtmlNoBreaks(vq.angleName)}]</span> ` : ""}${escapeHtmlNoBreaks(vq.questionText)}
          </p>
          <div style="padding-left: 16px; border-left: 3px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
              ${vq.answerText ? escapeHtml(vq.answerText) : `<span style="color: #9ca3af; font-style: italic;">No answer provided</span>`}
            </p>
          </div>
        </div>
      `).join("")
    : `<p style="margin: 0; font-size: 14px; color: #9ca3af; font-style: italic;">No vetting questions for this project</p>`;

  let availabilityHTML = "";
  if (expert.availability.slots.length > 0) {
    availabilityHTML = expert.availability.slots.map(slot => 
      `<p style="margin: 0 0 4px 0; font-size: 14px; color: #374151;">${escapeHtmlNoBreaks(slot.date)}, ${escapeHtmlNoBreaks(slot.startTime)} - ${escapeHtmlNoBreaks(slot.endTime)} (${escapeHtmlNoBreaks(slot.timezone)})</p>`
    ).join("");
  } else if (expert.availability.note) {
    availabilityHTML = `<p style="margin: 0; font-size: 14px; color: #374151;">${escapeHtml(expert.availability.note)}</p>`;
  } else {
    availabilityHTML = `<p style="margin: 0; font-size: 14px; color: #9ca3af; font-style: italic;">No availability submitted yet</p>`;
  }

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto 24px auto;">
  <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e5e7eb;">
    
    <!-- Header -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: #111827;">${escapeHtmlNoBreaks(expert.profile.name)}</h2>
          ${(expert.profile.jobTitle || expert.profile.company) 
            ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${[escapeHtmlNoBreaks(expert.profile.jobTitle), escapeHtmlNoBreaks(expert.profile.company)].filter(Boolean).join(" at ")}</p>` 
            : ""}
        </div>
        <span style="display: inline-block; background-color: ${statusColor}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: capitalize;">
          ${escapeHtmlNoBreaks(expert.pipelineStatus)}
        </span>
      </div>
      ${anglesHTML ? `<div style="margin-top: 12px;">${anglesHTML}</div>` : ""}
    </div>

    <!-- Work History Section -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #111827;">Work History</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Company</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Job Title</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Period</th>
          </tr>
        </thead>
        <tbody>
          ${workHistoryRows}
        </tbody>
      </table>
    </div>

    <!-- Bio Section -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #111827;">Bio</h3>
      ${bioHTML}
    </div>

    <!-- Comments on Questions Section -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #111827;">Comments on Questions</h3>
      ${vqHTML}
    </div>

    <!-- Availability Section -->
    <div style="padding: 20px 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #111827;">Availability</h3>
      ${availabilityHTML}
    </div>

  </div>
</div>
  `.trim();
}

function generateAllExpertsHTML(experts: ClientShortlistExpert[], projectTitle: string): string {
  const header = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto 24px auto;">
  <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #111827;">Client Shortlist</h1>
  <p style="margin: 0 0 4px 0; font-size: 16px; color: #6b7280;">${escapeHtmlNoBreaks(projectTitle)}</p>
  <p style="margin: 0; font-size: 14px; color: #9ca3af;">${experts.length} Expert(s)</p>
  <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
</div>
  `.trim();

  const expertsHTML = experts.map(expert => generateExpertHTML(expert)).join("\n\n");

  return `${header}\n\n${expertsHTML}`;
}

async function copyToClipboard(html: string, toast: any, description: string) {
  try {
    const blob = new Blob([html], { type: "text/html" });
    const data = [new ClipboardItem({ "text/html": blob, "text/plain": new Blob([html], { type: "text/plain" }) })];
    await navigator.clipboard.write(data);
    toast({
      title: "Copied to clipboard",
      description,
    });
    return true;
  } catch (error) {
    try {
      await navigator.clipboard.writeText(html);
      toast({
        title: "Copied to clipboard",
        description: `${description} (as text)`,
      });
      return true;
    } catch (fallbackError) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }
}

export default function ClientShortlistPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const { toast } = useToast();
  const [copiedExpertId, setCopiedExpertId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const { data: shortlistData, isLoading, error } = useQuery<ClientShortlistResponse>({
    queryKey: ["/api/projects", projectId, "client-shortlist"],
    enabled: projectId > 0,
  });

  const handleCopyProfile = async (expert: ClientShortlistExpert) => {
    const html = generateExpertHTML(expert);
    const success = await copyToClipboard(html, toast, `${expert.profile.name}'s profile copied`);
    if (success) {
      setCopiedExpertId(expert.expertId);
      setTimeout(() => setCopiedExpertId(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    if (!shortlistData?.experts?.length) return;
    
    const html = generateAllExpertsHTML(shortlistData.experts, shortlistData.projectTitle);
    const success = await copyToClipboard(html, toast, `All ${shortlistData.experts.length} expert(s) copied`);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
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
            onClick={handleCopyAll}
            disabled={!shortlistData?.totalExperts}
            variant={copiedAll ? "default" : "outline"}
            data-testid="button-copy-all"
          >
            {copiedAll ? (
              <>
                <CopyCheck className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy All Profiles
              </>
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
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
            shortlistData.experts.map((expert) => (
              <ExpertCard 
                key={expert.projectExpertId} 
                expert={expert} 
                onCopy={handleCopyProfile}
                isCopied={copiedExpertId === expert.expertId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ExpertCard({ 
  expert, 
  onCopy, 
  isCopied 
}: { 
  expert: ClientShortlistExpert; 
  onCopy: (expert: ClientShortlistExpert) => void;
  isCopied: boolean;
}) {
  const statusColor = expert.pipelineStatus === "accepted" 
    ? "bg-blue-600 text-white" 
    : expert.pipelineStatus === "scheduled" 
    ? "bg-green-600 text-white" 
    : "bg-indigo-600 text-white";

  return (
    <Card 
      className="overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      data-testid={`card-expert-${expert.expertId}`}
    >
      {/* Header */}
      <div className="p-5 border-b bg-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground mb-1" data-testid={`text-expert-name-${expert.expertId}`}>
              {expert.profile.name}
            </h2>
            {(expert.profile.jobTitle || expert.profile.company) && (
              <p className="text-sm text-muted-foreground">
                {[expert.profile.jobTitle, expert.profile.company].filter(Boolean).join(" at ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusColor} capitalize px-3 py-1`}>
              {expert.pipelineStatus}
            </Badge>
            <Button
              variant={isCopied ? "default" : "outline"}
              size="sm"
              onClick={() => onCopy(expert)}
              data-testid={`button-copy-profile-${expert.expertId}`}
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Profile
                </>
              )}
            </Button>
          </div>
        </div>

        {expert.angles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {expert.angles.map((angle, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">
                {angle}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <CardContent className="p-0">
        {/* Work History Section */}
        <div className="p-5 border-b">
          <h3 className="text-base font-bold text-foreground mb-3">Work History</h3>
          {expert.employmentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b">Company</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b">Job Title</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {expert.employmentHistory.map((job, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5 text-muted-foreground">{job.company || "-"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{job.jobTitle || "-"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{job.fromYear} - {job.toYear || "Present"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No employment history available</p>
          )}
        </div>

        {/* Bio Section */}
        <div className="p-5 border-b">
          <h3 className="text-base font-bold text-foreground mb-3">Bio</h3>
          {expert.profile.biography ? (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {expert.profile.biography}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No biography available</p>
          )}
        </div>

        {/* Comments on Questions Section */}
        <div className="p-5 border-b">
          <h3 className="text-base font-bold text-foreground mb-4">Comments on Questions</h3>
          {expert.vettingAnswers.length > 0 ? (
            <div className="space-y-4">
              {expert.vettingAnswers.map((vq, i) => (
                <div key={vq.questionId}>
                  <p className="text-sm font-semibold text-foreground mb-1.5">
                    Q{i + 1}: {vq.angleName && <span className="text-primary">[{vq.angleName}] </span>}
                    {vq.questionText}
                  </p>
                  <div className="pl-4 border-l-2 border-muted">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {vq.answerText || <span className="italic">No answer provided</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No vetting questions for this project</p>
          )}
        </div>

        {/* Availability Section */}
        <div className="p-5">
          <h3 className="text-base font-bold text-foreground mb-3">Availability</h3>
          {expert.availability.slots.length > 0 ? (
            <div className="space-y-1">
              {expert.availability.slots.map((slot, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {slot.date}, {slot.startTime} - {slot.endTime} ({slot.timezone})
                </p>
              ))}
            </div>
          ) : expert.availability.note ? (
            <p className="text-sm text-muted-foreground">{expert.availability.note}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No availability submitted yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
