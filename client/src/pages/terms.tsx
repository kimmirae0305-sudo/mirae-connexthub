import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import {
  normalizeQuickInviteLanguage,
  quickInviteLanguages,
  type QuickInviteLanguage,
  termsContent,
} from "@/lib/translations/quick-invite-onboarding";
import logoPath from "@assets/Logo_1764384177823.png";

const languageLabels: Record<QuickInviteLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
};

export default function TermsPage() {
  const [language, setLanguage] = useState<QuickInviteLanguage>(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeQuickInviteLanguage(params.get("lang"));
  });
  const content = termsContent[language];

  const updateLanguage = (value: QuickInviteLanguage) => {
    setLanguage(value);
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("lang", value);
    window.history.replaceState(null, "", `/terms?${nextParams.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
          <Select value={language} onValueChange={(value) => updateLanguage(value as QuickInviteLanguage)}>
            <SelectTrigger className="w-[160px]" data-testid="select-legal-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quickInviteLanguages.map((option) => (
                <SelectItem key={option} value={option}>
                  {languageLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{content.title}</CardTitle>
            <CardDescription>Version: {content.effectiveDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            {content.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
