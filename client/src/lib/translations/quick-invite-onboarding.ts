import {
  EXPERT_TERMS_VERSION,
  POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
  QUICK_INVITE_ORGANIZATION_CONFIG,
  QUICK_INVITE_SUPPORTED_LANGUAGES,
  type QuickInviteSupportedLanguage,
} from "@shared/quickInvitePolicy";

export {
  EXPERT_TERMS_VERSION,
  POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
  QUICK_INVITE_ORGANIZATION_CONFIG,
};

export const TERMS_VERSION = EXPERT_TERMS_VERSION;
export const quickInviteLanguages = QUICK_INVITE_SUPPORTED_LANGUAGES;
export type QuickInviteLanguage = QuickInviteSupportedLanguage;

export interface PolicySection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface PolicyContent {
  title: string;
  effectiveDate: string;
  version: string;
  sections: PolicySection[];
}

export const quickInviteLanguageLabels: Record<QuickInviteLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
};

export function normalizeQuickInviteLanguage(value: string | null | undefined): QuickInviteLanguage {
  if (value === "pt" || value === "pt-BR") return "pt-BR";
  if (value === "es") return "es";
  return "en";
}

const brandName = QUICK_INVITE_ORGANIZATION_CONFIG.brandName;
const legalContactEmail = QUICK_INVITE_ORGANIZATION_CONFIG.legalContactEmail;
const consentAuditSummary =
  "The onboarding form records the Terms version, Privacy Policy version, selected consent language, consent source, IP address, user agent, and server-generated consent timestamps for audit purposes.";

