import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  DollarSign,
  FileText,
  Globe,
  Loader2,
  Plus,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiRequest } from "@/lib/queryClient";
import {
  type Language,
  translations,
  detectBrowserLanguage,
  countries,
  countryCodes,
  timezones,
  months,
  getYearOptions,
} from "@/lib/translations/expert-onboarding";
import type { ExpertInvitationLink, InsertExpert } from "@shared/schema";
import logoPath from "@assets/Logo_1764384177823.png";

interface ExpertRegisterProps {
  token: string;
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
    firstName: z.string().min(1, t.required),
    lastName: z.string().min(1, t.required),
    email: z.string().email(t.invalidEmail),
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
    expectedRate: z.string().optional(),
    expectedRateCurrency: z.string().optional(),
    termsAccepted: z.boolean().refine((v) => v === true, t.termsRequired),
    lgpdAccepted: z.boolean().refine((v) => v === true, t.lgpdRequired),
  }).refine((data) => !data.expectedRate || data.expectedRateCurrency, {
    message: t.required,
    path: ["expectedRateCurrency"],
  }).refine((data) => !data.expectedRate || Number(data.expectedRate) > 0, {
    message: "Expected rate must be greater than 0",
    path: ["expectedRate"],
  });

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

const rateCurrencies = [
  { code: "BRL", label: "BRL - Brazilian Real" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
];

const standaloneCopy: Record<Language, {
  pageTitle: string;
  pageSubtitle: string;
  stepOneTitle: string;
  stepTwoTitle: string;
  stepOneLabel: string;
  stepTwoLabel: string;
  continueButton: string;
  backButton: string;
  rateTitle: string;
  rateLabel: string;
  rateDescription: string;
  currencyLabel: string;
  successMessage: string;
}> = {
  pt: {
    pageTitle: "Cadastro de Especialista",
    pageSubtitle: "Complete seu perfil para fazer parte da rede de especialistas da Mirae Connext.",
    stepOneTitle: "Dados basicos",
    stepTwoTitle: "Experiencia e consentimentos",
    stepOneLabel: "Etapa 1 de 2",
    stepTwoLabel: "Etapa 2 de 2",
    continueButton: "Continuar",
    backButton: "Voltar",
    rateTitle: "Taxa de Consultoria Esperada",
    rateLabel: "Taxa de Consultoria Esperada",
    rateDescription: "Informe sua taxa de consultoria por hora, se desejar.",
    currencyLabel: "Moeda da Taxa Esperada",
    successMessage: "Seu perfil foi enviado. A equipe da Mirae Connext revisara suas informacoes para oportunidades futuras na rede de especialistas.",
  },
  es: {
    pageTitle: "Registro de Experto",
    pageSubtitle: "Complete su perfil para unirse a la red de expertos de Mirae Connext.",
    stepOneTitle: "Informacion basica",
    stepTwoTitle: "Experiencia y consentimientos",
    stepOneLabel: "Paso 1 de 2",
    stepTwoLabel: "Paso 2 de 2",
    continueButton: "Continuar",
    backButton: "Atras",
    rateTitle: "Tarifa de Consultoria Esperada",
    rateLabel: "Tarifa de Consultoria Esperada",
    rateDescription: "Indique su tarifa de consultoria por hora, si lo desea.",
    currencyLabel: "Moneda de la Tarifa Esperada",
    successMessage: "Su perfil fue enviado. El equipo de Mirae Connext revisara su informacion para futuras oportunidades en la red de expertos.",
  },
  en: {
    pageTitle: "Expert Registration",
    pageSubtitle: "Complete your profile to join the Mirae Connext expert network.",
    stepOneTitle: "Basic information",
    stepTwoTitle: "Experience and consent",
    stepOneLabel: "Step 1 of 2",
    stepTwoLabel: "Step 2 of 2",
    continueButton: "Continue",
    backButton: "Back",
    rateTitle: "Expected Consulting Rate",
    rateLabel: "Expected Consulting Rate",
    rateDescription: "Share your expected consulting rate per hour if you would like.",
    currencyLabel: "Expected Rate Currency",
    successMessage: "Your profile has been submitted. The Mirae Connext team will review your information for future expert network opportunities.",
  },
};

const termsContent: Record<Language, string> = {
  pt: `
    <h2>Termos e Condicoes de Uso</h2>
    <p>Ao participar da rede de especialistas da Mirae Connext, voce concorda em manter confidenciais as informacoes compartilhadas em oportunidades de consultoria.</p>
    <p>Pagamentos e escopo de trabalho serao confirmados separadamente para cada oportunidade aceita.</p>
  `,
  es: `
    <h2>Terminos y Condiciones de Uso</h2>
    <p>Al participar en la red de expertos de Mirae Connext, acepta mantener confidencial la informacion compartida en oportunidades de consultoria.</p>
    <p>Los pagos y el alcance del trabajo se confirmaran por separado para cada oportunidad aceptada.</p>
  `,
  en: `
    <h2>Terms and Conditions of Use</h2>
    <p>By joining the Mirae Connext expert network, you agree to keep confidential information shared during consulting opportunities.</p>
    <p>Payment terms and scope of work will be confirmed separately for each accepted opportunity.</p>
  `,
};

const privacyContent: Record<Language, string> = {
  pt: `
    <h2>Politica de Privacidade e LGPD</h2>
    <p>Coletamos e processamos seus dados pessoais para avaliar seu perfil, manter seu cadastro na rede de especialistas e entrar em contato sobre oportunidades relevantes.</p>
    <p>Voce pode solicitar acesso, correcao ou exclusao de seus dados conforme a legislacao aplicavel.</p>
  `,
  es: `
    <h2>Politica de Privacidad y LGPD</h2>
    <p>Recopilamos y procesamos sus datos personales para evaluar su perfil, mantener su registro en la red de expertos y contactarlo sobre oportunidades relevantes.</p>
    <p>Puede solicitar acceso, correccion o eliminacion de sus datos conforme a la legislacion aplicable.</p>
  `,
  en: `
    <h2>Privacy Policy and LGPD</h2>
    <p>We collect and process your personal data to evaluate your profile, maintain your expert network registration, and contact you about relevant opportunities.</p>
    <p>You may request access, correction, or deletion of your data under applicable law.</p>
  `,
};

const splitName = (name?: string | null) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

export default function ExpertRegister({ token }: ExpertRegisterProps) {
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>(detectBrowserLanguage);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const t = translations[language];
  const copy = standaloneCopy[language];
  const formSchema = createFormSchema(t);
  const yearOptions = getYearOptions();

  const { data: invitationLink, isLoading, error } = useQuery<ExpertInvitationLink>({
    queryKey: ["/api/invitation-links", token],
    queryFn: async () => {
      const response = await fetch(`/api/invitation-links/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t.invalidLink);
      }
      return response.json();
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
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
      expectedRate: "",
      expectedRateCurrency: "",
      termsAccepted: false,
      lgpdAccepted: false,
    },
  });

  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control: form.control,
    name: "experiences",
  });

  useEffect(() => {
    if (!invitationLink) return;
    const name = splitName(invitationLink.candidateName);
    form.reset({
      ...form.getValues(),
      firstName: name.firstName || form.getValues("firstName"),
      lastName: name.lastName || form.getValues("lastName"),
      email: invitationLink.candidateEmail || form.getValues("email"),
    });
  }, [form, invitationLink]);

  const registerMutation = useMutation({
    mutationFn: (data: InsertExpert) => apiRequest("POST", `/api/register-expert/${token}`, data),
    onSuccess: () => {
      setIsSubmitted(true);
      toast({ title: t.successTitle });
    },
    onError: (error: Error) => {
      toast({
        title: t.errorTitle,
        description: error.message || t.invalidLink,
        variant: "destructive",
      });
    },
  });

  const LanguageToggle = () => (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
        <SelectTrigger className="w-[140px]" data-testid="select-language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pt">Portugues</SelectItem>
          <SelectItem value="es">Espanol</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const validateStepOne = async () => {
    const isValid = await form.trigger([
      "firstName",
      "lastName",
      "email",
      "country",
      "countryCode",
      "phoneNumber",
      "timezone",
      "linkedinUrl",
    ]);
    if (isValid) setCurrentStep(2);
  };

  const onSubmit = (data: FormData) => {
    const currentExperience = data.experiences.find((experience) => experience.isCurrent) || data.experiences[0];
    const earliestYear = Math.min(...data.experiences.map((experience) => Number(experience.fromYear)).filter(Number.isFinite));
    const fullPhone = `${data.countryCode} ${data.phoneNumber}`.trim();
    const experienceText = data.experiences.map((experience) => {
      const period = experience.isCurrent
        ? `${experience.fromMonth}/${experience.fromYear} - Present`
        : `${experience.fromMonth}/${experience.fromYear} - ${experience.toMonth || ""}/${experience.toYear || ""}`;
      return `${experience.title} at ${experience.company} (${period})`;
    }).join("\n");
    const normalizedWorkHistory = data.experiences.map((experience) => ({
      company: experience.company,
      jobTitle: experience.title,
      fromMonth: Number(experience.fromMonth),
      fromYear: Number(experience.fromYear),
      toMonth: experience.toMonth ? Number(experience.toMonth) : undefined,
      toYear: experience.toYear ? Number(experience.toYear) : undefined,
      isCurrent: experience.isCurrent,
    }));
    const expertData: InsertExpert = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: fullPhone || null,
      whatsapp: fullPhone || null,
      linkedinUrl: data.linkedinUrl || null,
      country: data.country,
      city: data.city || null,
      timezone: data.timezone,
      expertise: currentExperience?.title || null,
      areasOfExpertise: data.canConsultInEnglish === "yes" ? ["English consultations available"] : [],
      industry: null,
      company: currentExperience?.company || null,
      jobTitle: currentExperience?.title || null,
      yearsOfExperience: Number.isFinite(earliestYear) ? new Date().getFullYear() - earliestYear : null,
      expectedRate: data.expectedRate || null,
      expectedRateCurrency: data.expectedRate ? data.expectedRateCurrency || null : null,
      bio: data.biography,
      biography: data.biography,
      workHistory: normalizedWorkHistory,
      languages: data.canConsultInEnglish === "yes" ? ["English"] : [],
      status: "registered",
      source: "Inbound",
      termsAccepted: true,
      lgpdAccepted: true,
    };
    registerMutation.mutate(expertData);
  };

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

  if (error || !invitationLink) {
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
              <p className="mt-2 text-muted-foreground">{copy.successMessage}</p>
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
          <p className="mb-2 text-sm font-medium text-primary">
            {currentStep === 1 ? copy.stepOneLabel : copy.stepTwoLabel}
          </p>
          <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
          <p className="mt-2 text-muted-foreground">{copy.pageSubtitle}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 1 && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{t.basicInfoTitle}</CardTitle>
                    </div>
                    <CardDescription>{copy.stepOneTitle}</CardDescription>
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

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.email} *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder={t.emailPlaceholder}
                              readOnly={Boolean(invitationLink.expertId)}
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                                {countries.map((country) => (
                                  <SelectItem key={country.code} value={country.code}>
                                    {country.name[language]}
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
                                {countryCodes.map((countryCode) => (
                                  <SelectItem key={countryCode.code} value={countryCode.code}>
                                    {countryCode.code} ({countryCode.country})
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-english-consulting">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="yes">{t.yes}</SelectItem>
                              <SelectItem value="no">{t.no}</SelectItem>
                            </SelectContent>
                          </Select>
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
                              {timezones.map((timezone) => (
                                <SelectItem key={timezone.value} value={timezone.value}>
                                  {timezone.label[language]}
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

                <div className="flex justify-end pb-8">
                  <Button type="button" size="lg" onClick={validateStepOne} data-testid="button-continue">
                    {copy.continueButton}
                  </Button>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4">
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
                    <CardDescription>{copy.stepTwoTitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {experienceFields.map((experienceField, index) => (
                      <div key={experienceField.id} className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
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
                                      {months.map((month) => (
                                        <SelectItem key={month.value} value={month.value}>
                                          {month.name[language]}
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
                                      {yearOptions.map((year) => (
                                        <SelectItem key={year} value={year}>
                                          {year}
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
                                      {months.map((month) => (
                                        <SelectItem key={month.value} value={month.value}>
                                          {month.name[language]}
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
                                      {yearOptions.map((year) => (
                                        <SelectItem key={year} value={year}>
                                          {year}
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
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (checked) {
                                      form.setValue(`experiences.${index}.toMonth`, "");
                                      form.setValue(`experiences.${index}.toYear`, "");
                                    }
                                  }}
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
                      <CardTitle className="text-lg">{copy.rateTitle}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="expectedRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{copy.rateLabel}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder=""
                                {...field}
                                data-testid="input-expected-rate"
                              />
                            </FormControl>
                            <FormDescription>{copy.rateDescription}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="expectedRateCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{copy.currencyLabel}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-expected-rate-currency">
                                  <SelectValue placeholder={t.currencyPlaceholder} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {rateCurrencies.map((currency) => (
                                  <SelectItem key={currency.code} value={currency.code}>
                                    {currency.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>{t.currencyPlaceholder}</FormDescription>
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
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{t.termsTitle}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() => setShowTermsModal(true)}
                              >
                                {t.termsLink}
                              </button>{" "}
                              {language === "pt" ? "e" : language === "es" ? "y" : "and"}{" "}
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() => setShowPrivacyModal(true)}
                              >
                                {t.privacyLink}
                              </button>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lgpdAccepted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-lgpd"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer font-normal">
                              {t.lgpdCheckboxLabel}{" "}
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() => setShowPrivacyModal(true)}
                              >
                                {t.lgpdLink}
                              </button>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setCurrentStep(1)}
                    data-testid="button-back"
                  >
                    {copy.backButton}
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={registerMutation.isPending}
                    className="gap-2"
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
              </>
            )}
          </form>
        </Form>
      </div>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.termsLink}</DialogTitle>
            <DialogDescription>{t.termsTitle}</DialogDescription>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: termsContent[language] }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.privacyLink}</DialogTitle>
            <DialogDescription>{t.lgpdLink}</DialogDescription>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: privacyContent[language] }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
