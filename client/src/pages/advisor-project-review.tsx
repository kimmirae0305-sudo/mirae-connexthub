import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, CalendarClock, CheckCircle2, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
    status?: string | null;
    submittedAt?: string | null;
  };
  advisor: {
    name: string;
  };
  alreadySubmitted?: boolean;
  screeningQuestions: Array<{
    id: number;
    question: string;
    questionType?: string | null;
    isRequired?: boolean | null;
    orderIndex?: number | null;
  }>;
};

type AdvisorReviewSubmitResponse = {
  success: boolean;
  submittedAt?: string | null;
  status?: string;
  message?: string;
};

type ScreeningQuestion = AdvisorProjectReviewData["screeningQuestions"][number];
type AdvisorProjectReviewPayload = AdvisorProjectReviewData & {
  project: AdvisorProjectReviewData["project"] & {
    externalAdvisorBrief?: string | null;
  };
  vettingQuestions?: ScreeningQuestion[];
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
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const viewedRecordedRef = useRef(false);

  const reviewData = data as AdvisorProjectReviewPayload | undefined;
  const project = reviewData?.project ?? { id: null, advisorBrief: "", externalAdvisorBrief: null };
  const invitation = data?.invitation ?? { id: null, expiresAt: null, status: null, submittedAt: null };
  const advisor = data?.advisor ?? { name: "Advisor" };
  const screeningQuestions: ScreeningQuestion[] = Array.isArray(reviewData?.screeningQuestions)
    ? reviewData.screeningQuestions
    : Array.isArray(reviewData?.vettingQuestions)
      ? reviewData.vettingQuestions
      : [];
  const advisorBrief =
    String(project.advisorBrief || project.externalAdvisorBrief || "").trim() ||
    "Project details will be shared by the Mirae Connext team.";
  const alreadySubmitted = Boolean(data?.alreadySubmitted || invitation.status === "submitted" || invitation.submittedAt);

  useEffect(() => {
    if (!data) return;
    setIsSubmitted(Boolean(data.alreadySubmitted || data.invitation?.status === "submitted" || data.invitation?.submittedAt));
  }, [data]);

  useEffect(() => {
    if (!data || !token || viewedRecordedRef.current) return;
    viewedRecordedRef.current = true;

    void fetch(resolveApiUrl(`/api/public/advisor-project-review/${token}/viewed`), {
      method: "POST",
    }).catch(() => {
      // View tracking should never block the advisor review experience.
    });
  }, [data, token]);

  const submitMutation = useMutation<AdvisorReviewSubmitResponse, Error>({
    mutationFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/public/advisor-project-review/${token}/submit`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consentAccepted,
          answers: screeningQuestions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] || "",
          })),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Unable to submit this review link");
      }

      return res.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      setValidationError(null);
    },
    onError: (submitError) => {
      setValidationError(submitError.message || "Unable to submit this review link");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const missingRequired = screeningQuestions.filter((question) =>
      question.isRequired && !String(answers[question.id] || "").trim()
    );

    if (missingRequired.length > 0) {
      setValidationError("Please answer all required screening questions before submitting.");
      return;
    }

    if (!consentAccepted) {
      setValidationError("Please confirm consent before submitting your responses.");
      return;
    }

    setValidationError(null);
    submitMutation.mutate();
  };

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

  if (isSubmitted || alreadySubmitted) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Responses Submitted</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Thank you. Your responses have been submitted to Mirae Connext.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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

        <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Screening Questions
            </CardTitle>
            <CardDescription>
              Please answer the screening questions below so the Mirae Connext team can review fit for this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {screeningQuestions.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No screening questions have been added yet.
              </div>
            ) : (
              <ol className="space-y-5">
                {screeningQuestions.map((question, index) => (
                  <li key={question.id ?? index} className="rounded-md border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-3">
                        <p className="text-sm leading-6">{question.question || "Screening question pending."}</p>
                        {question.isRequired && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                        <Textarea
                          value={answers[question.id] || ""}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                          placeholder="Enter your response..."
                          className="min-h-[120px]"
                          data-testid={`textarea-screening-answer-${question.id}`}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-start">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Consent and submission</p>
                <p>
                  By submitting, you confirm that your responses are accurate and may be reviewed by Mirae Connext for this project opportunity.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-4">
              <Checkbox
                id="advisor-review-consent"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                data-testid="checkbox-advisor-review-consent"
              />
              <Label htmlFor="advisor-review-consent" className="text-sm font-normal leading-5">
                I consent to Mirae Connext processing these responses for advisor screening and project fit review.
              </Label>
            </div>
            {validationError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {validationError}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              data-testid="button-submit-advisor-review"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Responses"
              )}
            </Button>
          </CardContent>
        </Card>
        </form>

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
