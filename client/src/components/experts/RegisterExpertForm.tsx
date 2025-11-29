import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  User,
  Briefcase,
  FileText,
  DollarSign,
  Shield,
  Plus,
  Trash2,
  Globe,
  CheckCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

interface RegisterExpertFormProps {
  projectId: number;
  onSuccess: (data: { expertId: number; inviteUrl: string }) => void;
  onCancel?: () => void;
  minimalMode?: boolean;
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
    hourlyRate: z.string().min(1, t.required),
    currency: z.string().min(1, t.required),
    termsAccepted: z.boolean().refine((v) => v === true, t.termsRequired),
    lgpdAccepted: z.boolean().refine((v) => v === true, t.lgpdRequired),
  });

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

const termsAndConditionsContent = {
  pt: `
    <h2>Termos e Condições de Uso</h2>
    <p>Ao utilizar os serviços da Mirae Connext, você concorda com os seguintes termos:</p>
    <h3>1. Aceitação dos Termos</h3>
    <p>Ao acessar ou usar nossos serviços, você concorda em cumprir estes termos e condições.</p>
    <h3>2. Uso dos Serviços</h3>
    <p>Você concorda em usar nossos serviços apenas para fins legais e de acordo com estes termos.</p>
    <h3>3. Confidencialidade</h3>
    <p>Você concorda em manter confidenciais todas as informações compartilhadas durante as consultorias.</p>
    <h3>4. Pagamentos</h3>
    <p>Os pagamentos serão processados de acordo com os termos acordados em cada projeto.</p>
    <h3>5. Propriedade Intelectual</h3>
    <p>Todo o conteúdo e propriedade intelectual permanecem com seus respectivos proprietários.</p>
  `,
  es: `
    <h2>Términos y Condiciones de Uso</h2>
    <p>Al utilizar los servicios de Mirae Connext, usted acepta los siguientes términos:</p>
    <h3>1. Aceptación de los Términos</h3>
    <p>Al acceder o utilizar nuestros servicios, acepta cumplir con estos términos y condiciones.</p>
    <h3>2. Uso de los Servicios</h3>
    <p>Acepta utilizar nuestros servicios solo para fines legales y de acuerdo con estos términos.</p>
    <h3>3. Confidencialidad</h3>
    <p>Acepta mantener confidencial toda la información compartida durante las consultorías.</p>
    <h3>4. Pagos</h3>
    <p>Los pagos se procesarán de acuerdo con los términos acordados en cada proyecto.</p>
    <h3>5. Propiedad Intelectual</h3>
    <p>Todo el contenido y propiedad intelectual permanece con sus respectivos propietarios.</p>
  `,
  en: `
    <h2>Terms and Conditions of Use</h2>
    <p>By using Mirae Connext services, you agree to the following terms:</p>
    <h3>1. Acceptance of Terms</h3>
    <p>By accessing or using our services, you agree to comply with these terms and conditions.</p>
    <h3>2. Use of Services</h3>
    <p>You agree to use our services only for lawful purposes and in accordance with these terms.</p>
    <h3>3. Confidentiality</h3>
    <p>You agree to maintain confidentiality of all information shared during consultations.</p>
    <h3>4. Payments</h3>
    <p>Payments will be processed according to the terms agreed upon in each project.</p>
    <h3>5. Intellectual Property</h3>
    <p>All content and intellectual property remains with their respective owners.</p>
  `,
};

const lgpdContent = {
  pt: `
    <h2>Política de Privacidade e LGPD</h2>
    <p>Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018):</p>
    <h3>1. Coleta de Dados</h3>
    <p>Coletamos apenas os dados necessários para a prestação de nossos serviços.</p>
    <h3>2. Uso dos Dados</h3>
    <p>Seus dados são utilizados exclusivamente para os fins descritos nesta política.</p>
    <h3>3. Compartilhamento</h3>
    <p>Não compartilhamos seus dados com terceiros sem seu consentimento expresso.</p>
    <h3>4. Segurança</h3>
    <p>Implementamos medidas de segurança para proteger seus dados pessoais.</p>
    <h3>5. Seus Direitos</h3>
    <p>Você tem direito a acessar, corrigir ou excluir seus dados a qualquer momento.</p>
  `,
  es: `
    <h2>Política de Privacidad y LGPD</h2>
    <p>En cumplimiento con la Ley General de Protección de Datos (LGPD):</p>
    <h3>1. Recopilación de Datos</h3>
    <p>Recopilamos solo los datos necesarios para la prestación de nuestros servicios.</p>
    <h3>2. Uso de los Datos</h3>
    <p>Sus datos se utilizan exclusivamente para los fines descritos en esta política.</p>
    <h3>3. Compartir Datos</h3>
    <p>No compartimos sus datos con terceros sin su consentimiento expreso.</p>
    <h3>4. Seguridad</h3>
    <p>Implementamos medidas de seguridad para proteger sus datos personales.</p>
    <h3>5. Sus Derechos</h3>
    <p>Tiene derecho a acceder, corregir o eliminar sus datos en cualquier momento.</p>
  `,
  en: `
    <h2>Privacy Policy and LGPD</h2>
    <p>In compliance with the General Data Protection Law (LGPD - Law No. 13.709/2018):</p>
    <h3>1. Data Collection</h3>
    <p>We collect only the data necessary for the provision of our services.</p>
    <h3>2. Use of Data</h3>
    <p>Your data is used exclusively for the purposes described in this policy.</p>
    <h3>3. Data Sharing</h3>
    <p>We do not share your data with third parties without your express consent.</p>
    <h3>4. Security</h3>
    <p>We implement security measures to protect your personal data.</p>
    <h3>5. Your Rights</h3>
    <p>You have the right to access, correct, or delete your data at any time.</p>
  `,
};

