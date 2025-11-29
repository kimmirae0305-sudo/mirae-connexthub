import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Building2,
  Briefcase,
  Globe,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ProjectInviteData {
  project: {
    id: number;
    name: string;
    clientName: string;
    clientCompany?: string;
    industry: string;
    region?: string;
    projectOverview?: string;
    description?: string;
  };
  expert: {
    id: number;
    name: string;
    email: string;
  };
  vettingQuestions: {
    id: number;
    question: string;
    orderIndex: number;
    isRequired: boolean;
  }[];
  currentStatus: string;
  hasResponded: boolean;
}

export default function ExpertProjectInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [vqAnswers, setVqAnswers] = useState<Record<number, string>>({});
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [responseType, setResponseType] = useState<"accept" | "decline" | null>(null);

  const { data, isLoading, error } = useQuery<ProjectInviteData>({
    queryKey: ["/api/expert/project-invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/expert/project-invite/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load invitation");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ response }: { response: "accept" | "decline" }) => {
      const answersArray = Object.entries(vqAnswers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer,
      }));

      const res = await fetch(`/api/expert/project-invite/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          vqAnswers: answersArray,
          availabilityNote,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit response");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResponseType(data.response);
      setShowSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVqAnswerChange = (questionId: number, value: string) => {
    setVqAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleAccept = () => {
    const requiredQuestions = data?.vettingQuestions.filter((q) => q.isRequired) || [];
    const missingAnswers = requiredQuestions.filter((q) => !vqAnswers[q.id]?.trim());

    if (missingAnswers.length > 0) {
      toast({
        title: "Required questions",
        description: "Please answer all required questions before accepting.",
        variant: "destructive",
      });
      return;
    }

    respondMutation.mutate({ response: "accept" });
  };

  const handleDecline = () => {
    respondMutation.mutate({ response: "decline" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Invalid Invitation</h2>
              <p className="text-muted-foreground">{(error as Error).message}</p>
              <p className="text-sm text-muted-foreground">
                This invitation link may have expired, already been used, or is invalid.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (data.hasResponded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">Already Responded</h2>
              <p className="text-muted-foreground">
                You have already responded to this project invitation.
              </p>
              <p className="text-sm text-muted-foreground">
                Current status: <Badge variant="outline">{data.currentStatus}</Badge>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              {responseType === "accept" ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                  <h2 className="text-2xl font-semibold">Thank You!</h2>
                  <p className="text-muted-foreground">
                    You have accepted the project invitation for{" "}
                    <span className="font-medium text-foreground">{data.project.name}</span>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The Mirae Connext team will be in touch soon to discuss next steps.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">Response Recorded</h2>
                  <p className="text-muted-foreground">
                    Thank you for your response. We appreciate your time and will keep you in mind
                    for future opportunities.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Project Invitation</h1>
          <p className="text-muted-foreground">
            Hello {data.expert.name}, you've been invited to participate in a project
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {data.project.name}
            </CardTitle>
            <CardDescription>Review the project details and respond below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm font-medium">{data.project.clientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Industry</p>
                  <p className="text-sm font-medium">{data.project.industry}</p>
                </div>
              </div>
              {data.project.region && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Region</p>
                    <p className="text-sm font-medium">{data.project.region}</p>
                  </div>
                </div>
              )}
            </div>

            {data.project.projectOverview && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Project Overview</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {data.project.projectOverview}
                  </p>
                </div>
              </>
            )}

            {data.project.description && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Description</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {data.project.description}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {data.vettingQuestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Screening Questions
              </CardTitle>
              <CardDescription>
                Please answer the following questions to help us understand your fit for this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {data.vettingQuestions
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((q, index) => (
                  <div key={q.id} className="space-y-2">
                    <div className="flex gap-2 items-start">
                      <span className="font-mono text-sm text-muted-foreground w-6 flex-shrink-0">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {q.question}
                          {q.isRequired && <span className="text-destructive ml-1">*</span>}
                        </p>
                        <Textarea
                          placeholder="Your answer..."
                          value={vqAnswers[q.id] || ""}
                          onChange={(e) => handleVqAnswerChange(q.id, e.target.value)}
                          className="mt-2"
                          rows={3}
                          data-testid={`input-vq-answer-${q.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Availability Note (Optional)
            </CardTitle>
            <CardDescription>
              Let us know about your availability for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g., Available starting next week, preferred time slots, any scheduling constraints..."
              value={availabilityNote}
              onChange={(e) => setAvailabilityNote(e.target.value)}
              rows={3}
              data-testid="input-availability-note"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDecline}
                disabled={respondMutation.isPending}
                data-testid="button-decline"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={respondMutation.isPending}
                data-testid="button-accept"
              >
                {respondMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <p className="text-xs text-muted-foreground text-center">
              By accepting, you agree to participate in this project according to Mirae Connext terms.
            </p>
          </CardFooter>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">Mirae Connext</span>
          </p>
        </div>
      </div>
    </div>
  );
}
