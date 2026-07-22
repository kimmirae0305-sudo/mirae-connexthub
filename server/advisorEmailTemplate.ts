type AdvisorEmailRenderOptions = {
  body: string;
  reviewLink?: string | null;
  declineLink?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  signatureName?: string | null;
  jobTitle?: string | null;
  mobilePhone?: string | null;
  logoUrl?: string | null;
};

export type AdvisorManagedTemplateType = "advisor_initial_invite" | "advisor_follow_up" | "advisor_resend";
export type AdvisorManagedTemplateLanguage = "en" | "pt-BR" | "es";

export type AdvisorTemplateVariableContext = {
  advisorName?: string | null;
  senderName?: string | null;
  senderTitle?: string | null;
  senderEmail?: string | null;
  senderMobile?: string | null;
  reviewLink?: string | null;
  declineLink?: string | null;
};

const BRAND_NAME = "Mirae Connext";
const WEBSITE_URL = "http://www.miraeconnext.com";
const WEBSITE_LABEL = "www.miraeconnext.com";
export const ADVISOR_EMAIL_TEMPLATE_TYPES: AdvisorManagedTemplateType[] = [
  "advisor_initial_invite",
  "advisor_follow_up",
  "advisor_resend",
];
export const ADVISOR_EMAIL_TEMPLATE_LANGUAGES: AdvisorManagedTemplateLanguage[] = ["en", "pt-BR", "es"];
export const ADVISOR_EMAIL_ALLOWED_VARIABLES = [
  "advisorName",
  "senderName",
  "senderTitle",
  "senderEmail",
  "senderMobile",
  "reviewLink",
  "declineLink",
  "companyName",
  "platformName",
  "brandName",
] as const;
const ALLOWED_VARIABLE_SET = new Set<string>(ADVISOR_EMAIL_ALLOWED_VARIABLES);

export const ADVISOR_EMAIL_DEFAULT_TEMPLATES: Record<
  AdvisorManagedTemplateType,
  Record<AdvisorManagedTemplateLanguage, { subject: string; body: string; description: string }>
