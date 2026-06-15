import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, CalendarClock, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { resolveApiUrl } from "@/lib/apiUrl";
import logoPath from "@assets/Logo_1764384177823.png";

type AdvisorProjectReviewData = {
  project: {
    id: number;
    advisorBrief: string;
  };
  invitation: {
    id: number;
    expiresAt: string | null;
  };
  advisor: {
    name: string;
  };
  screeningQuestions: Array<{
    id: number;
    question: string;
    questionType?: string | null;
    isRequired?: boolean | null;
    orderIndex?: number | null;
  }>;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No expiration date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiration date set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

function SafeReviewLinkError() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Review Link Unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This review link could not be loaded. Please contact Mirae Connext.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

class AdvisorProjectReviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <SafeReviewLinkError />;
    }

    return this.props.children;
  }
}

function AdvisorProjectReviewContent() {
  const params = useParams<{ token: string }>();
  const token =
    params.token ||
    (typeof window !== "undefined"
      ? decodeURIComponent(window.location.pathname.split("/public/advisor-project-review/")[1]?.split("/")[0] || "")
      : "");

  const { data, isLoading, error } = useQuery<AdvisorProjectReviewData>({
    queryKey: ["/api/public/advisor-project-review", token],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/public/advisor-project-review/${token}`));
      if (!res.ok) {
        throw new Error("Invalid or expired review link");
      }
      return res.json();
    },
    enabled: Boolean(token),
    retry: false,
  });

  const project = data?.project ?? { id: null, advisorBrief: "" };
  const invitation = data?.invitation ?? { id: null, expiresAt: null };
  const advisor = data?.advisor ?? { name: "Advisor" };
  const screeningQuestions = Array.isArray(data?.screeningQuestions)
    ? data.screeningQuestions
    : Array.isArray((data as any)?.vettingQuestions)
      ? (data as any).vettingQuestions
      : [];
  const advisorBrief =
    String(project.advisorBrief || (project as any).externalAdvisorBrief || "").trim() ||
    "Project details will be shared by the Mirae Connext team.";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading project review...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <SafeReviewLinkError />;
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={logoPath} alt="Mirae Connext" className="h-12 w-auto" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Expert Consultation Invitation
              </p>
              <h1 className="text-2xl font-semibold">Advisor Project Review</h1>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            {project.id ? `Project #${project.id}` : "Project Review"}
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Project Brief</CardTitle>
                <CardDescription>
                  Please review the advisor-facing brief and screening questions below.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                Expires {formatDate(invitation.expiresAt)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Advisor</p>
              <p className="mt-1 text-base font-semibold">{advisor.name || "Advisor"}</p>
            </div>
            <div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {advisorBrief}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Screening Questions
            </CardTitle>
            <CardDescription>
              Response submission will be available in a later step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {screeningQuestions.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No screening questions have been added yet.
              </div>
            ) : (
              <ol className="space-y-4">
                {screeningQuestions.map((question, index) => (
                  <li key={question.id ?? index} className="rounded-md border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="space-y-2">
                        <p className="text-sm leading-6">{question.question || "Screening question pending."}</p>
                        {question.isRequired && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 text-sm text-muted-foreground sm:flex-row sm:items-center">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Secure advisor review link</p>
              <p>
                This page is for reviewing the project opportunity only. Answer submission and follow-up workflow will be added later.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Mirae Connext | Confidential expert consultation workflow
        </p>
      </main>
    </div>
  );
}

export default function AdvisorProjectReview() {
  return (
    <AdvisorProjectReviewErrorBoundary>
      <AdvisorProjectReviewContent />
    </AdvisorProjectReviewErrorBoundary>
  );
}
