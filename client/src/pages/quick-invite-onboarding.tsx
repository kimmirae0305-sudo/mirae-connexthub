import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/apiUrl";
import logoPath from "@assets/Logo_1764384177823.png";

interface WorkHistoryItem {
  company: string;
  jobTitle: string;
  fromYear: string;
  toYear: string;
}

interface InviteData {
  token: string;
  candidateName?: string | null;
  candidateEmail?: string | null;
  project: {
    id: number;
    name: string;
    industry: string;
    projectOverview: string | null;
  };
  angles: Array<{
    id: number;
    title: string;
    description: string | null;
  }>;
  vettingQuestions: Array<{
    id: number;
    question: string;
    angleId: number | null;
    angleTitle: string | null;
    orderIndex: number;
    isRequired: boolean;
  }>;
}

const emptyWorkHistoryItem = (): WorkHistoryItem => ({
  company: "",
  jobTitle: "",
  fromYear: "",
  toYear: "",
});

export default function QuickInviteOnboarding() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    termsAccepted: false,
    lgpdAccepted: false,
    fullName: "",
    email: "",
    phoneWhatsapp: "",
    country: "",
    city: "",
    currentTitle: "",
    currentCompany: "",
    expectedHourlyRateUsd: "",
    workHistory: [emptyWorkHistoryItem()],
    yearsOfExperience: "",
    sectorExpertise: "",
    regionalExpertise: "",
    professionalBio: "",
    availability: "",
    conflictCheck: "",
    sampleAnswers: [] as Array<{ questionId: number; answerText: string }>,
  });

  const { data: inviteData, isLoading, error } = useQuery<InviteData>({
    queryKey: [`/api/quick-invite/${token}`],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/quick-invite/${token}`));
      if (!res.ok) throw new Error("Invalid invite link");
      return res.json();
    },
  });

  useEffect(() => {
    if (!inviteData) return;
    setFormData((current) => ({
      ...current,
      fullName: current.fullName || inviteData.candidateName || "",
      email: current.email || inviteData.candidateEmail || "",
      sampleAnswers:
        current.sampleAnswers.length > 0
          ? current.sampleAnswers
          : inviteData.vettingQuestions.map((question) => ({
              questionId: question.id,
              answerText: "",
            })),
    }));
  }, [inviteData]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/quick-invite/${token}/onboard`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          expectedHourlyRateUsd: Number(formData.expectedHourlyRateUsd),
          yearsOfExperience: Number(formData.yearsOfExperience),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => setIsSubmitted(true),
    onError: (submitError: Error) => {
      toast({
        title: "Could not submit onboarding",
        description: submitError.message,
        variant: "destructive",
      });
    },
  });

  const updateWorkHistory = (index: number, patch: Partial<WorkHistoryItem>) => {
    setFormData((current) => ({
      ...current,
      workHistory: current.workHistory.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const removeWorkHistory = (index: number) => {
    setFormData((current) => ({
      ...current,
      workHistory: current.workHistory.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateSampleAnswer = (questionId: number, answerText: string) => {
    setFormData((current) => ({
      ...current,
      sampleAnswers: current.sampleAnswers.map((answer) =>
        answer.questionId === questionId ? { ...answer, answerText } : answer
      ),
    }));
  };

  const canContinueStep1 =
    formData.termsAccepted &&
    formData.lgpdAccepted &&
    formData.fullName.trim() &&
    formData.email.trim() &&
    formData.phoneWhatsapp.trim() &&
    formData.country.trim() &&
    formData.city.trim() &&
    formData.currentTitle.trim() &&
    formData.currentCompany.trim() &&
    Number(formData.expectedHourlyRateUsd) > 0;

  const canContinueStep2 =
    formData.workHistory.length > 0 &&
    formData.workHistory.every((item) => item.company.trim() && item.jobTitle.trim()) &&
    Number(formData.yearsOfExperience) >= 0 &&
    formData.sectorExpertise.trim() &&
    formData.regionalExpertise.trim() &&
    formData.professionalBio.trim();

  const requiredQuestionsAnswered =
    inviteData?.vettingQuestions
      .filter((question) => question.isRequired)
      .every((question) =>
        formData.sampleAnswers.find((answer) => answer.questionId === question.id)?.answerText.trim()
      ) ?? true;

  const canSubmit = canContinueStep1 && canContinueStep2 && requiredQuestionsAnswered && formData.availability.trim();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="text-xl font-semibold">Invalid invite link</h2>
              <p className="mt-2 text-muted-foreground">This link has expired or is no longer valid.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">Application submitted</h2>
              <p className="mt-2 text-muted-foreground">
                Thank you. The Mirae Connext team will review your profile and project responses.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
          <Badge variant="outline">Step {step} of 3</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expert onboarding</CardTitle>
            <CardDescription>
              Complete your profile so Mirae Connext can review your fit for this project.
            </CardDescription>
          </CardHeader>
        </Card>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Consent and basic details</CardTitle>
              <CardDescription>All rates are collected in USD for this project application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="termsAccepted"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, termsAccepted: checked === true })
                    }
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="termsAccepted" className="cursor-pointer leading-relaxed">
                    I accept Mirae Connext's Terms & Conditions.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="lgpdAccepted"
                    checked={formData.lgpdAccepted}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, lgpdAccepted: checked === true })
                    }
                    data-testid="checkbox-lgpd"
                  />
                  <Label htmlFor="lgpdAccepted" className="cursor-pointer leading-relaxed">
                    I consent to the collection and processing of my personal data in accordance with LGPD and the Privacy Policy.
                  </Label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                    data-testid="input-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneWhatsapp">Phone/WhatsApp</Label>
                  <Input
                    id="phoneWhatsapp"
                    value={formData.phoneWhatsapp}
                    onChange={(event) => setFormData({ ...formData, phoneWhatsapp: event.target.value })}
                    data-testid="input-phone-whatsapp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(event) => setFormData({ ...formData, country: event.target.value })}
                    data-testid="input-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentTitle">Current title</Label>
                  <Input
                    id="currentTitle"
                    value={formData.currentTitle}
                    onChange={(event) => setFormData({ ...formData, currentTitle: event.target.value })}
                    data-testid="input-current-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentCompany">Current company</Label>
                  <Input
                    id="currentCompany"
                    value={formData.currentCompany}
                    onChange={(event) => setFormData({ ...formData, currentCompany: event.target.value })}
                    data-testid="input-current-company"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="expectedHourlyRateUsd">Expected hourly rate (USD)</Label>
                  <Input
                    id="expectedHourlyRateUsd"
                    type="number"
                    min="1"
                    value={formData.expectedHourlyRateUsd}
                    onChange={(event) => setFormData({ ...formData, expectedHourlyRateUsd: event.target.value })}
                    data-testid="input-expected-hourly-rate-usd"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Work history and expertise</CardTitle>
              <CardDescription>Summarize the experience that qualifies you for this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Work history</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        workHistory: [...formData.workHistory, emptyWorkHistoryItem()],
                      })
                    }
                    data-testid="button-add-work-history"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add role
                  </Button>
                </div>
                {formData.workHistory.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                    <Input
                      placeholder="Company"
                      value={item.company}
                      onChange={(event) => updateWorkHistory(index, { company: event.target.value })}
                      data-testid={`input-work-company-${index}`}
                    />
                    <Input
                      placeholder="Title"
                      value={item.jobTitle}
                      onChange={(event) => updateWorkHistory(index, { jobTitle: event.target.value })}
                      data-testid={`input-work-title-${index}`}
                    />
                    <Input
                      placeholder="From year"
                      value={item.fromYear}
                      onChange={(event) => updateWorkHistory(index, { fromYear: event.target.value })}
                      data-testid={`input-work-from-${index}`}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="To year or Present"
                        value={item.toYear}
                        onChange={(event) => updateWorkHistory(index, { toYear: event.target.value })}
                        data-testid={`input-work-to-${index}`}
                      />
                      {formData.workHistory.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWorkHistory(index)}
                          data-testid={`button-remove-work-history-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Years of experience</Label>
                  <Input
                    id="yearsOfExperience"
                    type="number"
                    min="0"
                    value={formData.yearsOfExperience}
                    onChange={(event) => setFormData({ ...formData, yearsOfExperience: event.target.value })}
                    data-testid="input-years-experience"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sectorExpertise">Sector expertise</Label>
                  <Input
                    id="sectorExpertise"
                    value={formData.sectorExpertise}
                    onChange={(event) => setFormData({ ...formData, sectorExpertise: event.target.value })}
                    data-testid="input-sector-expertise"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="regionalExpertise">Regional expertise</Label>
                  <Input
                    id="regionalExpertise"
                    value={formData.regionalExpertise}
                    onChange={(event) => setFormData({ ...formData, regionalExpertise: event.target.value })}
                    data-testid="input-regional-expertise"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="professionalBio">Short professional bio</Label>
                  <Textarea
                    id="professionalBio"
                    className="min-h-[120px]"
                    value={formData.professionalBio}
                    onChange={(event) => setFormData({ ...formData, professionalBio: event.target.value })}
                    data-testid="input-professional-bio"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Project agenda and sample answers</CardTitle>
              <CardDescription>Client identity is not shown at this stage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-md border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Project</p>
                  <p className="font-medium">{inviteData.project.name}</p>
                </div>
                {inviteData.project.projectOverview && (
                  <p className="whitespace-pre-wrap text-sm">{inviteData.project.projectOverview}</p>
                )}
                {inviteData.angles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {inviteData.angles.map((angle) => (
                      <Badge key={angle.id} variant="secondary">
                        {angle.title}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label>Vetting questions</Label>
                {inviteData.vettingQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vetting questions have been added for this project yet.</p>
                ) : (
                  inviteData.vettingQuestions
                    .slice()
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((question, index) => (
                      <div key={question.id} className="space-y-2 rounded-md border p-4">
                        <Label htmlFor={`answer-${question.id}`}>
                          {index + 1}. {question.question}
                          {question.isRequired && <span className="ml-1 text-destructive">*</span>}
                        </Label>
                        {question.angleTitle && (
                          <Badge variant="outline" className="w-fit">
                            {question.angleTitle}
                          </Badge>
                        )}
                        <Textarea
                          id={`answer-${question.id}`}
                          className="min-h-[100px]"
                          value={
                            formData.sampleAnswers.find((answer) => answer.questionId === question.id)?.answerText || ""
                          }
                          onChange={(event) => updateSampleAnswer(question.id, event.target.value)}
                          data-testid={`input-sample-answer-${question.id}`}
                        />
                      </div>
                    ))
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Textarea
                  id="availability"
                  className="min-h-[90px]"
                  placeholder="Share windows of availability, timezone, and any scheduling constraints."
                  value={formData.availability}
                  onChange={(event) => setFormData({ ...formData, availability: event.target.value })}
                  data-testid="input-availability"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conflictCheck">Conflict check, if applicable</Label>
                <Textarea
                  id="conflictCheck"
                  className="min-h-[90px]"
                  placeholder="Mention any conflicts, restrictions, or sensitive relationships relevant to this project."
                  value={formData.conflictCheck}
                  onChange={(event) => setFormData({ ...formData, conflictCheck: event.target.value })}
                  data-testid="input-conflict-check"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 1 || submitMutation.isPending}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              disabled={step === 1 ? !canContinueStep1 : !canContinueStep2}
              onClick={() => setStep((current) => Math.min(3, current + 1))}
              data-testid="button-next"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canSubmit || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              data-testid="button-submit-onboarding"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit application"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