> = {
  advisor_initial_invite: {
    en: {
      description: "Initial advisor project review invitation.",
      subject: "Mirae Connext | Expert consultation opportunity",
      body: `Hi {{advisorName}},

This is {{senderName}} from {{brandName}}.

We are currently reviewing a potential expert consultation opportunity that may be relevant to your professional background.

Could you please review the brief and answer a few short screening questions through the secure link below?

{{reviewLink}}

Your responses will help us confirm whether the consultation is a good fit before moving forward.

This is an initial review step and does not yet represent a confirmed consultation.`,
    },
    "pt-BR": {
      description: "Initial advisor project review invitation in Portuguese.",
      subject: "Mirae Connext | Oportunidade de consulta especializada",
      body: `Ola {{advisorName}},

Aqui e {{senderName}} da {{brandName}}.

Estamos avaliando uma possivel oportunidade de consulta especializada que pode ser relevante para a sua experiencia profissional.

Voce poderia revisar o resumo e responder a algumas perguntas rapidas de qualificacao por meio do link seguro abaixo?

{{reviewLink}}

Suas respostas nos ajudarao a confirmar se a consulta e adequada antes de avancarmos.

Esta e uma etapa inicial de avaliacao e ainda nao representa uma consulta confirmada.`,
    },
    es: {
      description: "Initial advisor project review invitation in Spanish.",
      subject: "Mirae Connext | Oportunidad de consulta especializada",
      body: `Hola {{advisorName}},

Soy {{senderName}} de {{brandName}}.

Estamos evaluando una posible oportunidad de consulta especializada que podria ser relevante para su experiencia profesional.

Podria revisar el resumen y responder algunas preguntas breves de evaluacion a traves del enlace seguro a continuacion?

{{reviewLink}}

Sus respuestas nos ayudaran a confirmar si la consulta es adecuada antes de avanzar.

Esta es una etapa inicial de evaluacion y aun no representa una consulta confirmada.`,
    },
  },
  advisor_follow_up: {
    en: {
      description: "Advisor project review follow-up.",
      subject: "Follow-up: Expert consultation invitation from Mirae Connext",
      body: `Hi {{advisorName}},

This is {{senderName}} from {{brandName}}.

I wanted to follow up on Mirae Connext's invitation to review a potential expert consultation opportunity.

When you have a moment, please review the brief and answer the short screening questions through the secure link below:

{{reviewLink}}

Thank you for your time.`,
    },
    "pt-BR": {
      description: "Advisor project review follow-up in Portuguese.",
      subject: "Acompanhamento: convite para consulta especializada da Mirae Connext",
      body: `Ola {{advisorName}},

Aqui e {{senderName}} da {{brandName}}.

Gostaria de fazer um breve acompanhamento sobre o convite da Mirae Connext para revisar uma possivel oportunidade de consulta especializada.

Quando puder, por favor revise o resumo e responda as perguntas rapidas pelo link seguro abaixo:

{{reviewLink}}

Obrigado pela sua atencao.`,
    },
    es: {
      description: "Advisor project review follow-up in Spanish.",
      subject: "Seguimiento: invitacion de Mirae Connext para consulta especializada",
      body: `Hola {{advisorName}},

Soy {{senderName}} de {{brandName}}.

Quisiera hacer un breve seguimiento sobre la invitacion de Mirae Connext para revisar una posible oportunidad de consulta especializada.

Cuando pueda, por favor revise el resumen y responda las preguntas breves a traves del enlace seguro a continuacion:

{{reviewLink}}

Gracias por su atencion.`,
    },
  },
  advisor_resend: {
    en: {
      description: "Resend advisor project review invitation.",
      subject: "Mirae Connext | Expert consultation opportunity",
      body: `Hi {{advisorName}},

This is {{senderName}} from {{brandName}}.

We are currently reviewing a potential expert consultation opportunity that may be relevant to your professional background.

Could you please review the brief and answer a few short screening questions through the secure link below?

{{reviewLink}}

Your responses will help us confirm whether the consultation is a good fit before moving forward.

This is an initial review step and does not yet represent a confirmed consultation.`,
    },
    "pt-BR": {
      description: "Resend advisor project review invitation in Portuguese.",
      subject: "Mirae Connext | Oportunidade de consulta especializada",
      body: `Ola {{advisorName}},

Aqui e {{senderName}} da {{brandName}}.

Estamos avaliando uma possivel oportunidade de consulta especializada que pode ser relevante para a sua experiencia profissional.

Voce poderia revisar o resumo e responder a algumas perguntas rapidas de qualificacao por meio do link seguro abaixo?

{{reviewLink}}

Suas respostas nos ajudarao a confirmar se a consulta e adequada antes de avancarmos.

Esta e uma etapa inicial de avaliacao e ainda nao representa uma consulta confirmada.`,
    },
    es: {
      description: "Resend advisor project review invitation in Spanish.",
      subject: "Mirae Connext | Oportunidad de consulta especializada",
      body: `Hola {{advisorName}},

Soy {{senderName}} de {{brandName}}.

Estamos evaluando una posible oportunidad de consulta especializada que podria ser relevante para su experiencia profesional.

Podria revisar el resumen y responder algunas preguntas breves de evaluacion a traves del enlace seguro a continuacion?

{{reviewLink}}

Sus respuestas nos ayudaran a confirmar si la consulta es adecuada antes de avanzar.

Esta es una etapa inicial de evaluacion y aun no representa una consulta confirmada.`,
    },
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeAdvisorTemplateLanguage(language?: string | null): AdvisorManagedTemplateLanguage {
  const normalized = String(language || "").trim();
  if (normalized === "pt" || normalized.toLowerCase() === "pt-br") return "pt-BR";
  if (normalized === "es") return "es";
  return "en";
}

export function normalizeAdvisorTemplateType(templateType?: string | null): AdvisorManagedTemplateType | null {
  const normalized = String(templateType || "").trim();
  if (normalized === "initial_invite") return "advisor_initial_invite";
  if (normalized === "follow_up") return "advisor_follow_up";
  if (normalized === "resend_invite") return "advisor_resend";
  if (ADVISOR_EMAIL_TEMPLATE_TYPES.includes(normalized as AdvisorManagedTemplateType)) {
    return normalized as AdvisorManagedTemplateType;
  }
  return null;
}

export function getDefaultAdvisorEmailTemplate(
  templateType: AdvisorManagedTemplateType,
  language: AdvisorManagedTemplateLanguage
) {
  return ADVISOR_EMAIL_DEFAULT_TEMPLATES[templateType]?.[language] ||
    ADVISOR_EMAIL_DEFAULT_TEMPLATES[templateType]?.en ||
    ADVISOR_EMAIL_DEFAULT_TEMPLATES.advisor_initial_invite.en;
}

export function findUnsupportedAdvisorTemplateVariables(subject: string, body: string) {
  const unsupported = new Set<string>();
  const variablePattern = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  const text = `${subject || ""}\n${body || ""}`;
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(text)) !== null) {
    const variableName = match[1];
    if (!ALLOWED_VARIABLE_SET.has(variableName)) {
      unsupported.add(variableName);
    }
  }

  return Array.from(unsupported);
}

