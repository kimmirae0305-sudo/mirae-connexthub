import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/apiUrl";
import {
  normalizeQuickInviteLanguage,
  PRIVACY_POLICY_VERSION,
  quickInviteLanguages,
  quickInviteTranslations,
  TERMS_VERSION,
  type QuickInviteLanguage,
} from "@/lib/translations/quick-invite-onboarding";
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

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const availabilityBlocks = [
  { id: "09:00-12:00", label: "Morning", time: "09:00-12:00" },
  { id: "13:00-17:00", label: "Afternoon", time: "13:00-17:00" },
  { id: "18:00-21:00", label: "Evening", time: "18:00-21:00" },
];

const priorityTimezones = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Lisbon",
  "Asia/Seoul",
  "Asia/Singapore",
  "UTC",
];

const getTimezoneOptions = () => {
  try {
    const supportedTimezones = (Intl as any).supportedValuesOf?.("timeZone");
    if (Array.isArray(supportedTimezones) && supportedTimezones.length > 0) {
      return Array.from(new Set([...priorityTimezones, ...supportedTimezones])).sort((a, b) => {
        const priorityA = priorityTimezones.indexOf(a);
        const priorityB = priorityTimezones.indexOf(b);
        if (priorityA !== -1 || priorityB !== -1) {
          if (priorityA === -1) return 1;
          if (priorityB === -1) return -1;
          return priorityA - priorityB;
        }
        return a.localeCompare(b);
      });
    }
  } catch {
    // Older browsers may not support Intl.supportedValuesOf.
  }

  return priorityTimezones;
};

const timezones = getTimezoneOptions();

const priorityCountries = [
  "Brazil",
  "United States",
  "South Korea",
  "United Kingdom",
  "Spain",
  "Portugal",
  "Mexico",
  "Chile",
  "Colombia",
  "Argentina",
  "Peru",
  "Singapore",
];

const countries = Array.from(new Set([
  ...priorityCountries,
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "China",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Kenya",
  "Kuwait",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Panama",
  "Philippines",
  "Poland",
  "Qatar",
  "Romania",
  "Saudi Arabia",
  "South Africa",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "Uruguay",
  "Vietnam",
  "Australia",
  "United Arab Emirates",
])).sort((a, b) => {
  const priorityA = priorityCountries.indexOf(a);
  const priorityB = priorityCountries.indexOf(b);
  if (priorityA !== -1 || priorityB !== -1) {
    if (priorityA === -1) return 1;
    if (priorityB === -1) return -1;
    return priorityA - priorityB;
  }
  return a.localeCompare(b);
});

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
};

const languageLabels: Record<QuickInviteLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
};

