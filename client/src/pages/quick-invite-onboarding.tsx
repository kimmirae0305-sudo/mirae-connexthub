import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertCircle, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    acceptTermsPrefix: "I accept the ",
    termsLink: "Terms & Conditions",
    acceptLGPDPrefix: "I accept the ",
    lgpdLink: "LGPD Data Privacy Policy",
    continue: "Continue to Project",
    loading: "Loading...",
    submitting: "Submitting...",
    invalidLink: "Invalid Invite Link",
    linkExpired: "This link has expired or is no longer valid",
    termsModalTitle: "Terms & Conditions",
    lgpdModalTitle: "LGPD Data Privacy Policy",
    close: "Close",
  },
  pt: {
    title: "Complete Seu Perfil",
    subtitle: "Preencha suas informações para participar do projeto",
    firstName: "Primeiro Nome",
    lastName: "Sobrenome",
    email: "Email",
    phone: "Telefone (opcional)",
    acceptTermsPrefix: "Aceito os ",
    termsLink: "Termos & Condições",
    acceptLGPDPrefix: "Aceito a ",
    lgpdLink: "Política de Privacidade LGPD",
    continue: "Continuar para o Projeto",
    loading: "Carregando...",
    submitting: "Enviando...",
    invalidLink: "Link de Convite Inválido",
    linkExpired: "Este link expirou ou não é mais válido",
    termsModalTitle: "Termos & Condições",
    lgpdModalTitle: "Política de Privacidade LGPD",
    close: "Fechar",
  },
  es: {
    title: "Completa Tu Perfil",
    subtitle: "Rellena tu información para unirte al proyecto",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo Electrónico",
    phone: "Teléfono (opcional)",
    acceptTermsPrefix: "Acepto los ",
    termsLink: "Términos y Condiciones",
    acceptLGPDPrefix: "Acepto la ",
    lgpdLink: "Política de Privacidad LGPD",
    continue: "Continuar al Proyecto",
    loading: "Cargando...",
    submitting: "Enviando...",
    invalidLink: "Enlace de Invitación Inválido",
    linkExpired: "Este enlace ha expirado o ya no es válido",
    termsModalTitle: "Términos y Condiciones",
    lgpdModalTitle: "Política de Privacidad LGPD",
    close: "Cerrar",
  },
};