export function renderAdvisorTemplateText(templateText: string, context: AdvisorTemplateVariableContext) {
  const values: Record<string, string> = {
    advisorName: String(context.advisorName || "").trim() || "there",
    senderName: String(context.senderName || "").trim() || BRAND_NAME,
    senderTitle: String(context.senderTitle || "").trim(),
    senderEmail: String(context.senderEmail || "").trim(),
    senderMobile: String(context.senderMobile || "").trim(),
    reviewLink: String(context.reviewLink || "").trim(),
    declineLink: String(context.declineLink || "").trim(),
    companyName: BRAND_NAME,
    platformName: BRAND_NAME,
    brandName: BRAND_NAME,
  };

  return String(templateText || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, variableName) => {
    if (!ALLOWED_VARIABLE_SET.has(variableName)) return "";
    return values[variableName] || "";
  });
}

function ensureAdvisorActionText(body: string, context: AdvisorTemplateVariableContext) {
  const reviewLink = String(context.reviewLink || "").trim();
  const declineLink = String(context.declineLink || "").trim();
  let normalizedBody = String(body || "").trim();

  if (reviewLink && !normalizedBody.includes(reviewLink)) {
    normalizedBody += `\n\nReview Project:\n${reviewLink}`;
  }
  if (declineLink && !normalizedBody.includes(declineLink)) {
    normalizedBody += `\n\nDecline this invitation:\n${declineLink}`;
  }

  if (!/third-party sources/i.test(normalizedBody)) {
    normalizedBody += "\n\nYou may not use any third-party sources, including artificial intelligence tools, when responding to screening questions or participating in consultations with a Mirae Connext client.";
  }
  if (!/withhold or deny payment/i.test(normalizedBody)) {
    normalizedBody += "\n\nMirae Connext reserves the right to withhold or deny payment for any consultation and to suspend or remove you from its expert network if it determines that you have misrepresented your identity, professional experience, qualifications, or knowledge, or have used unauthorized third-party sources in connection with a screening or consultation.";
  }

  return normalizedBody.trim();
}

export function renderAdvisorTemplateContent(
  template: { subject: string; body: string },
  context: AdvisorTemplateVariableContext
) {
  const subject = renderAdvisorTemplateText(template.subject, context).trim();
  const body = renderAdvisorTemplateText(template.body, context).trim();
  const textBody = ensureAdvisorActionText(body, context);

  return {
    subject,
    body: textBody,
    htmlBody: body,
    textBody,
  };
}

export function getSenderFirstName(senderName?: string | null, senderEmail?: string | null) {
  const name = String(senderName || "").trim();
  if (name) return name.split(/\s+/)[0] || name;

  const emailLocalPart = String(senderEmail || "").split("@")[0]?.trim();
  if (emailLocalPart) return emailLocalPart.split(/[._-]/)[0] || emailLocalPart;

  return "";
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getSenderSignatureProfile(senderName?: string | null, senderEmail?: string | null) {
  const email = normalizeEmail(senderEmail);
  const name = String(senderName || "").trim();
  const senderFirstName = getSenderFirstName(name, email);

  return {
    closingName: senderFirstName || BRAND_NAME,
    displayName: name || senderFirstName || BRAND_NAME,
    title: "",
    mobile: "",
    email: email || "",
  };
}

function renderBodyHtml(body: string) {
  const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");

  return lines
    .map((line) => {
      const escaped = escapeHtml(line);
      if (!escaped.trim()) return '<div style="height:12px;line-height:12px;">&nbsp;</div>';

      const linked = escaped.replace(urlPattern, (url) => {
        const cleanUrl = url.replace(/[),.;:!?]+$/g, "");
        const trailing = url.slice(cleanUrl.length);
        return `<a href="${cleanUrl}" style="color:#2563eb;text-decoration:underline;">${cleanUrl}</a>${trailing}`;
      });

      return `<div style="margin:0 0 12px 0;">${linked}</div>`;
    })
    .join("");
}

