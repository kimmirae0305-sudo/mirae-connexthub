import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RoleGuard } from "@/lib/auth";

type EmailTemplateType = "advisor_initial_invite" | "advisor_follow_up" | "advisor_resend";
type EmailTemplateLanguage = "en" | "pt-BR" | "es";

type EmailTemplate = {
  id: number | null;
  templateType: EmailTemplateType;
  language: EmailTemplateLanguage;
  subject: string;
  body: string;
  description?: string | null;
  isActive: boolean;
  updatedAt?: string | null;
  source?: "managed" | "default" | string;
};

type EmailTemplatesResponse = {
  templates: EmailTemplate[];
  templateTypes: EmailTemplateType[];
  languages: EmailTemplateLanguage[];
  allowedVariables: string[];
};

const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  advisor_initial_invite: "Advisor initial invite",
  advisor_follow_up: "Advisor follow-up",
  advisor_resend: "Advisor resend",
};

const LANGUAGE_LABELS: Record<EmailTemplateLanguage, string> = {
  en: "English",
  "pt-BR": "Portuguese",
  es: "Spanish",
};

const SAMPLE_VALUES: Record<string, string> = {
  advisorName: "Maria",
  senderName: "Mirae",
  senderTitle: "Co Founder & COO | Mirae Connext",
  senderEmail: "mirae@miraeconnext.com",
  senderMobile: "+55 11 95500 7861",
  reviewLink: "https://miraeconnexthub.com/public/advisor-project-review/sample-token",
  declineLink: "https://miraeconnexthub.com/public/advisor-project-review/sample-token?intent=decline",
  advisorActions:
    "Review Project:\nhttps://miraeconnexthub.com/public/advisor-project-review/sample-token\n\nDecline this invitation:\nhttps://miraeconnexthub.com/public/advisor-project-review/sample-token?intent=decline",
  companyName: "Mirae Connext",
  platformName: "Mirae Connext",
  brandName: "Mirae Connext",
};

function getUnsupportedVariables(subject: string, body: string, allowedVariables: string[]) {
  const allowed = new Set(allowedVariables);
  const unsupported = new Set<string>();
  const pattern = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  const content = `${subject || ""}\n${body || ""}`;

  while ((match = pattern.exec(content)) !== null) {
    if (!allowed.has(match[1])) unsupported.add(match[1]);
  }

  return Array.from(unsupported);
}

function renderPreview(value: string) {
  return String(value || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, variableName) => {
    return SAMPLE_VALUES[variableName] || "";
  });
}

function EmailTemplatesContent() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<EmailTemplateType>("advisor_initial_invite");
  const [selectedLanguage, setSelectedLanguage] = useState<EmailTemplateLanguage>("en");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loadedKey, setLoadedKey] = useState("");

  const { data, isLoading } = useQuery<EmailTemplatesResponse>({
    queryKey: ["/api/email/templates"],
  });

  const selectedTemplate = useMemo(() => {
    return data?.templates.find(
      (template) => template.templateType === selectedType && template.language === selectedLanguage
    );
  }, [data?.templates, selectedLanguage, selectedType]);

  const selectedKey = `${selectedType}:${selectedLanguage}:${selectedTemplate?.id ?? "default"}:${selectedTemplate?.updatedAt ?? ""}`;
  useEffect(() => {
    if (!selectedTemplate || selectedKey === loadedKey) return;
    setLoadedKey(selectedKey);
    setSubject(selectedTemplate.subject || "");
    setBody(selectedTemplate.body || "");
  }, [loadedKey, selectedKey, selectedTemplate]);

  const allowedVariables = data?.allowedVariables || [];
  const unsupportedVariables = getUnsupportedVariables(subject, body, allowedVariables);
  const canSave = subject.trim() && body.trim() && unsupportedVariables.length === 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        templateType: selectedType,
        language: selectedLanguage,
        subject: subject.trim(),
        body: body.trim(),
        description: selectedTemplate?.description || null,
        isActive: selectedTemplate?.isActive !== false,
      };
      const res = selectedTemplate?.id
        ? await apiRequest("PATCH", `/api/email/templates/${selectedTemplate.id}`, payload)
        : await apiRequest("POST", "/api/email/templates", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/templates"] });
      toast({ title: "Email template saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save template",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email/templates/reset-default", {
        templateType: selectedType,
        language: selectedLanguage,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/templates"] });
      toast({ title: "Template reset to default" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reset template",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  const copyVariable = async (variable: string) => {
    try {
      await navigator.clipboard.writeText(`{{${variable}}}`);
      toast({ title: `Copied {{${variable}}}` });
    } catch {
      toast({ title: "Unable to copy variable", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
        <p className="text-sm text-muted-foreground">
          Manage advisor-facing operational email copy. Branded signatures and secure review links remain controlled by the CRM.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Advisor Email Template</CardTitle>
                <CardDescription>
                  Edit only the main message above the CRM-controlled branded signature.
                </CardDescription>
              </div>
              <Badge variant={selectedTemplate?.source === "managed" ? "default" : "outline"}>
                {selectedTemplate?.source === "managed" ? "Managed" : "Default fallback"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template type</Label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as EmailTemplateType)}>
                  <SelectTrigger data-testid="select-email-template-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.templateTypes || Object.keys(TEMPLATE_LABELS)).map((type) => (
                      <SelectItem key={type} value={type}>
                        {TEMPLATE_LABELS[type as EmailTemplateType] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as EmailTemplateLanguage)}>
                  <SelectTrigger data-testid="select-email-template-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.languages || Object.keys(LANGUAGE_LABELS)).map((language) => (
                      <SelectItem key={language} value={language}>
                        {LANGUAGE_LABELS[language as EmailTemplateLanguage] || language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={isLoading}
                data-testid="input-email-template-subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={isLoading}
                className="min-h-[340px] font-mono text-sm"
                data-testid="textarea-email-template-body"
              />
              <p className="text-xs text-muted-foreground">
                Plain text only. Line breaks are preserved and review links are rendered clickable in the sent HTML email.
              </p>
            </div>

            {unsupportedVariables.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Unsupported variables: {unsupportedVariables.join(", ")}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                data-testid="button-save-email-template"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save template"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                data-testid="button-reset-email-template"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to default
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allowed Variables</CardTitle>
              <CardDescription>
                Copy variables into the subject or body. Unsupported variables are blocked.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {allowedVariables.map((variable) => (
                <Button
                  key={variable}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyVariable(variable)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {`{{${variable}}}`}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sample Preview</CardTitle>
              <CardDescription>
                Uses sample advisor/sender values. The real branded signature is appended at send time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Subject</p>
                <p className="text-sm">{renderPreview(subject) || "No subject"}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Body</p>
                <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm font-sans">
                  {renderPreview(body) || "No body"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplates() {
  return (
    <RoleGuard requiredPage="email-templates">
      <EmailTemplatesContent />
    </RoleGuard>
  );
}