const termsContent = {
  en: `TERMS AND CONDITIONS OF USE

Last updated: November 2024

1. ACCEPTANCE OF TERMS
By accessing and using the Mirae Connext platform ("Platform"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use our services.

2. DESCRIPTION OF SERVICES
Mirae Connext provides an expert network platform connecting professionals with organizations seeking specialized knowledge and insights. Our services include:
- Expert profile management
- Project matching and assignments
- Consultation scheduling
- Payment processing for expert services

3. USER RESPONSIBILITIES
As a user of our Platform, you agree to:
- Provide accurate and complete information
- Maintain the confidentiality of your account credentials
- Comply with all applicable laws and regulations
- Not misrepresent your qualifications or expertise
- Respect intellectual property rights

4. EXPERT OBLIGATIONS
Experts registered on the Platform agree to:
- Provide truthful information about their background and expertise
- Maintain professional conduct during all engagements
- Protect confidential information shared during consultations
- Comply with any non-disclosure agreements
- Not engage in activities that conflict with client interests

5. INTELLECTUAL PROPERTY
All content, trademarks, and materials on the Platform are owned by Mirae Connext or its licensors. Users may not reproduce, distribute, or create derivative works without prior written consent.

6. LIMITATION OF LIABILITY
Mirae Connext shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services.

7. TERMINATION
We reserve the right to terminate or suspend accounts that violate these terms or engage in fraudulent activities.

8. GOVERNING LAW
These terms shall be governed by and construed in accordance with applicable laws.

9. CONTACT INFORMATION
For questions about these Terms, please contact: legal@miraeconnext.com`,

  pt: `TERMOS E CONDIÇÕES DE USO

Última atualização: Novembro de 2024

1. ACEITAÇÃO DOS TERMOS
Ao acessar e usar a plataforma Mirae Connext ("Plataforma"), você concorda em estar vinculado a estes Termos e Condições. Se você não concordar com qualquer parte destes termos, não poderá usar nossos serviços.

2. DESCRIÇÃO DOS SERVIÇOS
A Mirae Connext fornece uma plataforma de rede de especialistas conectando profissionais com organizações que buscam conhecimento e insights especializados. Nossos serviços incluem:
- Gerenciamento de perfil de especialista
- Correspondência e atribuições de projetos
- Agendamento de consultas
- Processamento de pagamentos para serviços de especialistas

3. RESPONSABILIDADES DO USUÁRIO
Como usuário de nossa Plataforma, você concorda em:
- Fornecer informações precisas e completas
- Manter a confidencialidade de suas credenciais de conta
- Cumprir todas as leis e regulamentos aplicáveis
- Não deturpar suas qualificações ou expertise
- Respeitar direitos de propriedade intelectual

4. OBRIGAÇÕES DO ESPECIALISTA
Especialistas registrados na Plataforma concordam em:
- Fornecer informações verdadeiras sobre sua formação e expertise
- Manter conduta profissional durante todos os engajamentos
- Proteger informações confidenciais compartilhadas durante consultas
- Cumprir quaisquer acordos de não divulgação
- Não se envolver em atividades que conflitem com interesses do cliente

5. PROPRIEDADE INTELECTUAL
Todo o conteúdo, marcas registradas e materiais na Plataforma são de propriedade da Mirae Connext ou de seus licenciadores.

6. LIMITAÇÃO DE RESPONSABILIDADE
A Mirae Connext não será responsável por quaisquer danos indiretos, incidentais, especiais ou consequentes decorrentes do uso de nossos serviços.

7. RESCISÃO
Reservamo-nos o direito de encerrar ou suspender contas que violem estes termos ou se envolvam em atividades fraudulentas.

8. LEI APLICÁVEL
Estes termos serão regidos e interpretados de acordo com as leis aplicáveis.

9. INFORMAÇÕES DE CONTATO
Para perguntas sobre estes Termos, entre em contato: legal@miraeconnext.com`,

  es: `TÉRMINOS Y CONDICIONES DE USO

Última actualización: Noviembre de 2024

1. ACEPTACIÓN DE LOS TÉRMINOS
Al acceder y utilizar la plataforma Mirae Connext ("Plataforma"), acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá utilizar nuestros servicios.

2. DESCRIPCIÓN DE LOS SERVICIOS
Mirae Connext proporciona una plataforma de red de expertos que conecta profesionales con organizaciones que buscan conocimientos e información especializada. Nuestros servicios incluyen:
- Gestión de perfiles de expertos
- Emparejamiento y asignaciones de proyectos
- Programación de consultas
- Procesamiento de pagos por servicios de expertos

3. RESPONSABILIDADES DEL USUARIO
Como usuario de nuestra Plataforma, acepta:
- Proporcionar información precisa y completa
- Mantener la confidencialidad de sus credenciales de cuenta
- Cumplir con todas las leyes y regulaciones aplicables
- No tergiversar sus calificaciones o experiencia
- Respetar los derechos de propiedad intelectual

4. OBLIGACIONES DEL EXPERTO
Los expertos registrados en la Plataforma aceptan:
- Proporcionar información veraz sobre su formación y experiencia
- Mantener una conducta profesional durante todos los compromisos
- Proteger la información confidencial compartida durante las consultas
- Cumplir con cualquier acuerdo de confidencialidad
- No participar en actividades que entren en conflicto con los intereses del cliente

5. PROPIEDAD INTELECTUAL
Todo el contenido, marcas comerciales y materiales en la Plataforma son propiedad de Mirae Connext o sus licenciantes.

6. LIMITACIÓN DE RESPONSABILIDAD
Mirae Connext no será responsable de ningún daño indirecto, incidental, especial o consecuente que surja del uso de nuestros servicios.

7. TERMINACIÓN
Nos reservamos el derecho de terminar o suspender cuentas que violen estos términos o participen en actividades fraudulentas.

8. LEY APLICABLE
Estos términos se regirán e interpretarán de acuerdo con las leyes aplicables.

9. INFORMACIÓN DE CONTACTO
Para preguntas sobre estos Términos, comuníquese con: legal@miraeconnext.com`,
};