export const quickInviteTranslations = {
  en: {
    languageLabel: "Language",
    loadingInvite: "Loading invitation...",
    invalidInviteTitle: "Invalid invite link",
    invalidInviteDescription: "This link has expired or is no longer valid.",
    submittedTitle: "Application submitted",
    submittedDescription: `Thank you. The ${brandName} team will review your profile and project responses.`,
    stepLabel: "Step {step} of 2",
    pageTitle: "Expert onboarding",
    pageDescription: `Complete your profile so ${brandName} can review your fit for this project.`,
    stepOneTitle: "Consent, basic details, and work history",
    stepOneDescription: "All rates are collected in USD for this project application.",
    termsPrefix: `I accept ${brandName}'s`,
    termsLink: "Terms & Conditions",
    privacyPrefix: "I consent to the collection and processing of my personal data in accordance with LGPD and the",
    privacyLink: "Privacy Policy",
    fullName: "Full name",
    email: "Email",
    phoneWhatsapp: "Phone/WhatsApp",
    country: "Country",
    city: "City",
    currentTitle: "Current title",
    currentCompany: "Current company",
    expectedHourlyRateUsd: "Expected hourly rate (USD)",
    workHistory: "Work history",
    addRole: "Add role",
    companyPlaceholder: "Company",
    jobTitlePlaceholder: "Job title",
    fromYearPlaceholder: "From year",
    toYearPlaceholder: "To year or Present",
    stepTwoTitle: "Availability, conflict check, and vetting answers",
    stepTwoDescription: `Answer the project-specific questions so ${brandName} can review your fit.`,
    project: "Project",
    weeklyAvailability: "Weekly availability",
    timezone: "Timezone",
    block: "Block",
    available: "Available",
    select: "Select",
    availabilityNotesPlaceholder: "Optional notes, e.g. flexible with advance notice.",
    conflictCheck: "Conflict check",
    noConflict: "No conflict",
    hasConflict: "Yes, I have a conflict",
    conflictDetailsPlaceholder: "Please describe the conflict, restriction, or sensitive relationship.",
    vettingQuestions: "Vetting questions",
    noVettingQuestions: "No vetting questions have been added for this project yet.",
    back: "Back",
    continue: "Continue",
    submit: "Submit application",
    submitting: "Submitting...",
    submitErrorTitle: "Could not submit onboarding",
    submissionFailed: "Submission failed",
    invalidInviteError: "Invalid invite link",
  },
  "pt-BR": {
    languageLabel: "Idioma",
    loadingInvite: "Carregando convite...",
    invalidInviteTitle: "Link de convite inválido",
    invalidInviteDescription: "Este link expirou ou não é mais válido.",
    submittedTitle: "Candidatura enviada",
    submittedDescription: `Obrigado. A equipe da ${brandName} analisará seu perfil e suas respostas para o projeto.`,
    stepLabel: "Etapa {step} de 2",
    pageTitle: "Onboarding de especialista",
    pageDescription: `Complete seu perfil para que a ${brandName} avalie sua adequação a este projeto.`,
    stepOneTitle: "Consentimento, dados básicos e histórico profissional",
    stepOneDescription: "Todas as tarifas são coletadas em USD para esta candidatura.",
    termsPrefix: "Aceito os",
    termsLink: "Termos e Condições",
    privacyPrefix: "Consinto com a coleta e o tratamento dos meus dados pessoais de acordo com a LGPD e a",
    privacyLink: "Política de Privacidade",
    fullName: "Nome completo",
    email: "E-mail",
    phoneWhatsapp: "Telefone/WhatsApp",
    country: "País",
    city: "Cidade",
    currentTitle: "Cargo atual",
    currentCompany: "Empresa atual",
    expectedHourlyRateUsd: "Valor horário esperado (USD)",
    workHistory: "Histórico profissional",
    addRole: "Adicionar cargo",
    companyPlaceholder: "Empresa",
    jobTitlePlaceholder: "Cargo",
    fromYearPlaceholder: "Ano inicial",
    toYearPlaceholder: "Ano final ou Atual",
    stepTwoTitle: "Disponibilidade, conflito de interesse e respostas",
    stepTwoDescription: `Responda às perguntas específicas do projeto para que a ${brandName} avalie sua adequação.`,
    project: "Projeto",
    weeklyAvailability: "Disponibilidade semanal",
    timezone: "Fuso horário",
    block: "Período",
    available: "Disponível",
    select: "Selecionar",
    availabilityNotesPlaceholder: "Observações opcionais, ex.: flexível com aviso prévio.",
    conflictCheck: "Conflito de interesse",
    noConflict: "Sem conflito",
    hasConflict: "Sim, tenho um conflito",
    conflictDetailsPlaceholder: "Descreva o conflito, restrição ou relação sensível.",
    vettingQuestions: "Perguntas de avaliação",
    noVettingQuestions: "Nenhuma pergunta de avaliação foi adicionada para este projeto.",
    back: "Voltar",
    continue: "Continuar",
    submit: "Enviar candidatura",
    submitting: "Enviando...",
    submitErrorTitle: "Não foi possível enviar o onboarding",
    submissionFailed: "Falha no envio",
    invalidInviteError: "Link de convite inválido",
  },
  es: {
    languageLabel: "Idioma",
    loadingInvite: "Cargando invitación...",
    invalidInviteTitle: "Enlace de invitación inválido",
    invalidInviteDescription: "Este enlace ha expirado o ya no es válido.",
    submittedTitle: "Solicitud enviada",
    submittedDescription: `Gracias. El equipo de ${brandName} revisará su perfil y sus respuestas para el proyecto.`,
    stepLabel: "Paso {step} de 2",
    pageTitle: "Onboarding de experto",
    pageDescription: `Complete su perfil para que ${brandName} evalúe su ajuste para este proyecto.`,
    stepOneTitle: "Consentimiento, datos básicos e historial laboral",
    stepOneDescription: "Todas las tarifas se recopilan en USD para esta solicitud.",
    termsPrefix: "Acepto los",
    termsLink: "Términos y Condiciones",
    privacyPrefix: "Consiento la recopilación y el tratamiento de mis datos personales de acuerdo con la LGPD y la",
    privacyLink: "Política de Privacidad",
    fullName: "Nombre completo",
    email: "Correo electrónico",
    phoneWhatsapp: "Teléfono/WhatsApp",
    country: "País",
    city: "Ciudad",
    currentTitle: "Cargo actual",
    currentCompany: "Empresa actual",
    expectedHourlyRateUsd: "Tarifa horaria esperada (USD)",
    workHistory: "Historial laboral",
    addRole: "Agregar cargo",
    companyPlaceholder: "Empresa",
    jobTitlePlaceholder: "Cargo",
    fromYearPlaceholder: "Año inicial",
    toYearPlaceholder: "Año final o Actual",
    stepTwoTitle: "Disponibilidad, conflicto de interés y respuestas",
    stepTwoDescription: `Responda las preguntas específicas del proyecto para que ${brandName} evalúe su ajuste.`,
    project: "Proyecto",
    weeklyAvailability: "Disponibilidad semanal",
    timezone: "Zona horaria",
    block: "Bloque",
    available: "Disponible",
    select: "Seleccionar",
    availabilityNotesPlaceholder: "Notas opcionales, ej.: flexible con aviso previo.",
    conflictCheck: "Conflicto de interés",
    noConflict: "Sin conflicto",
    hasConflict: "Sí, tengo un conflicto",
    conflictDetailsPlaceholder: "Describa el conflicto, restricción o relación sensible.",
    vettingQuestions: "Preguntas de evaluación",
    noVettingQuestions: "No se han agregado preguntas de evaluación para este proyecto.",
    back: "Atrás",
    continue: "Continuar",
    submit: "Enviar solicitud",
    submitting: "Enviando...",
    submitErrorTitle: "No se pudo enviar el onboarding",
    submissionFailed: "Error al enviar",
    invalidInviteError: "Enlace de invitación inválido",
  },
} as const;

