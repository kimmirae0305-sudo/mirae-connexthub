import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Building2, ClipboardList, Check, X, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface InvitationData {
  projectExpertId: number;
  project: {
    id: number;
    name: string;
    clientName: string;
    industry: string;
    projectOverview: string | null;
    description: string | null;
  };
  expert: {
    id: number;
    name: string;
    email: string;
  };
  vettingQuestions: Array<{
    id: number;
    question: string;
    orderIndex: number;
    isRequired: boolean;
  }>;
  invitedAt: string;
}

interface ExpertInviteProps {
  token: string;
}

export default function ExpertInvite({ token }: ExpertInviteProps) {
  const [hasResponded, setHasResponded] = useState(false);
  const [responseStatus, setResponseStatus] = useState<"accepted" | "declined" | null>(null);

  const { data: invitation, isLoading, error } = useQuery<InvitationData>({
    queryKey: ["/api/expert-invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/expert-invite/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load invitation");
      }
      return res.json();
    },
    retry: false,
  });

  const answerSchema = z.object({
    answers: z.array(z.object({
      questionId: z.number(),
      answer: z.string().min(1, "Answer is required"),
    })),
    availabilityNote: z.string().optional(),
  });

  type AnswerFormData = z.infer<typeof answerSchema>;

  const form = useForm<AnswerFormData>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      answers: [],
      availabilityNote: "",
    },
  });

  useEffect(() => {
    if (invitation?.vettingQuestions) {
      form.reset({
        answers: invitation.vettingQuestions.map((q) => ({
          questionId: q.id,
          answer: "",
        })),
        availabilityNote: "",
      });
    }
  }, [invitation, form]);

  const acceptMutation = useMutation({
    mutationFn: async (data: AnswerFormData) => {
      const res = await fetch(`/api/expert-invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vqAnswers: data.answers,
          availabilityNote: data.availabilityNote,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to accept invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      setHasResponded(true);
      setResponseStatus("accepted");
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/expert-invite/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Declined via invitation link" }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to decline invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      setHasResponded(true);
      setResponseStatus("declined");
    },
  });

  const onSubmit = (data: AnswerFormData) => {
    acceptMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invitation Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {(error as Error).message || "This invitation link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasResponded) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {responseStatus === "accepted" ? (
              <>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Thank You!</CardTitle>
                <CardDescription>
                  Your response has been recorded. The team will review your answers and get in touch soon.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Response Recorded</CardTitle>
                <CardDescription>
                  We've noted your decision to decline this project. Thank you for your time.
                </CardDescription>
              </>
            )}
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Project Invitation</h1>
          <p className="text-muted-foreground">
            Hello {invitation.expert.name}, you've been invited to participate in a project.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{invitation.project.name}</CardTitle>
            </div>
            <CardDescription>
              {invitation.project.clientName} • {invitation.project.industry}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitation.project.projectOverview && (
              <div>
                <p className="text-sm font-medium mb-1">Overview</p>
                <p className="text-sm text-muted-foreground">{invitation.project.projectOverview}</p>
              </div>
            )}
            {invitation.project.description && (
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invitation.project.description}
                </p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Invited on {format(new Date(invitation.invitedAt), "MMMM dd, yyyy 'at' h:mm a")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Vetting Questions</CardTitle>
            </div>
            <CardDescription>
              Please answer the following questions to help us understand your fit for this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {invitation.vettingQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No vetting questions for this project.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {invitation.vettingQuestions
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((q, index) => (
                        <FormField
                          key={q.id}
                          control={form.control}
                          name={`answers.${index}.answer`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-start gap-2">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {index + 1}.
                                </span>
                                <span>
                                  {q.question}
                                  {q.isRequired && (
                                    <span className="text-destructive ml-1">*</span>
                                  )}
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Type your answer here..."
                                  className="resize-none min-h-[100px]"
                                  {...field}
                                  data-testid={`input-answer-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                  </div>
                )}

                <Separator />

                <FormField
                  control={form.control}
                  name="availabilityNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability Note (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any notes about your availability, preferred meeting times, etc."
                          className="resize-none"
                          {...field}
                          data-testid="input-availability-note"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {acceptMutation.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      {(acceptMutation.error as Error).message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => declineMutation.mutate()}
                    disabled={acceptMutation.isPending || declineMutation.isPending}
                    className="gap-2"
                    data-testid="button-decline"
                  >
                    {declineMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Decline Invitation
                  </Button>
                  <Button
                    type="submit"
                    disabled={acceptMutation.isPending || declineMutation.isPending}
                    className="gap-2"
                    data-testid="button-accept"
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Accept & Submit Answers
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