export default function QuickInviteOnboarding() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const defaultTimezone = getBrowserTimezone();
  const [language, setLanguage] = useState<QuickInviteLanguage>(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeQuickInviteLanguage(params.get("lang"));
  });
  const t = quickInviteTranslations[language];
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
    timezone: timezones.includes(defaultTimezone) ? defaultTimezone : "America/Sao_Paulo",
    expectedHourlyRateUsd: "",
    workHistory: [emptyWorkHistoryItem()],
    availabilityTimezone: timezones.includes(defaultTimezone) ? defaultTimezone : "America/Sao_Paulo",
    availabilitySlots: [] as string[],
    availabilityNotes: "",
    conflictChoice: "" as "" | "yes" | "no",
    conflictDetails: "",
    sampleAnswers: [] as Array<{ questionId: number; answerText: string }>,
  });

  const updateLanguage = (value: QuickInviteLanguage) => {
    setLanguage(value);
    const params = new URLSearchParams(window.location.search);
    params.set("lang", value);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const legalUrl = (path: "/terms" | "/privacy") => `${path}?lang=${encodeURIComponent(language)}`;

  const { data: inviteData, isLoading, error } = useQuery<InviteData>({
    queryKey: [`/api/quick-invite/${token}`],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/quick-invite/${token}`));
      if (!res.ok) throw new Error(t.invalidInviteError);
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
      const availability = buildAvailabilitySummary();
      const conflictCheck =
        formData.conflictChoice === "no"
          ? "No conflict declared"
          : `Conflict declared: ${formData.conflictDetails.trim()}`;
      const primaryWorkHistory = formData.workHistory.find(
        (item) => item.company.trim() && item.jobTitle.trim()
      );
      const res = await fetch(resolveApiUrl(`/api/quick-invite/${token}/onboard`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          city: "Not provided",
          timezone: formData.timezone,
          currentTitle: primaryWorkHistory?.jobTitle.trim() || "Not provided",
          currentCompany: primaryWorkHistory?.company.trim() || "Not provided",
          availability,
          conflictCheck,
          consentLanguage: language,
          termsVersion: TERMS_VERSION,
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          expectedHourlyRateUsd: Number(formData.expectedHourlyRateUsd),
          yearsOfExperience: 0,
          sectorExpertise: "",
          regionalExpertise: "",
          professionalBio: "",
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t.submissionFailed);
      }
      return res.json();
    },
    onSuccess: () => setIsSubmitted(true),
    onError: (submitError: Error) => {
      toast({
        title: t.submitErrorTitle,
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

  const toggleAvailabilitySlot = (slot: string) => {
    setFormData((current) => ({
      ...current,
      availabilitySlots: current.availabilitySlots.includes(slot)
        ? current.availabilitySlots.filter((item) => item !== slot)
        : [...current.availabilitySlots, slot],
    }));
  };

  const handleCountryChange = (country: string) => {
    setFormData((current) => ({
      ...current,
      country,
      timezone:
        country === "Brazil" && !current.timezone
          ? "America/Sao_Paulo"
          : current.timezone,
      availabilityTimezone:
        country === "Brazil" && !current.availabilityTimezone
          ? "America/Sao_Paulo"
          : current.availabilityTimezone,
    }));
  };

  const handleTimezoneChange = (timezone: string) => {
    setFormData((current) => ({
      ...current,
      timezone,
      availabilityTimezone: timezone,
    }));
  };

  const buildAvailabilitySummary = () => {
    const groupedSlots = weekDays
      .map((day) => {
        const times = formData.availabilitySlots
          .filter((slot) => slot.startsWith(`${day} `))
          .map((slot) => slot.replace(`${day} `, ""));
        return times.length > 0 ? `${day} ${times.join(", ")}` : null;
      })
      .filter(Boolean)
      .join("; ");
    const notes = formData.availabilityNotes.trim();
    return `Timezone: ${formData.availabilityTimezone}; ${groupedSlots}${notes ? `; Notes: ${notes}` : ""}`;
  };

  const canContinueStep1 =
    formData.termsAccepted &&
    formData.lgpdAccepted &&
    formData.fullName.trim() &&
    formData.email.trim() &&
    formData.phoneWhatsapp.trim() &&
    formData.country.trim() &&
    formData.timezone.trim() &&
    Number(formData.expectedHourlyRateUsd) > 0 &&
    formData.workHistory.length > 0 &&
    formData.workHistory.every((item) => item.company.trim() && item.jobTitle.trim());

  const requiredQuestionsAnswered =
    inviteData?.vettingQuestions
      .filter((question) => question.isRequired)
      .every((question) =>
        formData.sampleAnswers.find((answer) => answer.questionId === question.id)?.answerText.trim()
      ) ?? true;

  const conflictCheckComplete =
    formData.conflictChoice === "no" ||
    (formData.conflictChoice === "yes" && Boolean(formData.conflictDetails.trim()));

  const canSubmit =
    canContinueStep1 &&
    formData.availabilitySlots.length > 0 &&
    conflictCheckComplete &&
    requiredQuestionsAnswered;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t.loadingInvite}</p>
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
              <h2 className="text-xl font-semibold">{t.invalidInviteTitle}</h2>
              <p className="mt-2 text-muted-foreground">{t.invalidInviteDescription}</p>
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
              <h2 className="text-xl font-semibold">{t.submittedTitle}</h2>
              <p className="mt-2 text-muted-foreground">
                {t.submittedDescription}
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
          <div className="flex items-center gap-3">
            <Select value={language} onValueChange={(value) => updateLanguage(value as QuickInviteLanguage)}>
              <SelectTrigger className="w-[160px]" data-testid="select-onboarding-language">
                <SelectValue placeholder={t.languageLabel} />
              </SelectTrigger>
              <SelectContent>
                {quickInviteLanguages.map((option) => (
                  <SelectItem key={option} value={option}>
                    {languageLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{t.stepLabel.replace("{step}", String(step))}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.pageTitle}</CardTitle>
            <CardDescription>
              {t.pageDescription}
            </CardDescription>
          </CardHeader>
        </Card>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t.stepOneTitle}</CardTitle>
              <CardDescription>{t.stepOneDescription}</CardDescription>
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
                  <Label htmlFor="termsAccepted" className="leading-relaxed">
                    {t.termsPrefix}{" "}
                    <a
                      className="text-primary underline underline-offset-2"
                      href={legalUrl("/terms")}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t.termsLink}
                    </a>
                    .
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
                  <Label htmlFor="lgpdAccepted" className="leading-relaxed">
                    {t.privacyPrefix}{" "}
                    <a
                      className="text-primary underline underline-offset-2"
                      href={legalUrl("/privacy")}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t.privacyLink}
                    </a>
                    .
                  </Label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName">{t.fullName}</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                    data-testid="input-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneWhatsapp">{t.phoneWhatsapp}</Label>
                  <Input
                    id="phoneWhatsapp"
                    value={formData.phoneWhatsapp}
                    onChange={(event) => setFormData({ ...formData, phoneWhatsapp: event.target.value })}
                    data-testid="input-phone-whatsapp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">{t.country}</Label>
                  <SearchableSelect
                    value={formData.country}
                    options={countries}
                    placeholder={t.country}
                    searchPlaceholder="Search country..."
                    onChange={handleCountryChange}
                    dataTestId="select-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t.timezone}</Label>
                  <SearchableSelect
                    value={formData.timezone}
                    options={timezones}
                    placeholder={t.timezone}
                    searchPlaceholder="Search timezone..."
                    onChange={handleTimezoneChange}
                    dataTestId="select-timezone"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="expectedHourlyRateUsd">{t.expectedHourlyRateUsd}</Label>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t.workHistory}</Label>
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
                    {t.addRole}
                  </Button>
                </div>
                {formData.workHistory.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                    <Input
                      placeholder={t.companyPlaceholder}
                      value={item.company}
                      onChange={(event) => updateWorkHistory(index, { company: event.target.value })}
                      data-testid={`input-work-company-${index}`}
                    />
                    <Input
                      placeholder={t.jobTitlePlaceholder}
                      value={item.jobTitle}
                      onChange={(event) => updateWorkHistory(index, { jobTitle: event.target.value })}
                      data-testid={`input-work-title-${index}`}
                    />
                    <Input
                      placeholder={t.fromYearPlaceholder}
                      value={item.fromYear}
                      onChange={(event) => updateWorkHistory(index, { fromYear: event.target.value })}
                      data-testid={`input-work-from-${index}`}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder={t.toYearPlaceholder}
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
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{t.stepTwoTitle}</CardTitle>
              <CardDescription>{t.stepTwoDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-md border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.project}</p>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Label>{t.weeklyAvailability}</Label>
                  <Select
                    value={formData.availabilityTimezone}
                    onValueChange={(value) => setFormData({ ...formData, availabilityTimezone: value })}
                  >
                    <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-availability-timezone">
                      <SelectValue placeholder={t.timezone} />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-8 border-b bg-muted/40 text-xs font-medium">
                      <div className="p-2">{t.block}</div>
                      {weekDays.map((day) => (
                        <div key={day} className="p-2 text-center">
                          {day}
                        </div>
                      ))}
                    </div>
                    {availabilityBlocks.map((block) => (
                      <div key={block.id} className="grid grid-cols-8 border-b last:border-b-0">
                        <div className="p-2 text-sm">
                          <p className="font-medium">{block.label}</p>
                          <p className="text-xs text-muted-foreground">{block.time}</p>
                        </div>
                        {weekDays.map((day) => {
                          const slot = `${day} ${block.time}`;
                          const selected = formData.availabilitySlots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              className={`m-1 rounded border px-2 py-3 text-xs transition-colors ${
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-muted"
                              }`}
                              onClick={() => toggleAvailabilitySlot(slot)}
                              data-testid={`button-availability-${day}-${block.label.toLowerCase()}`}
                            >
                              {selected ? t.available : t.select}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <Textarea
                  className="min-h-[80px]"
                  placeholder={t.availabilityNotesPlaceholder}
                  value={formData.availabilityNotes}
                  onChange={(event) => setFormData({ ...formData, availabilityNotes: event.target.value })}
                  data-testid="input-availability-notes"
                />
              </div>
              <div className="space-y-3">
                <Label>{t.conflictCheck}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={formData.conflictChoice === "no" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, conflictChoice: "no", conflictDetails: "" })}
                    data-testid="button-conflict-no"
                  >
                    {t.noConflict}
                  </Button>
                  <Button
                    type="button"
                    variant={formData.conflictChoice === "yes" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, conflictChoice: "yes" })}
                    data-testid="button-conflict-yes"
                  >
                    {t.hasConflict}
                  </Button>
                </div>
                {formData.conflictChoice === "yes" && (
                  <Textarea
                    className="min-h-[90px]"
                    placeholder={t.conflictDetailsPlaceholder}
                    value={formData.conflictDetails}
                    onChange={(event) => setFormData({ ...formData, conflictDetails: event.target.value })}
                    data-testid="input-conflict-details"
                  />
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>{t.vettingQuestions}</Label>
                {inviteData.vettingQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noVettingQuestions}</p>
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
            {t.back}
          </Button>

          {step < 2 ? (
            <Button
              type="button"
              disabled={!canContinueStep1}
              onClick={() => setStep((current) => Math.min(2, current + 1))}
              data-testid="button-next"
            >
              {t.continue}
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
                  {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  onChange,
  dataTestId,
}: {
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  onChange: (value: string) => void;
  dataTestId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(query.trim().toLowerCase())
  );

  const selectOption = (option: string) => {
    onChange(option);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen((current) => !current)}
        data-testid={dataTestId}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2"
            data-testid={`${dataTestId}-search`}
          />
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No results found.</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => selectOption(option)}
                >
                  <span>{option}</span>
                  {value === option && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
