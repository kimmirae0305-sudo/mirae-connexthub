import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  User,
  Briefcase,
  FileText,
  DollarSign,
  Shield,
  Plus,
  Trash2,
  Globe,
  Building2,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  countries,
  countryCodes,
  timezones,
  currencies,
  months,
  getYearOptions,
} from "@/lib/translations/expert-onboarding";
import logoPath from "@assets/Logo_1764384177823.png";

interface ExpertOnboardingProps {
  projectId: string;
  inviteType: string;
  token: string;
}

interface InvitationData {
  project: {
    id: number;
    name: string;
    clientName: string;
    industry: string;
    projectOverview: string | null;
    description: string | null;
  };
  vettingQuestions: Array<{
    id: number;
    question: string;
    orderIndex: number;
    isRequired: boolean;
  }>;
  recruitedBy: string | null;
  recruitedByRaId: number | null;
}

const experienceSchema = z.object({
  company: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  fromMonth: z.string().min(1, "Required"),
  fromYear: z.string().min(1, "Required"),
  toMonth: z.string().optional(),
  toYear: z.string().optional(),
  isCurrent: z.boolean().default(false),
});

const createFormSchema = (t: typeof translations.en) =>
  z.object({
    email: z.string().email(t.invalidEmail),
    password: z.string().min(8, t.passwordMinLength),
    confirmPassword: z.string(),
    firstName: z.string().min(1, t.required),
    lastName: z.string().min(1, t.required),
    country: z.string().min(1, t.required),
    region: z.string().optional(),
    countryCode: z.string().min(1, t.required),
    phoneNumber: z.string().min(1, t.required),
    linkedinUrl: z.string().url(t.invalidUrl).optional().or(z.literal("")),
    city: z.string().optional(),
    canConsultInEnglish: z.enum(["yes", "no"]),
    timezone: z.string().min(1, t.required),
    experiences: z.array(experienceSchema).min(1, t.required),
    biography: z.string().min(50, t.required),
    workHistory: z.string().min(50, t.required),
    hourlyRate: z.string().min(1, t.required),
    currency: z.string().min(1, t.required),
    termsAccepted: z.boolean().refine((v) => v === true, t.termsRequired),
    vqAnswers: z.array(
      z.object({
        questionId: z.number(),
        answer: z.string(),
      })
    ),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t.passwordsDoNotMatch,
    path: ["confirmPassword"],
  });

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

