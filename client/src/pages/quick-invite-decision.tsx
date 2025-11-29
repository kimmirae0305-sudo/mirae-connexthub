import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, Loader2, Building2, ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/Logo_1764384177823.png";

interface DecisionData {
  project: {
    id: number;
    name: string;
    clientName: string;
    industry: string;
    projectOverview: string | null;
  };
  vettingQuestions: Array<{
    id: number;
    question: string;
    isRequired: boolean;
  }>;
}

export default function QuickInviteDecision() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [sampleAnswers, setSampleAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<"accepted" | "declined" | null>(null);

  const { data: decisionData, isLoading, error } = useQuery({
    queryKey: [`/api/quick-invite/${token}/decision`],
    queryFn: async () => {
      const res = await fetch(`/api/quick-invite/${token}/decision`);
      if (!res.ok) throw new Error("Invalid invite link");
      return res.json() as Promise<DecisionData>;
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async (action: "accepted" | "declined") => {
      const res = await fetch(`/api/quick-invite/${token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: action,
          sampleAnswers: action === "accepted" ? sampleAnswers : {},
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit decision");
      }
      return res.json();
    },
    onSuccess: (data, decision) => {
      setSubmitted(true);
      setSubmittedStatus(decision);
      toast({
        title: decision === "accepted" ? "Great!" : "Noted",
        description:
          decision === "accepted"
            ? "You've been added to the project pipeline"
            : "We've noted your unavailability",
      });
      setTimeout(() => window.close(), 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading project details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !decisionData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="text-xl font-semibold">Invalid Invite Link</h2>
              <p className="mt-2 text-muted-foreground">This link has expired or is no longer valid</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              {submittedStatus === "accepted" ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {submittedStatus === "accepted"
                  ? "You're all set!"
                  : "Thank you for letting us know"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {submittedStatus === "accepted"
                  ? "You've been added to the project pipeline. The RA will contact you soon."
                  : "We'll keep your contact for future opportunities."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Project Information</h1>
          <p className="mt-2 text-muted-foreground">
            Review the project details and let us know if you're interested
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{decisionData.project.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">{decisionData.project.clientName}</p>
              <p className="text-sm text-muted-foreground">{decisionData.project.industry}</p>
            </div>
            {decisionData.project.projectOverview && (
              <p className="text-sm text-muted-foreground">{decisionData.project.projectOverview}</p>
            )}
          </CardContent>
        </Card>

        {decisionData.vettingQuestions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Vetting Questions</CardTitle>
              </div>
              <CardDescription>
                Optional: Share your thoughts on the project or questions below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {decisionData.vettingQuestions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <label className="text-sm font-medium">{question.question}</label>
                  <Textarea
                    placeholder="Your answer (optional)..."
                    className="min-h-20"
                    value={sampleAnswers[question.id] || ""}
                    onChange={(e) =>
                      setSampleAnswers({ ...sampleAnswers, [question.id]: e.target.value })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => decisionMutation.mutate("declined")}
            variant="outline"
            disabled={decisionMutation.isPending}
            className="flex-1"
            data-testid="button-decline"
          >
            {decisionMutation.isPending && submittedStatus === "declined" ? "Submitting..." : "Not Available"}
          </Button>
          <Button
            onClick={() => decisionMutation.mutate("accepted")}
            disabled={decisionMutation.isPending}
            className="flex-1"
            data-testid="button-accept"
          >
            {decisionMutation.isPending && submittedStatus === "accepted" ? "Submitting..." : "I'm Interested"}
          </Button>
        </div>
      </div>
    </div>
  );
}
