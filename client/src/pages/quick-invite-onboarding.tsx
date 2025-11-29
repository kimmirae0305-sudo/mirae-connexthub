import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams } from "wouter";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Globe,
  Building2,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type Language,
  translations,
  detectBrowserLanguage,
} from "@/lib/translations/expert-onboarding";
import logoPath from "@assets/Logo_1764384177823.png";

interface OnboardingData {
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

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, "You must agree to terms"),
  lgpdAccepted: z.boolean().refine((val) => val === true, "You must agree to LGPD"),
  sampleAnswers: z.array(
    z.object({
      questionId: z.number(),
      answer: z.string().optional(),
    })
  ),
});

type FormData = z.infer<typeof formSchema>;

export default function QuickInviteOnboarding() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>("en");
  const [page, setPage] = useState(1); // Page 1: Onboarding, Page 2: Project Overview
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  useEffect(() => {
    const detected = detectBrowserLanguage();
    if (detected) {
      setLanguage(detected);
    }
  }, []);

  const t = translations[language];

  // Fetch onboarding data
  const { data: onboardingData, isLoading, error } = useQuery({
    queryKey: [`/api/quick-invite/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/quick-invite/${token}`);
      if (!res.ok) throw new Error("Invalid invite link");
      return res.json() as Promise<OnboardingData>;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      termsAccepted: false,
      lgpdAccepted: false,
      sampleAnswers: onboardingData?.vettingQuestions.map((q) => ({
        questionId: q.id,
        answer: "",
      })) || [],
    },
  });

  // Update sample answers when vetting questions load
  useEffect(() => {
    if (onboardingData?.vettingQuestions) {
      form.setValue(
        "sampleAnswers",
        onboardingData.vettingQuestions.map((q) => ({
          questionId: q.id,
          answer: "",
        }))
      );
    }
  }, [onboardingData, form]);

  const { fields: sampleAnswerFields } = useFieldArray({
    control: form.control,
    name: "sampleAnswers",
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/quick-invite/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "You have been added to the project" });
      setTimeout(() => window.close(), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (page === 1) {
      setPage(2);
    } else {
      submitMutation.mutate(data);
    }
  };

  const LanguageToggle = () => (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <SelectTrigger className="w-[140px]" data-testid="select-language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pt">Português</SelectItem>
          <SelectItem value="es">Español</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !onboardingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="flex flex-row items-center justify-end">
            <LanguageToggle />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="text-xl font-semibold">Invalid Invite Link</h2>
              <p className="mt-2 text-muted-foreground">
                This invite link is invalid or expired
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
        <div className="mb-6 flex items-center justify-between">
          <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
          <LanguageToggle />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">
            {page === 1 ? "Your Profile" : "Project Information"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {page === 1
              ? "Let's get to know you better"
              : `You're invited to: ${onboardingData.project.name}`}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {page === 1 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 123-4567" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Agreements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1">
                            <Label className="text-sm">
                              I agree to the{" "}
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() => setShowTermsModal(true)}
                              >
                                Terms & Conditions
                              </button>
                              *
                            </Label>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lgpdAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1">
                            <Label className="text-sm">
                              I agree to the{" "}
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() => setShowLgpdModal(true)}
                              >
                                LGPD data policy
                              </button>
                              *
                            </Label>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{onboardingData.project.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {onboardingData.project.clientName} •{" "}
                        {onboardingData.project.industry}
                      </p>
                    </div>
                    {onboardingData.project.projectOverview && (
                      <p className="text-sm">{onboardingData.project.projectOverview}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">Vetting Questions</CardTitle>
                    </div>
                    <CardDescription>
                      Please provide your responses below
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {sampleAnswerFields.map((field, index) => (
                      <div key={field.id} className="space-y-2">
                        <Label className="text-sm font-medium">
                          {onboardingData.vettingQuestions[index].question}
                          {onboardingData.vettingQuestions[index].isRequired && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        <FormField
                          control={form.control}
                          name={`sampleAnswers.${index}.answer`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder="Your answer here..."
                                  className="min-h-24"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {page === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage(1)}
                  data-testid="button-back"
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="flex-1"
                data-testid="button-continue"
              >
                {submitMutation.isPending
                  ? "Submitting..."
                  : page === 1
                    ? "Continue"
                    : "Submit & Join Project"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