function renderAdvisorCtaHtml(options: AdvisorEmailRenderOptions) {
  const reviewLink = String(options.reviewLink || "").trim();
  const declineLink = String(options.declineLink || "").trim();
  if (!reviewLink && !declineLink) return "";

  const reviewHtml = reviewLink
    ? `<div style="margin:22px 0 12px 0;">
        <a href="${escapeHtml(reviewLink)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;padding:12px 20px;border-radius:6px;">Review Project</a>
      </div>`
    : "";
  const declineHtml = declineLink
    ? `<div style="margin:6px 0 22px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#4b5563;">
        <span>Not interested in this opportunity?</span>
        <a href="${escapeHtml(declineLink)}" style="color:#374151;text-decoration:underline;font-weight:600;">Decline Now</a>
      </div>`
    : "";

  return `${reviewHtml}${declineHtml}`;
}

function renderFooterHtml(options: AdvisorEmailRenderOptions) {
  const profile = getSenderSignatureProfile(options.senderName, options.senderEmail);
  const signatureName = String(options.signatureName || "").trim();
  const jobTitle = String(options.jobTitle || "").trim();
  const mobilePhone = String(options.mobilePhone || "").trim();
  const displayName = signatureName || profile.displayName;
  const logoHtml = options.logoUrl
    ? `<img src="${escapeHtml(options.logoUrl)}" alt="${BRAND_NAME}" width="132" style="display:block;border:0;outline:none;text-decoration:none;width:132px;max-width:132px;height:auto;" />`
    : `<div style="font-size:18px;line-height:20px;font-weight:700;color:#111827;margin:0;">${BRAND_NAME}</div>`;
  const emailHtml = profile.email
    ? `<div style="margin:0;">Email: <a href="mailto:${escapeHtml(profile.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(profile.email)}</a></div>`
    : "";
  const mobileHtml = mobilePhone
    ? `<div style="margin:0;">Mobile: ${escapeHtml(mobilePhone)}</div>`
    : "";
  const titleHtml = jobTitle
    ? `<div style="margin:0;color:#374151;">${escapeHtml(jobTitle)}</div>`
    : "";

  return `
    <div style="margin-top:22px;color:#111827;">
      <div style="margin:0 0 4px 0;">Best regards,</div>
      <div style="margin:0 0 16px 0;">${escapeHtml(profile.closingName)}</div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:auto;max-width:100%;">
        <tr>
          <td style="vertical-align:top;padding:0 14px 8px 0;width:132px;">
            ${logoHtml}
          </td>
          <td style="vertical-align:top;padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#4b5563;">
            <div style="margin:0 0 2px 0;font-size:13px;line-height:18px;font-weight:700;color:#111827;">${escapeHtml(displayName)}</div>
            ${titleHtml}
            ${mobileHtml}
            ${emailHtml}
            <div style="margin:0;">Website: <a href="${WEBSITE_URL}" style="color:#2563eb;text-decoration:none;">${WEBSITE_LABEL}</a></div>
          </td>
        </tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#374151;margin-top:6px;">
        <div style="font-weight:600;color:#111827;">${BRAND_NAME} &mdash; Expert Network & Insight Platform for LATAM</div>
        <div>AI powered workflow | Portuguese first | LGPD first</div>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;color:#9ca3af;margin-top:10px;max-width:620px;">
        <div style="margin:0 0 6px 0;">This email and any attachments may contain confidential or legally privileged information and are intended solely for the use of the designated recipient. The contents of this transmission are provided in confidence and for the exclusive purpose of communication with the intended addressee.</div>
        <div style="margin:0;">If you have received this message in error, you are hereby notified that any review, dissemination, distribution, or duplication of this communication is strictly prohibited. If you are not the intended recipient, please notify the sender immediately by return email or telephone and permanently delete this message and any accompanying attachments from your system.</div>
      </div>
    </div>
  `;
}

// Keep the CRM-controlled advisor email footer/signature centralized here.
// If the Zoho Mail signature changes, update this helper rather than each template.
export function renderAdvisorEmailHtml(options: AdvisorEmailRenderOptions) {
  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#111827;max-width:640px;padding:24px;">
      ${renderBodyHtml(options.body)}
      ${renderAdvisorCtaHtml(options)}
      ${renderFooterHtml(options)}
    </div>
  </body>
</html>`;
}
