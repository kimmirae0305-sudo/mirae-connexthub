import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/Logo_1764384177823.png";

interface InviteData {
  candidateName: string;
  projectName: string;
  projectId: number;
}

const i18n = {
  en: {
    title: "Complete Your Profile",
    subtitle: "Fill in your information to join the project",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    phone: "Phone (optional)",
    acceptTerms: "I accept the Terms & Conditions",
    acceptLGPD: "I accept the LGPD Data Privacy Policy",
    continue: "Continue to Project",
    loading: "Loading...",
    submitting: "Submitting...",
    invalidLink: "Invalid Invite Link",
    linkExpired: "This link has expired or is no longer valid",
    termsModal: "Terms & Conditions",
    lgpdModal: "LGPD Privacy Policy",
  },
  pt: {
    title: "Complete Seu Perfil",
    subtitle: "Preencha suas informações para participar do projeto",
    firstName: "Primeiro Nome",
    lastName: "Sobrenome",
    email: "Email",
    phone: "Telefone (opcional)",
    acceptTerms: "Aceito os Termos & Condições",
    acceptLGPD: "Aceito a Política de Privacidade LGPD",
    continue: "Continuar para o Projeto",
    loading: "Carregando...",
    submitting: "Enviando...",
    invalidLink: "Link de Convite Inválido",
    linkExpired: "Este link expirou ou não é mais válido",
    termsModal: "Termos & Condições",
    lgpdModal: "Política de Privacidade LGPD",
  },
  es: {
    title: "Completa Tu Perfil",
    subtitle: "Rellena tu información para unirte al proyecto",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo Electrónico",
    phone: "Teléfono (opcional)",
    acceptTerms: "Acepto los Términos y Condiciones",
    acceptLGPD: "Acepto la Política de Privacidad LGPD",
    continue: "Continuar al Proyecto",
    loading: "Cargando...",
    submitting: "Enviando...",
    invalidLink: "Enlace de Invitación Inválido",
    linkExpired: "Este enlace ha expirado o ya no es válido",
    termsModal: "Términos y Condiciones",
    lgpdModal: "Política de Privacidad LGPD",
  },
};

export default function QuickInviteOnboarding() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [language, setLanguage] = useState<"en" | "pt" | "es">("en");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedLGPD, setAcceptedLGPD] = useState(false);

  const t = i18n[language];

  const { data: inviteData, isLoading, error } = useQuery({
    queryKey: [`/api/quick-invite/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/quick-invite/${token}`);
      if (!res.ok) throw new Error("Invalid invite link");
      return res.json() as Promise<InviteData>;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quick-invite/${token}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile saved!", description: "Now let's learn about the project" });
      setTimeout(() => {
        window.location.href = `/invite/decide/${token}`;
      }, 1500);
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
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t.loading}</p>
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
              <h2 className="text-xl font-semibold">{t.invalidLink}</h2>
              <p className="mt-2 text-muted-foreground">{t.linkExpired}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <img src={logoPath} alt="Mirae Connext" className="h-10 w-auto" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "pt" | "es")}
            className="text-sm"
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t.firstName}</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                data-testid="input-firstName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t.lastName}</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                data-testid="input-lastName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  {t.acceptTerms}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="lgpd"
                  checked={acceptedLGPD}
                  onCheckedChange={(checked) => setAcceptedLGPD(checked as boolean)}
                  data-testid="checkbox-lgpd"
                />
                <label htmlFor="lgpd" className="text-sm cursor-pointer">
                  {t.acceptLGPD}
                </label>
              </div>
            </div>

            <Button
              onClick={() => submitMutation.mutate()}
              disabled={
                !formData.firstName ||
                !formData.lastName ||
                !formData.email ||
                !acceptedTerms ||
                !acceptedLGPD ||
                submitMutation.isPending
              }
              className="w-full"
              data-testid="button-continue"
            >
              {submitMutation.isPending ? t.submitting : t.continue}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