export const termsContent: Record<QuickInviteLanguage, PolicyContent> = {
  en: {
    title: `${brandName} Terms & Conditions`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: EXPERT_TERMS_VERSION,
    sections: [
      {
        heading: "Scope",
        paragraphs: [
          `These Terms & Conditions govern expert onboarding, profile review, project matching, and consultation workflows operated by ${brandName}.`,
        ],
      },
      {
        heading: "Accurate Information",
        paragraphs: [
          "You must provide accurate, current, and complete information about your identity, contact details, professional history, current role, availability, language capabilities, expected fees, and project-specific qualifications.",
          "You are responsible for keeping information accurate if it changes during a project review or engagement.",
        ],
      },
      {
        heading: "No Guaranteed Engagement",
        paragraphs: [
          "Submitting an onboarding form does not create an employment, agency, partnership, exclusivity, or consulting relationship.",
          "It does not guarantee selection for a project, invitation to a consultation, call scheduling, or payment. Any paid consultation requires separate confirmation from the team.",
        ],
      },
      {
        heading: "Confidentiality and Restrictions",
        paragraphs: [
          "You must not share confidential, proprietary, privileged, classified, regulated, trade-secret, or material non-public information.",
          "You must not breach obligations owed to employers, clients, former employers, government bodies, professional associations, or other third parties.",
        ],
        bullets: [
          "Disclose any actual, potential, or perceived conflict of interest.",
          "Disclose restrictions, confidentiality duties, non-competes, non-solicits, securities-law restrictions, procurement restrictions, public-sector restrictions, or sensitive relationships that may affect participation.",
          "Refuse to answer any question that asks for restricted information or would require you to breach a duty.",
        ],
      },
      {
        heading: "Project Materials",
        paragraphs: [
          "Project materials, screening questions, client context, consultation topics, and communications from the team are confidential unless they are already public or the team confirms otherwise in writing.",
          "You may use them only to evaluate or participate in the relevant project.",
        ],
      },
      {
        heading: "Consultation Terms",
        paragraphs: [
          "If selected for a paid consultation, the team may confirm the expected fee, call duration, scheduling details, payment workflow, compliance requirements, and any project-specific terms before the call proceeds.",
          "You are responsible for complying with applicable laws, employer policies, professional rules, and contractual obligations that apply to you. The team may pause, reject, or terminate participation if compliance concerns arise.",
          `Questions about these Terms may be sent to ${legalContactEmail}.`,
        ],
      },
    ],
  },
  "pt-BR": {
    title: `Termos e Condições da ${brandName}`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: EXPERT_TERMS_VERSION,
    sections: [
      {
        heading: "Escopo",
        paragraphs: [
          `Estes Termos e Condições regulam o onboarding de especialistas, a revisão de perfil, a avaliação para projetos e os fluxos de consulta operados pela ${brandName}.`,
        ],
      },
      {
        heading: "Informações Precisas",
        paragraphs: [
          "Você deve fornecer informações precisas, atuais e completas sobre identidade, contato, histórico profissional, cargo atual, disponibilidade, idiomas, honorários esperados e qualificações específicas para o projeto.",
          "Você é responsável por manter essas informações corretas caso mudem durante a avaliação ou participação.",
        ],
      },
      {
        heading: "Sem Garantia de Contratação",
        paragraphs: [
          "O envio do formulário de onboarding não cria relação de emprego, agência, parceria, exclusividade ou consultoria.",
          "Também não garante seleção para projeto, convite para consulta, agendamento de chamada ou pagamento. Qualquer consulta remunerada depende de confirmação separada da equipe.",
        ],
      },
      {
        heading: "Confidencialidade e Restrições",
        paragraphs: [
          "Você não deve compartilhar informações confidenciais, proprietárias, privilegiadas, classificadas, reguladas, segredos comerciais ou informações materiais não públicas.",
          "Você não deve violar obrigações perante empregadores, clientes, ex-empregadores, órgãos públicos, associações profissionais ou terceiros.",
        ],
        bullets: [
          "Informe qualquer conflito de interesse real, potencial ou percebido.",
          "Informe restrições, deveres de confidencialidade, não concorrência, não solicitação, restrições de valores mobiliários, restrições de contratação pública, restrições do setor público ou relações sensíveis que possam afetar sua participação.",
          "Recuse responder qualquer pergunta que exija informação restrita ou violação de uma obrigação.",
        ],
      },
      {
        heading: "Materiais do Projeto",
        paragraphs: [
          "Materiais do projeto, perguntas de triagem, contexto do cliente, temas de consulta e comunicações da equipe são confidenciais, salvo se já forem públicos ou se a equipe confirmar de outra forma por escrito.",
          "Você pode usá-los apenas para avaliar ou participar do projeto relevante.",
        ],
      },
      {
        heading: "Termos da Consulta",
        paragraphs: [
          "Se selecionado para uma consulta remunerada, a equipe poderá confirmar honorários esperados, duração da chamada, detalhes de agenda, fluxo de pagamento, requisitos de conformidade e termos específicos antes da chamada.",
          "Você é responsável por cumprir leis aplicáveis, políticas de empregadores, regras profissionais e obrigações contratuais que se apliquem a você. A equipe pode pausar, recusar ou encerrar a participação se surgirem preocupações de conformidade.",
          `Dúvidas sobre estes Termos podem ser enviadas para ${legalContactEmail}.`,
        ],
      },
    ],
  },
  es: {
    title: `Términos y Condiciones de ${brandName}`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: EXPERT_TERMS_VERSION,
    sections: [
      {
        heading: "Alcance",
        paragraphs: [
          `Estos Términos y Condiciones regulan el onboarding de expertos, la revisión de perfil, la evaluación para proyectos y los flujos de consulta operados por ${brandName}.`,
        ],
      },
      {
        heading: "Información Precisa",
        paragraphs: [
          "Usted debe proporcionar información precisa, actual y completa sobre identidad, contacto, historial profesional, cargo actual, disponibilidad, idiomas, honorarios esperados y calificaciones específicas para el proyecto.",
          "Usted es responsable de mantener esa información correcta si cambia durante la evaluación o participación.",
        ],
      },
      {
        heading: "Sin Garantía de Participación",
        paragraphs: [
          "Enviar el formulario de onboarding no crea una relación laboral, de agencia, sociedad, exclusividad o consultoría.",
          "Tampoco garantiza selección para un proyecto, invitación a una consulta, programación de llamada o pago. Cualquier consulta remunerada requiere confirmación separada del equipo.",
        ],
      },
      {
        heading: "Confidencialidad y Restricciones",
        paragraphs: [
          "Usted no debe compartir información confidencial, propietaria, privilegiada, clasificada, regulada, secretos comerciales o información material no pública.",
          "Usted no debe incumplir obligaciones frente a empleadores, clientes, exempleadores, organismos públicos, asociaciones profesionales u otros terceros.",
        ],
        bullets: [
          "Revele cualquier conflicto de interés real, potencial o percibido.",
          "Revele restricciones, deberes de confidencialidad, no competencia, no solicitación, restricciones de valores, restricciones de contratación pública, restricciones del sector público o relaciones sensibles que puedan afectar su participación.",
          "Niéguese a responder cualquier pregunta que exija información restringida o incumplir una obligación.",
        ],
      },
      {
        heading: "Materiales del Proyecto",
        paragraphs: [
          "Los materiales del proyecto, preguntas de evaluación, contexto del cliente, temas de consulta y comunicaciones del equipo son confidenciales, salvo que ya sean públicos o que el equipo confirme otra cosa por escrito.",
          "Usted puede usarlos solo para evaluar o participar en el proyecto correspondiente.",
        ],
      },
      {
        heading: "Términos de la Consulta",
        paragraphs: [
          "Si es seleccionado para una consulta remunerada, el equipo podrá confirmar honorarios esperados, duración de la llamada, detalles de agenda, flujo de pago, requisitos de cumplimiento y términos específicos antes de la llamada.",
          "Usted es responsable de cumplir las leyes aplicables, políticas de empleadores, reglas profesionales y obligaciones contractuales que le correspondan. El equipo puede pausar, rechazar o finalizar la participación si surgen preocupaciones de cumplimiento.",
          `Las preguntas sobre estos Términos pueden enviarse a ${legalContactEmail}.`,
        ],
      },
    ],
  },
};