const lgpdContent = {
  en: `LGPD DATA PRIVACY POLICY

Last updated: November 2024

This Privacy Policy describes how Mirae Connext collects, uses, and protects your personal data in accordance with the Brazilian General Data Protection Law (LGPD - Lei Geral de Proteção de Dados).

1. DATA CONTROLLER
Mirae Connext is the data controller responsible for processing your personal data.

2. PERSONAL DATA WE COLLECT
We collect the following categories of personal data:
- Identification data: name, email, phone number
- Professional data: job title, company, expertise, work history
- Usage data: platform interactions, consultation history
- Communication data: messages exchanged through the platform

3. PURPOSE OF DATA PROCESSING
Your personal data is processed for:
- Account creation and management
- Expert-client matching
- Consultation scheduling and management
- Payment processing
- Communication regarding our services
- Legal compliance

4. LEGAL BASIS FOR PROCESSING
We process your data based on:
- Consent: when you accept these terms
- Contract performance: to provide our services
- Legitimate interests: to improve our platform
- Legal obligations: to comply with applicable laws

5. DATA SHARING
Your data may be shared with:
- Clients seeking expert consultations
- Payment processors
- Service providers (hosting, analytics)
- Legal authorities when required by law

6. DATA RETENTION
We retain your personal data for as long as necessary to fulfill the purposes described in this policy, or as required by law.

7. YOUR RIGHTS
Under LGPD, you have the right to:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Revoke consent
- Request data portability
- Object to processing

8. DATA SECURITY
We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.

9. INTERNATIONAL TRANSFERS
Your data may be transferred to countries outside Brazil. We ensure adequate protection measures are in place for such transfers.

10. CONTACT
For questions about this policy or to exercise your rights:
Data Protection Officer: dpo@miraeconnext.com

11. UPDATES
We may update this policy periodically. Significant changes will be communicated through the platform.`,

  pt: `POLÍTICA DE PRIVACIDADE LGPD

Última atualização: Novembro de 2024

Esta Política de Privacidade descreve como a Mirae Connext coleta, usa e protege seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD).

1. CONTROLADOR DE DADOS
A Mirae Connext é o controlador de dados responsável pelo tratamento de seus dados pessoais.

2. DADOS PESSOAIS QUE COLETAMOS
Coletamos as seguintes categorias de dados pessoais:
- Dados de identificação: nome, email, telefone
- Dados profissionais: cargo, empresa, expertise, histórico de trabalho
- Dados de uso: interações na plataforma, histórico de consultas
- Dados de comunicação: mensagens trocadas através da plataforma

3. FINALIDADE DO TRATAMENTO DE DADOS
Seus dados pessoais são tratados para:
- Criação e gerenciamento de conta
- Correspondência entre especialistas e clientes
- Agendamento e gerenciamento de consultas
- Processamento de pagamentos
- Comunicação sobre nossos serviços
- Conformidade legal

4. BASE LEGAL PARA O TRATAMENTO
Tratamos seus dados com base em:
- Consentimento: quando você aceita estes termos
- Execução de contrato: para fornecer nossos serviços
- Interesses legítimos: para melhorar nossa plataforma
- Obrigações legais: para cumprir as leis aplicáveis

5. COMPARTILHAMENTO DE DADOS
Seus dados podem ser compartilhados com:
- Clientes que buscam consultas com especialistas
- Processadores de pagamento
- Prestadores de serviços (hospedagem, análise)
- Autoridades legais quando exigido por lei

6. RETENÇÃO DE DADOS
Retemos seus dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, ou conforme exigido por lei.

7. SEUS DIREITOS
De acordo com a LGPD, você tem o direito de:
- Acessar seus dados pessoais
- Corrigir dados imprecisos
- Solicitar exclusão de seus dados
- Revogar consentimento
- Solicitar portabilidade de dados
- Opor-se ao tratamento

8. SEGURANÇA DOS DADOS
Implementamos medidas técnicas e organizacionais apropriadas para proteger seus dados pessoais contra acesso, alteração, divulgação ou destruição não autorizados.

9. TRANSFERÊNCIAS INTERNACIONAIS
Seus dados podem ser transferidos para países fora do Brasil. Garantimos que medidas de proteção adequadas estejam em vigor para tais transferências.

10. CONTATO
Para perguntas sobre esta política ou para exercer seus direitos:
Encarregado de Proteção de Dados: dpo@miraeconnext.com

11. ATUALIZAÇÕES
Podemos atualizar esta política periodicamente. Mudanças significativas serão comunicadas através da plataforma.`,

  es: `POLÍTICA DE PRIVACIDAD LGPD

Última actualización: Noviembre de 2024

Esta Política de Privacidad describe cómo Mirae Connext recopila, utiliza y protege sus datos personales de acuerdo con la Ley General de Protección de Datos de Brasil (LGPD).

1. CONTROLADOR DE DATOS
Mirae Connext es el controlador de datos responsable del tratamiento de sus datos personales.

2. DATOS PERSONALES QUE RECOPILAMOS
Recopilamos las siguientes categorías de datos personales:
- Datos de identificación: nombre, correo electrónico, teléfono
- Datos profesionales: cargo, empresa, experiencia, historial laboral
- Datos de uso: interacciones en la plataforma, historial de consultas
- Datos de comunicación: mensajes intercambiados a través de la plataforma

3. PROPÓSITO DEL TRATAMIENTO DE DATOS
Sus datos personales se procesan para:
- Creación y gestión de cuentas
- Emparejamiento entre expertos y clientes
- Programación y gestión de consultas
- Procesamiento de pagos
- Comunicación sobre nuestros servicios
- Cumplimiento legal

4. BASE LEGAL PARA EL TRATAMIENTO
Procesamos sus datos basándonos en:
- Consentimiento: cuando acepta estos términos
- Ejecución de contrato: para proporcionar nuestros servicios
- Intereses legítimos: para mejorar nuestra plataforma
- Obligaciones legales: para cumplir con las leyes aplicables

5. COMPARTIR DATOS
Sus datos pueden compartirse con:
- Clientes que buscan consultas con expertos
- Procesadores de pagos
- Proveedores de servicios (alojamiento, análisis)
- Autoridades legales cuando lo exija la ley

6. RETENCIÓN DE DATOS
Conservamos sus datos personales durante el tiempo necesario para cumplir los propósitos descritos en esta política, o según lo exija la ley.

7. SUS DERECHOS
Según la LGPD, tiene derecho a:
- Acceder a sus datos personales
- Corregir datos inexactos
- Solicitar la eliminación de sus datos
- Revocar el consentimiento
- Solicitar la portabilidad de datos
- Oponerse al tratamiento

8. SEGURIDAD DE DATOS
Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos personales contra acceso, alteración, divulgación o destrucción no autorizados.

9. TRANSFERENCIAS INTERNACIONALES
Sus datos pueden transferirse a países fuera de Brasil. Garantizamos que existan medidas de protección adecuadas para dichas transferencias.

10. CONTACTO
Para preguntas sobre esta política o para ejercer sus derechos:
Oficial de Protección de Datos: dpo@miraeconnext.com

11. ACTUALIZACIONES
Podemos actualizar esta política periódicamente. Los cambios significativos se comunicarán a través de la plataforma.`,
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showLGPDModal, setShowLGPDModal] = useState(false);

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
            className="text-sm border rounded px-2 py-1"
            data-testid="select-language"
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
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                  className="mt-0.5"
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  {t.acceptTermsPrefix}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                    className="text-primary underline hover:text-primary/80"
                    data-testid="link-terms"
                  >
                    {t.termsLink}
                  </button>
                </label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="lgpd"
                  checked={acceptedLGPD}
                  onCheckedChange={(checked) => setAcceptedLGPD(checked as boolean)}
                  className="mt-0.5"
                  data-testid="checkbox-lgpd"
                />
                <label htmlFor="lgpd" className="text-sm cursor-pointer">
                  {t.acceptLGPDPrefix}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowLGPDModal(true);
                    }}
                    className="text-primary underline hover:text-primary/80"
                    data-testid="link-lgpd"
                  >
                    {t.lgpdLink}
                  </button>
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

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t.termsModalTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {termsContent[language]}
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTermsModal(false)} data-testid="button-close-terms">
              {t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLGPDModal} onOpenChange={setShowLGPDModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t.lgpdModalTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {lgpdContent[language]}
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowLGPDModal(false)} data-testid="button-close-lgpd">
              {t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