export default function ExpertOnboarding({ projectId, inviteType, token }: ExpertOnboardingProps) {
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>(detectBrowserLanguage);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const t = translations[language];

  const { data: invitationData, isLoading, error } = useQuery<InvitationData>({
    queryKey: ["/api/invite", projectId, inviteType, token],
    queryFn: async () => {
      const response = await fetch(`/api/invite/${projectId}/${inviteType}/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid invitation link");
      }
      return response.json();
    },
  });

  const formSchema = createFormSchema(t);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      country: "",
      region: "",
      countryCode: "+55",
      phoneNumber: "",
      linkedinUrl: "",
      city: "",
      canConsultInEnglish: "yes",
      timezone: "America/Sao_Paulo",
      experiences: [
        {
          company: "",
          title: "",
          fromMonth: "",
          fromYear: "",
          toMonth: "",
          toYear: "",
          isCurrent: false,
        },
      ],
      biography: "",
      workHistory: "",
      hourlyRate: "",
      currency: "USD",
      termsAccepted: false,
      vqAnswers: [],
    },
  });

  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control: form.control,
    name: "experiences",
  });

  useEffect(() => {
    if (invitationData?.vettingQuestions) {
      form.setValue(
        "vqAnswers",
        invitationData.vettingQuestions.map((q) => ({
          questionId: q.id,
          answer: "",
        }))
      );
    }
  }, [invitationData, form]);

  const registerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch(`/api/invite/${projectId}/${inviteType}/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Registration failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: t.errorTitle,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    registerMutation.mutate(data);
  };

  const yearOptions = getYearOptions();

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
            <p className="text-muted-foreground">{t.loading}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="flex flex-row items-center justify-end">
            <LanguageToggle />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.errorTitle}</h2>
              <p className="mt-2 text-muted-foreground">
                {(error as Error)?.message || t.invalidLink}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.successTitle}</h2>
              <p className="mt-2 text-muted-foreground">{t.successMessage}</p>
            </div>
            <Button onClick={() => window.close()} data-testid="button-close">
              {t.closeButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
          </div>
          <LanguageToggle />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
          <p className="mt-2 text-muted-foreground">{t.pageSubtitle}</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{t.projectInfoTitle}</CardTitle>
            </div>
            <CardDescription>{t.projectDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">{invitationData.project.name}</p>
              <p className="text-sm text-muted-foreground">
                {invitationData.project.clientName} • {invitationData.project.industry}
              </p>
            </div>
            {invitationData.project.projectOverview && (
              <p className="text-sm text-muted-foreground">
                {invitationData.project.projectOverview}
              </p>
            )}
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.loginInfoTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.email} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t.emailPlaceholder} {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.password} *</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={t.passwordPlaceholder}
                            {...field}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.confirmPassword} *</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={t.confirmPasswordPlaceholder}
                            {...field}
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.basicInfoTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.firstName} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t.firstNamePlaceholder} {...field} data-testid="input-first-name" />
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
                        <FormLabel>{t.lastName} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t.lastNamePlaceholder} {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.country} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder={t.countryPlaceholder} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name[language]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.region}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.regionPlaceholder} {...field} data-testid="input-region" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.city}</FormLabel>
                      <FormControl>
                        <Input placeholder={t.cityPlaceholder} {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.countryCode} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-country-code">
                              <SelectValue placeholder={t.countryCodePlaceholder} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryCodes.map((cc) => (
                              <SelectItem key={cc.code} value={cc.code}>
                                {cc.code} ({cc.country})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t.phoneNumber} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t.phoneNumberPlaceholder} {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.linkedinUrl}</FormLabel>
                      <FormControl>
                        <Input placeholder={t.linkedinUrlPlaceholder} {...field} data-testid="input-linkedin" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canConsultInEnglish"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.canConsultInEnglish} *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id="english-yes" data-testid="radio-english-yes" />
                            <Label htmlFor="english-yes">{t.yes}</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id="english-no" data-testid="radio-english-no" />
                            <Label htmlFor="english-no">{t.no}</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.timezone} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-timezone">
                            <SelectValue placeholder={t.timezonePlaceholder} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label[language]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t.experienceTitle}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendExperience({
                        company: "",
                        title: "",
                        fromMonth: "",
                        fromYear: "",
                        toMonth: "",
                        toYear: "",
                        isCurrent: false,
                      })
                    }
                    className="gap-1"
                    data-testid="button-add-experience"
                  >
                    <Plus className="h-4 w-4" />
                    {t.addExperience}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {experienceFields.map((field, index) => (
                  <div key={field.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      {experienceFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExperience(index)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-remove-experience-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`experiences.${index}.company`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.company} *</FormLabel>
                            <FormControl>
                              <Input placeholder={t.companyPlaceholder} {...field} data-testid={`input-company-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`experiences.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.titleRole} *</FormLabel>
                            <FormControl>
                              <Input placeholder={t.titleRolePlaceholder} {...field} data-testid={`input-title-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.fromDate} *</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name={`experiences.${index}.fromMonth`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger data-testid={`select-from-month-${index}`}>
                                  <SelectValue placeholder={t.month} />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.name[language]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`experiences.${index}.fromYear`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger data-testid={`select-from-year-${index}`}>
                                  <SelectValue placeholder={t.year} />
                                </SelectTrigger>
                                <SelectContent>
                                  {yearOptions.map((y) => (
                                    <SelectItem key={y} value={y}>
                                      {y}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t.toDate}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name={`experiences.${index}.toMonth`}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={form.watch(`experiences.${index}.isCurrent`)}
                              >
                                <SelectTrigger data-testid={`select-to-month-${index}`}>
                                  <SelectValue placeholder={t.month} />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.name[language]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`experiences.${index}.toYear`}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={form.watch(`experiences.${index}.isCurrent`)}
                              >
                                <SelectTrigger data-testid={`select-to-year-${index}`}>
                                  <SelectValue placeholder={t.year} />
                                </SelectTrigger>
                                <SelectContent>
                                  {yearOptions.map((y) => (
                                    <SelectItem key={y} value={y}>
                                      {y}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name={`experiences.${index}.isCurrent`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`checkbox-current-${index}`}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal">
                            {t.currentPosition}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.biographyTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="biography"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder={t.biographyPlaceholder}
                          className="min-h-[150px] resize-none"
                          {...field}
                          data-testid="input-biography"
                        />
                      </FormControl>
                      <FormDescription>{t.biographyDescription}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.workHistoryTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="workHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder={t.workHistoryPlaceholder}
                          className="min-h-[150px] resize-none"
                          {...field}
                          data-testid="input-work-history"
                        />
                      </FormControl>
                      <FormDescription>{t.workHistoryDescription}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.hourlyRateTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.hourlyRate} *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={t.hourlyRatePlaceholder}
                            {...field}
                            data-testid="input-hourly-rate"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.currency} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-currency">
                              <SelectValue placeholder={t.currencyPlaceholder} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.symbol} {c.code} - {c.name[language]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {invitationData.vettingQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t.vettingQuestionsTitle}</CardTitle>
                  </div>
                  <CardDescription>{t.vettingQuestionsDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {invitationData.vettingQuestions
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((q, index) => (
                      <FormField
                        key={q.id}
                        control={form.control}
                        name={`vqAnswers.${index}.answer`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-start gap-2">
                              <span className="font-mono text-sm text-muted-foreground">
                                {index + 1}.
                              </span>
                              <span>
                                {q.question}
                                {q.isRequired && <span className="text-destructive ml-1">*</span>}
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[100px] resize-none"
                                {...field}
                                data-testid={`input-vq-answer-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{t.termsTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="cursor-pointer font-normal">
                          {t.termsCheckboxLabel}{" "}
                          <a
                            href="#terms"
                            className="text-primary underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.termsLink}
                          </a>{" "}
                          {language === "pt" ? "e" : language === "es" ? "y" : "and"}{" "}
                          <a
                            href="#privacy"
                            className="text-primary underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.privacyLink}
                          </a>{" "}
                          {language === "pt"
                            ? "da Mirae Connext."
                            : language === "es"
                            ? "de Mirae Connext."
                            : "of Mirae Connext."}
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-center pb-8">
              <Button
                type="submit"
                size="lg"
                disabled={registerMutation.isPending}
                className="w-full max-w-md gap-2"
                data-testid="button-submit"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.submitting}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