export const privacyContent: Record<QuickInviteLanguage, PolicyContent> = {
  en: {
    title: `${brandName} Privacy Policy / LGPD Notice`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: PRIVACY_POLICY_VERSION,
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          `${brandName} collects and processes personal data submitted through expert onboarding to evaluate project fit, manage expert relationships, conduct compliance review, operate consultation workflows, communicate with you, and maintain business records.`,
        ],
      },
      {
        heading: "Data We May Process",
        paragraphs: [
          "Personal data may include name, email, phone or WhatsApp, country, city, timezone, professional history, current and past roles, company names, expertise, expected hourly rate, availability, conflict disclosures, project answers, language preference, IP address, user agent, invite token metadata, and submission timestamps.",
        ],
      },
      {
        heading: "Legal Bases and Access",
        paragraphs: [
          "The team may process this data with your consent, to take steps requested by you before a potential engagement, to pursue legitimate operational and compliance interests, and to satisfy legal or contractual obligations where applicable.",
          "Personal data may be accessed by authorized team members and service providers that support hosting, security, CRM, recruiting, communications, analytics, compliance, scheduling, payment operations, and recordkeeping.",
        ],
        bullets: [
          "Access is limited to appropriate business purposes.",
          "Conflict disclosures should be limited to information needed to identify and assess the restriction.",
          "You should not submit sensitive personal data unless specifically requested and necessary for a project or compliance workflow.",
        ],
      },
      {
        heading: "Retention and Rights",
        paragraphs: [
          "Data may be retained for as long as needed to evaluate and manage expert relationships, document consent, support compliance, resolve disputes, maintain audit records, and satisfy legal, accounting, or contractual retention needs.",
          "Where LGPD or similar privacy laws apply, you may request access, confirmation of processing, correction, deletion, portability, anonymization, information about sharing, or withdrawal of consent, subject to lawful retention and operational limits.",
        ],
      },
      {
        heading: "Security and Consent Audit",
        paragraphs: [
          "Security controls are used to protect personal data, but no system can be guaranteed perfectly secure. If the team identifies a data incident requiring notice, it will act according to applicable obligations.",
          consentAuditSummary,
          `Privacy questions and rights requests may be sent to ${legalContactEmail}.`,
        ],
      },
    ],
  },
  "pt-BR": {
    title: `Política de Privacidade / Aviso LGPD da ${brandName}`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: PRIVACY_POLICY_VERSION,
    sections: [
      {
        heading: "Finalidade",
        paragraphs: [
          `A ${brandName} coleta e trata dados pessoais enviados no onboarding de especialistas para avaliar adequação a projetos, gerenciar relacionamentos com especialistas, realizar revisão de conformidade, operar fluxos de consulta, comunicar-se com você e manter registros comerciais.`,
        ],
      },
      {
        heading: "Dados que Podemos Tratar",
        paragraphs: [
          "Os dados pessoais podem incluir nome, e-mail, telefone ou WhatsApp, país, cidade, fuso horário, histórico profissional, cargos atuais e anteriores, nomes de empresas, especialidades, valor horário esperado, disponibilidade, declarações de conflito, respostas de projeto, preferência de idioma, endereço IP, user agent, metadados do convite e horários de envio.",
        ],
      },
      {
        heading: "Bases Legais e Acesso",
        paragraphs: [
          "A equipe pode tratar esses dados com seu consentimento, para adotar medidas solicitadas por você antes de um possível engajamento, para interesses legítimos operacionais e de conformidade, e para cumprir obrigações legais ou contratuais quando aplicável.",
          "Os dados pessoais podem ser acessados por membros autorizados da equipe e prestadores de serviço que apoiam hospedagem, segurança, CRM, recrutamento, comunicações, análises, conformidade, agenda, pagamentos e manutenção de registros.",
        ],
        bullets: [
          "O acesso é limitado a finalidades comerciais apropriadas.",
          "Declarações de conflito devem se limitar às informações necessárias para identificar e avaliar a restrição.",
          "Você não deve enviar dados pessoais sensíveis salvo se forem especificamente solicitados e necessários para um projeto ou fluxo de conformidade.",
        ],
      },
      {
        heading: "Retenção e Direitos",
        paragraphs: [
          "Os dados podem ser retidos pelo tempo necessário para avaliar e gerenciar relacionamentos com especialistas, documentar consentimento, apoiar conformidade, resolver disputas, manter registros de auditoria e cumprir necessidades legais, contábeis ou contratuais de retenção.",
          "Quando a LGPD ou leis de privacidade semelhantes se aplicarem, você pode solicitar acesso, confirmação de tratamento, correção, exclusão, portabilidade, anonimização, informações sobre compartilhamento ou retirada de consentimento, observados limites legais de retenção e operação.",
        ],
      },
      {
        heading: "Segurança e Auditoria de Consentimento",
        paragraphs: [
          "Controles de segurança são usados para proteger dados pessoais, mas nenhum sistema pode ser garantido como perfeitamente seguro. Se a equipe identificar incidente de dados que exija aviso, agirá de acordo com as obrigações aplicáveis.",
          "O formulário de onboarding registra a versão dos Termos, a versão da Política de Privacidade, o idioma de consentimento selecionado, a fonte do consentimento, endereço IP, user agent e horários de consentimento gerados pelo servidor para fins de auditoria.",
          `Dúvidas de privacidade e solicitações de direitos podem ser enviadas para ${legalContactEmail}.`,
        ],
      },
    ],
  },
  es: {
    title: `Política de Privacidad / Aviso LGPD de ${brandName}`,
    effectiveDate: POLICY_EFFECTIVE_DATE,
    version: PRIVACY_POLICY_VERSION,
    sections: [
      {
        heading: "Finalidad",
        paragraphs: [
          `${brandName} recopila y procesa datos personales enviados durante el onboarding de expertos para evaluar ajuste a proyectos, gestionar relaciones con expertos, realizar revisión de cumplimiento, operar flujos de consulta, comunicarse con usted y mantener registros comerciales.`,
        ],
      },
      {
        heading: "Datos que Podemos Procesar",
        paragraphs: [
          "Los datos personales pueden incluir nombre, correo electrónico, teléfono o WhatsApp, país, ciudad, zona horaria, historial profesional, cargos actuales y anteriores, nombres de empresas, especialidades, tarifa horaria esperada, disponibilidad, declaraciones de conflicto, respuestas de proyecto, preferencia de idioma, dirección IP, user agent, metadatos del enlace de invitación y marcas de tiempo de envío.",
        ],
      },
      {
        heading: "Bases Legales y Acceso",
        paragraphs: [
          "El equipo puede procesar estos datos con su consentimiento, para tomar medidas solicitadas por usted antes de una posible participación, para intereses legítimos operativos y de cumplimiento, y para cumplir obligaciones legales o contractuales cuando corresponda.",
          "Los datos personales pueden ser accedidos por miembros autorizados del equipo y proveedores de servicios que apoyan alojamiento, seguridad, CRM, reclutamiento, comunicaciones, analítica, cumplimiento, agenda, pagos y mantenimiento de registros.",
        ],
        bullets: [
          "El acceso se limita a fines comerciales apropiados.",
          "Las declaraciones de conflicto deben limitarse a la información necesaria para identificar y evaluar la restricción.",
          "Usted no debe enviar datos personales sensibles salvo que sean específicamente solicitados y necesarios para un proyecto o flujo de cumplimiento.",
        ],
      },
      {
        heading: "Retención y Derechos",
        paragraphs: [
          "Los datos pueden conservarse durante el tiempo necesario para evaluar y gestionar relaciones con expertos, documentar consentimiento, apoyar cumplimiento, resolver disputas, mantener registros de auditoría y cumplir necesidades legales, contables o contractuales de retención.",
          "Cuando se aplique la LGPD o leyes de privacidad similares, usted puede solicitar acceso, confirmación de procesamiento, corrección, eliminación, portabilidad, anonimización, información sobre intercambio o retiro del consentimiento, sujeto a límites legales de retención y operación.",
        ],
      },
      {
        heading: "Seguridad y Auditoría de Consentimiento",
        paragraphs: [
          "Se usan controles de seguridad para proteger datos personales, pero ningún sistema puede garantizarse como perfectamente seguro. Si el equipo identifica un incidente de datos que requiera aviso, actuará de acuerdo con las obligaciones aplicables.",
          "El formulario de onboarding registra la versión de los Términos, la versión de la Política de Privacidad, el idioma de consentimiento seleccionado, la fuente del consentimiento, dirección IP, user agent y marcas de tiempo de consentimiento generadas por el servidor para fines de auditoría.",
          `Las preguntas de privacidad y solicitudes de derechos pueden enviarse a ${legalContactEmail}.`,
        ],
      },
    ],
  },
};