export function RegisterExpertForm({
  projectId,
  onSuccess,
  onCancel,
  minimalMode = false,
}: RegisterExpertFormProps) {
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>(detectBrowserLanguage);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const t = translations[language];
  const formSchema = createFormSchema(t);
  const yearOptions = getYearOptions();

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
      hourlyRate: "",
      currency: "USD",
      termsAccepted: false,
      lgpdAccepted: false,
    },
  });

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control: form.control,
    name: "experiences",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest(
        "POST",
        `/api/projects/${projectId}/register-expert`,
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      setIsSubmitted(true);
      setInviteUrl(data.inviteUrl);
      toast({ title: t.expertRegistered });
      onSuccess({ expertId: data.expertId, inviteUrl: data.inviteUrl });
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

  const copyInviteLink = async () => {
    if (inviteUrl) {
      const fullUrl = `${window.location.origin}${inviteUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      toast({ title: t.inviteLinkCopied });
      setTimeout(() => setCopiedLink(false), 2000);
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
          <SelectItem value="pt">Portugues</SelectItem>
          <SelectItem value="es">Espanol</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (isSubmitted && inviteUrl) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t.inviteLinkCreated}</h2>
          <p className="mt-2 text-muted-foreground">{t.expertRegistered}</p>
        </div>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg w-full max-w-md">
          <code className="flex-1 text-sm truncate">
            {`${window.location.origin}${inviteUrl}`}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={copyInviteLink}
            data-testid="button-copy-invite-url"
          >
            {copiedLink ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(inviteUrl, "_blank")}
            data-testid="button-open-invite-url"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        {onCancel && (
          <Button onClick={onCancel} className="mt-4" data-testid="button-close">
            {t.closeButton}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={minimalMode ? "" : "p-4"}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t.registerExpertModalTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {t.registerExpertModalSubtitle}
            </p>
          </div>
          <LanguageToggle />
        </div>

        <ScrollArea className={minimalMode ? "h-[60vh]" : "h-auto"}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t.basicInfoTitle}</CardTitle>
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
                            <Input
                              placeholder={t.firstNamePlaceholder}
                              {...field}
                              data-testid="input-first-name"
                            />
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
                            <Input
                              placeholder={t.lastNamePlaceholder}
                              {...field}
                              data-testid="input-last-name"
                            />
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
                            placeholder={t.emailPlaceholder}
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
                            <Input
                              placeholder={t.regionPlaceholder}
                              {...field}
                              data-testid="input-region"
                            />
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
                          <Input
                            placeholder={t.cityPlaceholder}
                            {...field}
                            data-testid="input-city"
                          />
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
                            <Input
                              placeholder={t.phoneNumberPlaceholder}
                              {...field}
                              data-testid="input-phone"
                            />
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
                          <Input
                            placeholder={t.linkedinUrlPlaceholder}
                            {...field}
                            data-testid="input-linkedin"
                          />
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
                              <RadioGroupItem
                                value="yes"
                                id="english-yes"
                                data-testid="radio-english-yes"
                              />
                              <Label htmlFor="english-yes">{t.yes}</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value="no"
                                id="english-no"
                                data-testid="radio-english-no"
                              />
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
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">{t.experienceTitle}</CardTitle>
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
                  {experienceFields.map((expField, index) => (
                    <div
                      key={expField.id}
                      className="space-y-4 p-4 border rounded-lg relative"
                    >
                      {experienceFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExperience(index)}
                          className="absolute top-2 right-2 text-destructive"
                          data-testid={`button-remove-experience-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`experiences.${index}.company`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.company} *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t.companyPlaceholder}
                                  {...field}
                                  data-testid={`input-company-${index}`}
                                />
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
                                <Input
                                  placeholder={t.titleRolePlaceholder}
                                  {...field}
                                  data-testid={`input-title-${index}`}
                                />
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
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t.biographyTitle}</CardTitle>
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
                            className="min-h-[100px] resize-none"
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
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t.workHistoryTitle}</CardTitle>
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
                            className="min-h-[100px] resize-none"
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
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t.hourlyRateTitle}</CardTitle>
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

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{t.termsTitle}</CardTitle>
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
                              onClick={() => setShowTermsModal(true)}
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
                              onClick={() => setShowLgpdModal(true)}
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

              <div className="flex justify-end gap-3 pt-4">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    data-testid="button-cancel"
                  >
                    {t.closeButton}
                  </Button>
                )}
                <Button
                  type="submit"
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
                    t.registerExpertButton
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.termsLink}</DialogTitle>
            <DialogDescription>
              {language === "pt"
                ? "Leia os termos abaixo"
                : language === "es"
                ? "Lea los terminos a continuacion"
                : "Read the terms below"}
            </DialogDescription>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: termsAndConditionsContent[language],
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showLgpdModal} onOpenChange={setShowLgpdModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.lgpdLink}</DialogTitle>
            <DialogDescription>
              {language === "pt"
                ? "Leia a politica LGPD abaixo"
                : language === "es"
                ? "Lea la politica LGPD a continuacion"
                : "Read the LGPD policy below"}
            </DialogDescription>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: lgpdContent[language],
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
