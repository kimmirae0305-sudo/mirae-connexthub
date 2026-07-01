import { raw, type Express, type Router } from "express";
import { createServer, type Server } from "http";
import { Router as ExpressRouter } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
import {
  insertProjectSchema,
  insertExpertSchema,
  insertVettingQuestionSchema,
  insertProjectExpertSchema,
  insertUsageRecordSchema,
  insertUserSchema,
  insertClientOrganizationSchema,
  insertClientPocSchema,
  insertCompanySchema,
  insertCallRecordSchema,
  insertInsightSchema,
  insertExpertInvitationLinkSchema,
  insertProjectAngleSchema,
  insertExpenseSchema,
  calculateCU,
  callRecords,
  experts,
  projects,
  expertInvitationLinks,
  projectExperts,
  projectAngles,
  users,
  clientOrganizations,
  consultationInvitationEmailSends,
  type UserEmailConnection,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import { authMiddleware, loginHandler, getMeHandler, requireAdmin, requireRoles, hashPassword, comparePassword, generateToken, type AuthRequest } from "./auth";
import { insertClientSchema } from "@shared/schema";
import { eq, and, gte, lt, sql, desc, inArray, or, ilike } from "drizzle-orm";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { startOfMonth, addMonths } from "date-fns";
import { sendExpertInvitationEmail, verifySmtpConnection } from "./email";
import { resolveEmailSenderIdentity } from "./emailSenderIdentity";
import { decryptEmailToken, encryptEmailToken, getEmailTokenEncryptionKeyStatus } from "./emailTokenCrypto";
import {
  ADVISOR_EMAIL_ALLOWED_VARIABLES,
  ADVISOR_EMAIL_TEMPLATE_LANGUAGES,
  ADVISOR_EMAIL_TEMPLATE_TYPES,
  findUnsupportedAdvisorTemplateVariables,
  getDefaultAdvisorEmailTemplate,
  normalizeAdvisorTemplateLanguage,
  normalizeAdvisorTemplateType,
  renderAdvisorEmailHtml,
  renderAdvisorTemplateContent,
  type AdvisorManagedTemplateLanguage,
  type AdvisorManagedTemplateType,
  type AdvisorTemplateVariableContext,
} from "./advisorEmailTemplate";
import PDFDocument from "pdfkit";

const generateRecruitmentToken = () => `inv_${crypto.randomBytes(24).toString("hex")}`;
const generateAdvisorProjectReviewToken = () => `apr_${crypto.randomBytes(32).toString("hex")}`;
const generateExpertPaymentDetailsToken = () => `epd_${crypto.randomBytes(32).toString("hex")}`;
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");
const getRequestBaseUrl = (req: AuthRequest) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() ||
    req.protocol ||
    "https";
  const host = req.get("host");

  return host ? `${protocol}://${host}` : "";
};
const getInviteBaseUrl = (req: AuthRequest) => {
  const publicInviteBaseUrl = process.env.PUBLIC_INVITE_BASE_URL?.trim();
  if (publicInviteBaseUrl) return trimTrailingSlashes(publicInviteBaseUrl);

  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (appBaseUrl) return trimTrailingSlashes(appBaseUrl);

  return trimTrailingSlashes(getRequestBaseUrl(req));
};
const buildPublicRecruitmentUrl = (token: string, req: AuthRequest) => `${getInviteBaseUrl(req)}/r/${token}`;
const buildPublicAdvisorProjectReviewUrl = (token: string, req: AuthRequest) =>
  `${getInviteBaseUrl(req)}/public/advisor-project-review/${token}`;
const buildPublicExpertPaymentDetailsUrl = (token: string, req: AuthRequest) =>
  `${getInviteBaseUrl(req)}/public/expert-payment-details/${token}`;
const getEmailAssetBaseUrl = (req: AuthRequest) =>
  trimTrailingSlashes(process.env.EMAIL_ASSET_BASE_URL?.trim() || getRequestBaseUrl(req));
const buildAdvisorEmailLogoUrl = (req: AuthRequest) =>
  `${getEmailAssetBaseUrl(req)}/email-assets/mirae-connext-logo.png`;
const ZOHO_MAIL_PROVIDER = "zoho_mail";
const ZOHO_MAIL_SCOPES = ["ZohoMail.accounts.READ", "ZohoMail.messages.CREATE"];
const CHANGE_PASSWORD_ROUTE_VERSION = "2026-06-password-persistence-v2";
const getAppBaseUrl = (req: AuthRequest) => {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (appBaseUrl) return trimTrailingSlashes(appBaseUrl);
  return trimTrailingSlashes(getRequestBaseUrl(req));
};
const buildEmailOAuthReturnUrl = (req: AuthRequest, status: "connected" | "error", reason?: string) => {
  const url = new URL("/projects", getAppBaseUrl(req) || "http://localhost");
  url.searchParams.set("email_zoho", status);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
};
const getZohoOAuthConfig = () => {
  const config = {
    clientId: process.env.ZOHO_CLIENT_ID?.trim() || "",
    clientSecret: process.env.ZOHO_CLIENT_SECRET?.trim() || "",
    accountsBaseUrl: trimTrailingSlashes(process.env.ZOHO_ACCOUNTS_BASE_URL?.trim() || ""),
    mailApiBaseUrl: trimTrailingSlashes(process.env.ZOHO_MAIL_API_BASE_URL?.trim() || ""),
    redirectUri: process.env.ZOHO_OAUTH_REDIRECT_URI?.trim() || "",
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!getEmailTokenEncryptionKeyStatus().isValid) {
    missing.push("emailTokenEncryptionKey");
  }

  return {
    ...config,
    isConfigured: missing.length === 0,
    missing,
  };
};
const extractZohoAccounts = (payload: any): any[] => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  if (Array.isArray(payload)) return payload;
  return [];
};
const getZohoAccountEmail = (account: any) =>
  String(
    account?.primaryEmailAddress ||
    account?.emailAddress ||
    account?.mailboxAddress ||
    account?.email ||
    ""
  ).trim().toLowerCase();
const getZohoAccountId = (account: any) =>
  String(account?.accountId || account?.mailAccountId || account?.id || "").trim();
const getSafeRedirectUriParts = (redirectUri: string) => {
  try {
    const parsed = new URL(redirectUri);
    return {
      redirectUriHost: parsed.host,
      redirectUriPath: parsed.pathname,
    };
  } catch {
    return {
      redirectUriHost: null,
      redirectUriPath: null,
    };
  }
};
const normalizeEmailForMatch = (email?: string | null) => String(email || "").trim().toLowerCase();
const isSingleRecipientEmail = (email: string) =>
  Boolean(email) && !email.includes(",") && !email.includes(";") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const expertPaymentMethods = new Set([
  "PayPal",
  "Wise",
  "Pix",
  "International Wire Transfer",
  "Local Bank Transfer",
  "ACH",
  "SWIFT",
  "Payoneer",
  "Other",
]);
const advisorEmailTypes = new Set(["initial_invite", "follow_up", "resend_invite"]);
const consultationInvitationAudiences = new Set(["expert", "client"]);
const consultationInvitationTemplateTypes = {
  expert: "expert_invitation",
  client: "client_invitation",
} as const;
const SELECTED_ADVISOR_SEND_LIMIT = 20;
const getFirstNameForEmail = (name?: string | null) => {
  const firstName = String(name || "").trim().split(/\s+/)[0];
  return firstName || "";
};
const mapAdvisorEmailTypeToTemplateType = (emailType?: string | null): AdvisorManagedTemplateType => {
  if (emailType === "follow_up") return "advisor_follow_up";
  if (emailType === "resend_invite") return "advisor_resend";
  return "advisor_initial_invite";
};
const getAdvisorTemplateSafeFields = (template: any, source = "managed") => ({
  id: template.id ?? null,
  templateType: template.templateType,
  language: template.language,
  subject: template.subject,
  body: template.body,
  description: template.description ?? null,
  isActive: template.isActive !== false,
  updatedAt: template.updatedAt ?? null,
  updatedBy: template.updatedBy ?? null,
  source,
});
const getAdvisorEmailTemplateForSend = async (
  templateType: AdvisorManagedTemplateType,
  language: AdvisorManagedTemplateLanguage
) => {
  const managedTemplate = await storage.getEmailTemplate(templateType, language);
  if (managedTemplate?.isActive && managedTemplate.subject && managedTemplate.body) {
    return {
      template: managedTemplate,
      source: "managed" as const,
    };
  }

  if (language !== "en") {
    const englishTemplate = await storage.getEmailTemplate(templateType, "en");
    if (englishTemplate?.isActive && englishTemplate.subject && englishTemplate.body) {
      return {
        template: englishTemplate,
        source: "managed_english_fallback" as const,
      };
    }
  }

  const defaultTemplate = getDefaultAdvisorEmailTemplate(templateType, language);
  return {
    template: {
      id: null,
      templateType,
      language,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      description: defaultTemplate.description,
      isActive: true,
    },
    source: "default" as const,
  };
};
const resolveAdvisorEmailTemplateForSend = async ({
  templateType,
  language,
  context,
}: {
  templateType: AdvisorManagedTemplateType;
  language: AdvisorManagedTemplateLanguage;
  context: AdvisorTemplateVariableContext;
}) => {
  const { template, source } = await getAdvisorEmailTemplateForSend(templateType, language);
  return {
    ...renderAdvisorTemplateContent(template, context),
    templateSource: source,
  };
};
const ensureDefaultAdvisorEmailTemplates = async () => {
  for (const templateType of ADVISOR_EMAIL_TEMPLATE_TYPES) {
    for (const language of ADVISOR_EMAIL_TEMPLATE_LANGUAGES) {
      const existing = await storage.getEmailTemplate(templateType, language);
      if (existing) continue;

      const defaults = getDefaultAdvisorEmailTemplate(templateType, language);
      await storage.upsertEmailTemplate({
        templateType,
        language,
        subject: defaults.subject,
        body: defaults.body,
        description: defaults.description,
        isActive: true,
        updatedBy: null,
      });
    }
  }
};
const ensureAdvisorProjectReviewTokenForSend = async (invitation: any) => {
  const now = new Date();
  const currentExpiration = invitation.expiresAt ? new Date(invitation.expiresAt) : null;
  const hasValidToken = Boolean(
    invitation.token &&
    currentExpiration &&
    !Number.isNaN(currentExpiration.getTime()) &&
    currentExpiration > now
  );

  if (hasValidToken) {
    return {
      token: String(invitation.token),
      expiresAt: currentExpiration,
    };
  }

  let token: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateAdvisorProjectReviewToken();
    const existing = await storage.getAdvisorProjectInvitationByToken(candidate);
    if (!existing) {
      token = candidate;
      break;
    }
  }

  if (!token) {
    throw new Error("advisor_review_token_generation_failed");
  }

  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await storage.updateAdvisorProjectInvitation(invitation.id, {
    token,
    expiresAt,
    status: invitation.status === "not_sent" ? "draft" : invitation.status || "draft",
  });

  return { token, expiresAt };
};
const getZohoProviderMessageId = (payload: any) =>
  String(
    payload?.data?.messageId ||
    payload?.data?.message_id ||
    payload?.messageId ||
    payload?.message_id ||
    payload?.data?.[0]?.messageId ||
    payload?.data?.[0]?.message_id ||
    ""
  ).trim();
const formatConsultationDateTimeForEmail = (value: Date, timezone?: string | null) => {
  const timeZone = timezone || "America/Sao_Paulo";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
};
const buildConsultationInvitationTemplate = ({
  audience,
  expertName,
  expertTitle,
  clientContactName,
  scheduledAt,
  timezone,
  durationMinutes,
  meetingLink,
  pmName,
}: {
  audience: "expert" | "client";
  expertName: string;
  expertTitle?: string | null;
  clientContactName?: string | null;
  scheduledAt: Date;
  timezone?: string | null;
  durationMinutes: number;
  meetingLink: string;
  pmName?: string | null;
}) => {
  const dateTime = formatConsultationDateTimeForEmail(scheduledAt, timezone);
  const timeZone = timezone || "America/Sao_Paulo";
  const pmLine = pmName ? `\nPM contact: ${pmName}` : "";

  if (audience === "expert") {
    return {
      templateType: consultationInvitationTemplateTypes.expert,
      subject: "Mirae Connext | Confidential consultation invitation",
      body: `Hi ${getFirstNameForEmail(expertName) || expertName},

This confirms your scheduled Confidential Market Research Consultation with Mirae Connext.

Scheduled time: ${dateTime}
Time zone: ${timeZone}
Planned duration: ${durationMinutes} minutes
Meeting link: ${meetingLink}${pmLine}

Please do not share this invitation or meeting link. Client identity and consultation context remain confidential and will be discussed only as appropriate during the call.`,
    };
  }

  const greeting = clientContactName ? `Hi ${getFirstNameForEmail(clientContactName) || clientContactName},` : "Hello,";
  const expertLine = expertTitle ? `${expertName} — ${expertTitle}` : expertName;
  return {
    templateType: consultationInvitationTemplateTypes.client,
    subject: "Mirae Connext | Consultation meeting details",
    body: `${greeting}

This confirms the scheduled expert consultation.

Expert: ${expertLine}
Scheduled time: ${dateTime}
Time zone: ${timeZone}
Planned duration: ${durationMinutes} minutes
Meeting link: ${meetingLink}${pmLine}

Please use the meeting link above at the scheduled time.`,
  };
};
const getZohoAccessTokenForConnection = async (
  connection: UserEmailConnection,
  config: ReturnType<typeof getZohoOAuthConfig>
) => {
  const expiresAt = connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt) : null;
  const cachedTokenIsUsable = Boolean(
    connection.encryptedAccessToken &&
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() > Date.now() + 5 * 60 * 1000
  );

  if (cachedTokenIsUsable) {
    return decryptEmailToken(connection.encryptedAccessToken!);
  }

  if (!connection.encryptedRefreshToken) {
    throw new Error("zoho_refresh_token_missing");
  }

  const refreshToken = decryptEmailToken(connection.encryptedRefreshToken);
  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const tokenRes = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });
  const tokenPayload: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenPayload.access_token) {
    throw new Error("zoho_access_token_refresh_failed");
  }

  const expiresInSeconds = Number(tokenPayload.expires_in || 0);
  const accessTokenExpiresAt = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? new Date(Date.now() + expiresInSeconds * 1000)
    : null;

  await storage.upsertUserEmailConnection({
    userId: connection.userId,
    provider: connection.provider || ZOHO_MAIL_PROVIDER,
    providerEmail: connection.providerEmail || null,
    providerAccountId: connection.providerAccountId || null,
    providerUserId: connection.providerUserId || null,
    providerOrgId: connection.providerOrgId || null,
    encryptedRefreshToken: connection.encryptedRefreshToken,
    encryptedAccessToken: encryptEmailToken(String(tokenPayload.access_token)),
    accessTokenExpiresAt,
    scopes: String(tokenPayload.scope || connection.scopes || ZOHO_MAIL_SCOPES.join(" ")),
    status: "connected",
    lastConnectedAt: connection.lastConnectedAt || new Date(),
    lastValidatedAt: new Date(),
    revokedAt: null,
  });

  return String(tokenPayload.access_token);
};

const expenseReceiptUpload = raw({
  type: ["application/pdf", "image/png", "image/jpeg"],
  limit: "5mb",
});

const normalizeSourcingRole = (role?: string | null) => {
  const normalized = String(role || "").toLowerCase().trim();
  if (normalized === "administrator") return "admin";
  if (normalized === "project manager") return "pm";
  if (normalized === "research associate") return "ra";
  if (normalized === "chief executive officer") return "ceo";
  if (normalized === "chief operating officer") return "coo";
  return normalized;
};

const canOwnSourcingAttribution = (role?: string | null) =>
  ["admin", "ceo", "coo", "pm", "ra"].includes(normalizeSourcingRole(role));

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/email-assets/mirae-connext-logo.png", (_req, res) => {
    const logoPath = path.resolve(process.cwd(), "attached_assets", "Logo_1764384177823.png");
    if (!fs.existsSync(logoPath)) {
      return res.status(404).send("Not found");
    }

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(logoPath);
  });

  // ==================== AUTH ROUTES (PUBLIC) ====================
  app.post("/api/auth/login", loginHandler);
  app.get("/api/auth/me", authMiddleware, getMeHandler);

  app.get("/api/email/sender-identity", authMiddleware, async (req: AuthRequest, res) => {
    const senderIdentity = resolveEmailSenderIdentity(req.user);
    res.json({
      fromName: senderIdentity.fromName,
      fromEmail: senderIdentity.fromEmail,
      isValid: senderIdentity.isValid,
      reason: senderIdentity.reason,
    });
  });

  app.get("/api/email/templates", authMiddleware, requireRoles("admin", "ceo", "coo"), async (_req, res) => {
    try {
      await ensureDefaultAdvisorEmailTemplates();
      const managedTemplates = await storage.getEmailTemplates();
      const managedByKey = new Map(
        managedTemplates.map((template) => [`${template.templateType}:${template.language}`, template])
      );
      const templates = ADVISOR_EMAIL_TEMPLATE_TYPES.flatMap((templateType) =>
        ADVISOR_EMAIL_TEMPLATE_LANGUAGES.map((language) => {
          const managed = managedByKey.get(`${templateType}:${language}`);
          if (managed) return getAdvisorTemplateSafeFields(managed, "managed");
          const defaults = getDefaultAdvisorEmailTemplate(templateType, language);
          return getAdvisorTemplateSafeFields({
            id: null,
            templateType,
            language,
            subject: defaults.subject,
            body: defaults.body,
            description: defaults.description,
            isActive: true,
          }, "default");
        })
      );

      res.json({
        templates,
        templateTypes: ADVISOR_EMAIL_TEMPLATE_TYPES,
        languages: ADVISOR_EMAIL_TEMPLATE_LANGUAGES,
        allowedVariables: ADVISOR_EMAIL_ALLOWED_VARIABLES,
      });
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.get("/api/email/templates/:templateType/:language", authMiddleware, async (req, res) => {
    try {
      const templateType = normalizeAdvisorTemplateType(req.params.templateType);
      const language = normalizeAdvisorTemplateLanguage(req.params.language);
      if (!templateType) {
        return res.status(400).json({ error: "Invalid email template type." });
      }

      const { template, source } = await getAdvisorEmailTemplateForSend(templateType, language);
      res.json({
        template: getAdvisorTemplateSafeFields(template, source),
        allowedVariables: ADVISOR_EMAIL_ALLOWED_VARIABLES,
      });
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  app.patch("/api/email/templates/:id", authMiddleware, requireRoles("admin", "ceo", "coo"), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid email template id." });
      }

      const existing = await storage.getEmailTemplateById(id);
      if (!existing) {
        return res.status(404).json({ error: "Email template not found." });
      }

      const subject = String(req.body?.subject || "").trim();
      const body = String(req.body?.body || "").trim();
      const description = req.body?.description === undefined ? existing.description : String(req.body.description || "").trim() || null;
      const isActive = req.body?.isActive === undefined ? existing.isActive : Boolean(req.body.isActive);

      if (!subject || !body) {
        return res.status(400).json({ error: "Subject and body are required." });
      }
      if (subject.length > 300 || body.length > 20000) {
        return res.status(400).json({ error: "Subject or body is too long." });
      }

      const unsupportedVariables = findUnsupportedAdvisorTemplateVariables(subject, body);
      if (unsupportedVariables.length > 0) {
        return res.status(400).json({
          error: `Unsupported variable${unsupportedVariables.length === 1 ? "" : "s"}: ${unsupportedVariables.join(", ")}`,
          unsupportedVariables,
        });
      }

      const updated = await storage.updateEmailTemplate(id, {
        subject,
        body,
        description,
        isActive,
        updatedBy: req.user!.id,
      });
      if (!updated) {
        return res.status(404).json({ error: "Email template not found." });
      }
      res.json({ template: getAdvisorTemplateSafeFields(updated, "managed") });
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.post("/api/email/templates", authMiddleware, requireRoles("admin", "ceo", "coo"), async (req: AuthRequest, res) => {
    try {
      const templateType = normalizeAdvisorTemplateType(req.body?.templateType);
      const language = normalizeAdvisorTemplateLanguage(req.body?.language);
      const subject = String(req.body?.subject || "").trim();
      const body = String(req.body?.body || "").trim();
      const description = String(req.body?.description || "").trim() || null;
      const isActive = req.body?.isActive === undefined ? true : Boolean(req.body.isActive);

      if (!templateType) {
        return res.status(400).json({ error: "Invalid email template type." });
      }
      if (!subject || !body) {
        return res.status(400).json({ error: "Subject and body are required." });
      }
      if (subject.length > 300 || body.length > 20000) {
        return res.status(400).json({ error: "Subject or body is too long." });
      }

      const unsupportedVariables = findUnsupportedAdvisorTemplateVariables(subject, body);
      if (unsupportedVariables.length > 0) {
        return res.status(400).json({
          error: `Unsupported variable${unsupportedVariables.length === 1 ? "" : "s"}: ${unsupportedVariables.join(", ")}`,
          unsupportedVariables,
        });
      }

      const template = await storage.upsertEmailTemplate({
        templateType,
        language,
        subject,
        body,
        description,
        isActive,
        updatedBy: req.user!.id,
      });
      res.json({ template: getAdvisorTemplateSafeFields(template, "managed") });
    } catch (error) {
      console.error("Error saving email template:", error);
      res.status(500).json({ error: "Failed to save email template" });
    }
  });

  app.post("/api/email/templates/reset-default", authMiddleware, requireRoles("admin", "ceo", "coo"), async (req: AuthRequest, res) => {
    try {
      const templateType = normalizeAdvisorTemplateType(req.body?.templateType);
      const language = normalizeAdvisorTemplateLanguage(req.body?.language);
      if (!templateType) {
        return res.status(400).json({ error: "Invalid email template type." });
      }

      const defaults = getDefaultAdvisorEmailTemplate(templateType, language);
      const template = await storage.upsertEmailTemplate({
        templateType,
        language,
        subject: defaults.subject,
        body: defaults.body,
        description: defaults.description,
        isActive: true,
        updatedBy: req.user!.id,
      });
      res.json({ template: getAdvisorTemplateSafeFields(template, "managed") });
    } catch (error) {
      console.error("Error resetting email template:", error);
      res.status(500).json({ error: "Failed to reset email template" });
    }
  });

  app.get("/api/email/zoho/status", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const config = getZohoOAuthConfig();
      if (!config.isConfigured) {
        return res.json({
          provider: ZOHO_MAIL_PROVIDER,
          isConnected: false,
          providerEmail: null,
          status: "error",
          lastConnectedAt: null,
          lastValidatedAt: null,
          reason: "Zoho OAuth is not configured.",
        });
      }

      const connection = await storage.getUserEmailConnection(req.user!.id, ZOHO_MAIL_PROVIDER);
      if (!connection || connection.status !== "connected") {
        return res.json({
          provider: ZOHO_MAIL_PROVIDER,
          isConnected: false,
          providerEmail: connection?.providerEmail || null,
          status: connection?.status || "disconnected",
          lastConnectedAt: connection?.lastConnectedAt || null,
          lastValidatedAt: connection?.lastValidatedAt || null,
          reason: connection?.status === "error" ? "Zoho Mail connection needs attention." : "Zoho Mail is not connected.",
        });
      }

      res.json({
        provider: ZOHO_MAIL_PROVIDER,
        isConnected: true,
        providerEmail: connection.providerEmail,
        status: connection.status,
        lastConnectedAt: connection.lastConnectedAt,
        lastValidatedAt: connection.lastValidatedAt,
      });
    } catch (error) {
      console.error("Error fetching Zoho email connection status:", error);
      res.status(500).json({ error: "Failed to fetch Zoho connection status" });
    }
  });

  app.post("/api/email/zoho/connect/start", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const senderIdentity = resolveEmailSenderIdentity(req.user);
      if (!senderIdentity.isValid) {
        return res.status(400).json({
          error: senderIdentity.reason || "Sender identity is not configured for Mirae Connext email sending.",
        });
      }

      const config = getZohoOAuthConfig();
      const redirectUriParts = getSafeRedirectUriParts(config.redirectUri);

      if (!config.isConfigured) {
        return res.status(503).json({ error: "Zoho OAuth is not configured." });
      }

      if (!redirectUriParts.redirectUriHost || !redirectUriParts.redirectUriPath) {
        return res.status(503).json({ error: "Zoho OAuth redirect URI is not configured correctly." });
      }

      const state = `zoh_${crypto.randomBytes(32).toString("hex")}`;
      await storage.createEmailOauthState({
        state,
        userId: req.user!.id,
        provider: ZOHO_MAIL_PROVIDER,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const authorizationUrl = new URL("/oauth/v2/auth", config.accountsBaseUrl);
      authorizationUrl.searchParams.set("scope", ZOHO_MAIL_SCOPES.join(" "));
      authorizationUrl.searchParams.set("client_id", config.clientId);
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set("access_type", "offline");
      authorizationUrl.searchParams.set("prompt", "consent");
      authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
      authorizationUrl.searchParams.set("state", state);

      res.json({ authorizationUrl: authorizationUrl.toString() });
    } catch (error) {
      console.error("Error starting Zoho OAuth connection:", error);
      res.status(500).json({ error: "Failed to start Zoho OAuth connection" });
    }
  });

  app.get("/api/email/zoho/callback", async (req: AuthRequest, res) => {
    const fail = (reason: string) => res.redirect(buildEmailOAuthReturnUrl(req, "error", reason));

    try {
      const code = String(req.query.code || "").trim();
      const stateValue = String(req.query.state || "").trim();
      const oauthError = String(req.query.error || "").trim();

      if (oauthError) return fail("oauth_denied");
      if (!code || !stateValue) return fail("missing_oauth_parameters");

      const oauthState = await storage.getEmailOauthState(stateValue);
      if (!oauthState || oauthState.provider !== ZOHO_MAIL_PROVIDER) return fail("invalid_oauth_state");
      if (oauthState.usedAt) return fail("used_oauth_state");
      if (new Date(oauthState.expiresAt) <= new Date()) return fail("expired_oauth_state");

      await storage.markEmailOauthStateUsed(oauthState.id);

      const user = await storage.getUser(oauthState.userId);
      const senderIdentity = resolveEmailSenderIdentity(user ? {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      } : null);
      if (!senderIdentity.isValid) return fail("invalid_sender_identity");

      const config = getZohoOAuthConfig();
      if (!config.isConfigured) return fail("zoho_oauth_not_configured");

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      });

      const tokenRes = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
      const tokenPayload: any = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenPayload.access_token) return fail("token_exchange_failed");
      if (!tokenPayload.refresh_token) return fail("refresh_token_missing");

      const accountsRes = await fetch(`${config.mailApiBaseUrl}/api/accounts`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${tokenPayload.access_token}`,
        },
      });
      const accountsPayload: any = await accountsRes.json().catch(() => ({}));
      if (!accountsRes.ok) return fail("zoho_accounts_fetch_failed");

      const accounts = extractZohoAccounts(accountsPayload);
      const matchingAccount = accounts.find((account) => getZohoAccountEmail(account) === senderIdentity.fromEmail);
      if (!matchingAccount) {
        await storage.upsertUserEmailConnection({
          userId: oauthState.userId,
          provider: ZOHO_MAIL_PROVIDER,
          providerEmail: accounts.map(getZohoAccountEmail).filter(Boolean)[0] || null,
          status: "error",
          lastValidatedAt: new Date(),
          scopes: String(tokenPayload.scope || ZOHO_MAIL_SCOPES.join(" ")),
        });
        return fail("zoho_email_mismatch");
      }

      const expiresInSeconds = Number(tokenPayload.expires_in || 0);
      const expiresAt = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;
      const now = new Date();

      await storage.upsertUserEmailConnection({
        userId: oauthState.userId,
        provider: ZOHO_MAIL_PROVIDER,
        providerEmail: senderIdentity.fromEmail,
        providerAccountId: getZohoAccountId(matchingAccount),
        providerUserId: String(matchingAccount?.userId || matchingAccount?.zohoUserId || ""),
        providerOrgId: String(matchingAccount?.organizationId || matchingAccount?.orgId || ""),
        encryptedRefreshToken: encryptEmailToken(String(tokenPayload.refresh_token)),
        encryptedAccessToken: tokenPayload.access_token ? encryptEmailToken(String(tokenPayload.access_token)) : null,
        accessTokenExpiresAt: expiresAt,
        scopes: String(tokenPayload.scope || ZOHO_MAIL_SCOPES.join(" ")),
        status: "connected",
        lastConnectedAt: now,
        lastValidatedAt: now,
        revokedAt: null,
      });

      return res.redirect(buildEmailOAuthReturnUrl(req, "connected"));
    } catch (error) {
      console.error("Error handling Zoho OAuth callback:", error);
      return fail("zoho_oauth_callback_failed");
    }
  });

  app.post("/api/email/zoho/disconnect", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const connection = await storage.disconnectUserEmailConnection(req.user!.id, ZOHO_MAIL_PROVIDER);
      res.json({
        provider: ZOHO_MAIL_PROVIDER,
        isConnected: false,
        providerEmail: connection?.providerEmail || null,
        status: connection?.status || "disconnected",
        lastConnectedAt: connection?.lastConnectedAt || null,
        lastValidatedAt: connection?.lastValidatedAt || null,
      });
    } catch (error) {
      console.error("Error disconnecting Zoho Mail:", error);
      res.status(500).json({ error: "Failed to disconnect Zoho Mail" });
    }
  });

  app.post("/api/email/zoho/send-advisor-invite", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const senderIdentity = resolveEmailSenderIdentity(user);
      if (!senderIdentity.isValid) {
        return res.status(400).json({
          error: senderIdentity.reason || "Sender identity is not configured for Mirae Connext email sending.",
        });
      }

      const forbiddenFields = ["cc", "bcc", "attachments"].filter((field) =>
        Object.prototype.hasOwnProperty.call(req.body || {}, field)
      );
      if (forbiddenFields.length > 0) {
        return res.status(400).json({ error: "CC, BCC, and attachments are not supported for advisor invites." });
      }

      const projectId = Number(req.body?.projectId);
      const invitationId = Number(req.body?.invitationId);
      const expertId = Number(req.body?.expertId);
      const toEmail = normalizeEmailForMatch(req.body?.toEmail);
      const subject = String(req.body?.subject || "").trim();
      const body = String(req.body?.body || "").trim();
      const emailType = String(req.body?.emailType || req.body?.emailMode || "initial_invite").trim();

      if (![projectId, invitationId, expertId].every((id) => Number.isInteger(id) && id > 0)) {
        return res.status(400).json({ error: "Invalid project, invitation, or advisor id." });
      }
      if (!advisorEmailTypes.has(emailType)) {
        return res.status(400).json({ error: "Invalid advisor email type." });
      }
      if (!isSingleRecipientEmail(toEmail)) {
        return res.status(400).json({ error: "A single valid advisor recipient email is required." });
      }
      if (!subject || !body) {
        return res.status(400).json({ error: "Subject and body are required before sending." });
      }
      if (subject.length > 300 || body.length > 20000) {
        return res.status(400).json({ error: "Subject or body is too long to send safely." });
      }
      const unsupportedVariables = findUnsupportedAdvisorTemplateVariables(subject, body);
      if (unsupportedVariables.length > 0) {
        return res.status(400).json({ error: "Email contains unsupported template variables." });
      }

      const config = getZohoOAuthConfig();
      if (!config.isConfigured) {
        return res.status(503).json({ error: "Zoho OAuth is not configured." });
      }

      const [project, invitation, expert, projectAssignments] = await Promise.all([
        storage.getProject(projectId),
        storage.getAdvisorProjectInvitation(invitationId),
        storage.getExpert(expertId),
        storage.getProjectExpertsByProject(projectId),
      ]);

      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot send advisor invitations for this project." });
      }
      const isAttachedExpert = projectAssignments.some((assignment) => assignment.expertId === expertId);
      if (!invitation || !expert || !isAttachedExpert || invitation.projectId !== projectId || invitation.expertId !== expertId) {
        return res.status(404).json({ error: "Advisor invitation not found." });
      }

      const invitationEmail = normalizeEmailForMatch(invitation.email);
      const expertEmail = normalizeEmailForMatch(expert.email);
      if (!invitationEmail || invitationEmail !== toEmail || (expertEmail && expertEmail !== toEmail)) {
        return res.status(400).json({ error: "Recipient email must match the selected advisor invitation." });
      }

      const connection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER);
      if (!connection || connection.status !== "connected") {
        return res.status(403).json({ error: "Connect your Zoho Mail account before sending advisor invitations." });
      }
      if (normalizeEmailForMatch(connection.providerEmail) !== senderIdentity.fromEmail) {
        return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
      }

      const accessToken = await getZohoAccessTokenForConnection(connection, config);
      let accountId = String(connection.providerAccountId || "").trim();
      if (!accountId) {
        const latestConnection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER) || connection;
        const accountsRes = await fetch(`${config.mailApiBaseUrl}/api/accounts`, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        const accountsPayload: any = await accountsRes.json().catch(() => ({}));
        if (!accountsRes.ok) {
          return res.status(502).json({ error: "Unable to verify Zoho Mail account before sending." });
        }
        const matchingAccount = extractZohoAccounts(accountsPayload).find(
          (account) => getZohoAccountEmail(account) === senderIdentity.fromEmail
        );
        accountId = getZohoAccountId(matchingAccount);
        if (!accountId) {
          return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
        }
        await storage.upsertUserEmailConnection({
          userId: latestConnection.userId,
          provider: latestConnection.provider || ZOHO_MAIL_PROVIDER,
          providerEmail: senderIdentity.fromEmail,
          providerAccountId: accountId,
          providerUserId: String(matchingAccount?.userId || matchingAccount?.zohoUserId || latestConnection.providerUserId || ""),
          providerOrgId: String(matchingAccount?.organizationId || matchingAccount?.orgId || latestConnection.providerOrgId || ""),
          encryptedRefreshToken: latestConnection.encryptedRefreshToken,
          encryptedAccessToken: latestConnection.encryptedAccessToken,
          accessTokenExpiresAt: latestConnection.accessTokenExpiresAt,
          scopes: latestConnection.scopes || ZOHO_MAIL_SCOPES.join(" "),
          status: "connected",
          lastConnectedAt: latestConnection.lastConnectedAt || new Date(),
          lastValidatedAt: new Date(),
          revokedAt: null,
        });
      }

      const senderProfile = await storage.getUser(user.id);
      const signatureSenderName = senderProfile?.fullName || senderIdentity.fromName;
      const signatureSenderEmail = senderProfile?.email || senderIdentity.fromEmail;
      const tokenData = await ensureAdvisorProjectReviewTokenForSend(invitation);
      const reviewUrl = buildPublicAdvisorProjectReviewUrl(tokenData.token, req);
      const renderedEmail = renderAdvisorTemplateContent(
        { subject, body },
        {
          advisorName: getFirstNameForEmail(expert.name) || expert.name,
          senderName: getFirstNameForEmail(signatureSenderName) || signatureSenderName,
          senderTitle: senderProfile?.jobTitle || null,
          senderEmail: signatureSenderEmail,
          senderMobile: senderProfile?.mobilePhone || null,
          reviewLink: reviewUrl,
        }
      );
      const emailHtml = renderAdvisorEmailHtml({
        body: renderedEmail.body,
        senderName: signatureSenderName,
        senderEmail: signatureSenderEmail,
        signatureName: senderProfile?.signatureName || null,
        jobTitle: senderProfile?.jobTitle || null,
        mobilePhone: senderProfile?.mobilePhone || null,
        logoUrl: buildAdvisorEmailLogoUrl(req),
      });

      const zohoRes = await fetch(`${config.mailApiBaseUrl}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAddress: senderIdentity.fromEmail,
          toAddress: toEmail,
          subject: renderedEmail.subject,
          content: emailHtml,
          mailFormat: "html",
        }),
      });
      const zohoPayload: any = await zohoRes.json().catch(() => ({}));
      if (!zohoRes.ok) {
        console.warn("[zoho-send-advisor-invite]", {
          provider: "zoho",
          userId: user.id,
          projectId,
          invitationId,
          status: zohoRes.status,
        });
        return res.status(502).json({ error: "Zoho Mail could not send the advisor invitation." });
      }

      const sentAt = new Date();
      const providerMessageId = getZohoProviderMessageId(zohoPayload) || null;
      await storage.createAdvisorProjectInvitationEmailSend({
        projectId,
        invitationId,
        expertId,
        sentByUserId: user.id,
        fromEmail: senderIdentity.fromEmail,
        fromName: senderIdentity.fromName || null,
        toEmail,
        subject: renderedEmail.subject,
        body: renderedEmail.body,
        emailType,
        provider: "zoho",
        providerMessageId,
        status: "sent",
        sentAt,
      });

      const currentStatus = String(invitation.status || "").toLowerCase();
      const invitationUpdates = currentStatus === "submitted"
        ? { sentAt: invitation.sentAt || sentAt }
        : { status: "sent", sentAt };
      const updatedInvitation = await storage.updateAdvisorProjectInvitation(invitation.id, invitationUpdates);

      res.json({
        success: true,
        status: "sent",
        sentAt,
        provider: "zoho",
        providerMessageId,
        invitation: {
          id: updatedInvitation?.id || invitation.id,
          status: updatedInvitation?.status || invitation.status,
          sentAt: updatedInvitation?.sentAt || sentAt,
          submittedAt: updatedInvitation?.submittedAt || invitation.submittedAt,
        },
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "zoho_refresh_token_missing" || message === "zoho_access_token_refresh_failed") {
        return res.status(403).json({ error: "Zoho Mail connection needs to be reconnected before sending." });
      }
      console.error("Error sending advisor invitation through Zoho Mail:", error);
      res.status(500).json({ error: "Failed to send advisor invitation email" });
    }
  });

  app.post("/api/projects/:projectId/advisor-invitations/send-selected", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const projectId = Number(req.params.projectId);
      const senderIdentity = resolveEmailSenderIdentity(user);
      if (!senderIdentity.isValid) {
        return res.status(400).json({
          error: senderIdentity.reason || "Sender identity is not configured for Mirae Connext email sending.",
        });
      }

      const forbiddenFields = ["toEmail", "toEmails", "recipients", "cc", "bcc", "attachments", "subject", "body"].filter((field) =>
        Object.prototype.hasOwnProperty.call(req.body || {}, field)
      );
      if (forbiddenFields.length > 0) {
        return res.status(400).json({
          error: "Selected advisor sending only accepts advisor invitation ids. Recipients, CC, BCC, attachments, subject, and body cannot be supplied.",
        });
      }

      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ error: "Invalid project id." });
      }

      const invitationIds = Array.from(
        new Set(
          (Array.isArray(req.body?.invitationIds) ? req.body.invitationIds : [])
            .map((invitationId) => Number(invitationId))
            .filter((invitationId) => Number.isInteger(invitationId) && invitationId > 0)
        )
      );

      if (invitationIds.length === 0) {
        return res.status(400).json({ error: "Select at least one advisor invitation." });
      }
      if (invitationIds.length > SELECTED_ADVISOR_SEND_LIMIT) {
        return res.status(400).json({
          error: `Selected advisor sending is limited to ${SELECTED_ADVISOR_SEND_LIMIT} advisors at a time.`,
        });
      }

      const config = getZohoOAuthConfig();
      if (!config.isConfigured) {
        return res.status(503).json({ error: "Zoho OAuth is not configured." });
      }

      const [project, projectAssignments, senderProfile] = await Promise.all([
        storage.getProject(projectId),
        storage.getProjectExpertsByProject(projectId),
        storage.getUser(user.id),
      ]);

      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot send advisor invitations for this project." });
      }

      const connection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER);
      if (!connection || connection.status !== "connected") {
        return res.status(403).json({ error: "Connect your Zoho Mail account before sending advisor invitations." });
      }
      if (normalizeEmailForMatch(connection.providerEmail) !== senderIdentity.fromEmail) {
        return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
      }

      const accessToken = await getZohoAccessTokenForConnection(connection, config);
      let accountId = String(connection.providerAccountId || "").trim();
      if (!accountId) {
        const latestConnection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER) || connection;
        const accountsRes = await fetch(`${config.mailApiBaseUrl}/api/accounts`, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        const accountsPayload: any = await accountsRes.json().catch(() => ({}));
        if (!accountsRes.ok) {
          return res.status(502).json({ error: "Unable to verify Zoho Mail account before sending." });
        }
        const matchingAccount = extractZohoAccounts(accountsPayload).find(
          (account) => getZohoAccountEmail(account) === senderIdentity.fromEmail
        );
        accountId = getZohoAccountId(matchingAccount);
        if (!accountId) {
          return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
        }
        await storage.upsertUserEmailConnection({
          userId: latestConnection.userId,
          provider: latestConnection.provider || ZOHO_MAIL_PROVIDER,
          providerEmail: senderIdentity.fromEmail,
          providerAccountId: accountId,
          providerUserId: String(matchingAccount?.userId || matchingAccount?.zohoUserId || latestConnection.providerUserId || ""),
          providerOrgId: String(matchingAccount?.organizationId || matchingAccount?.orgId || latestConnection.providerOrgId || ""),
          encryptedRefreshToken: latestConnection.encryptedRefreshToken,
          encryptedAccessToken: latestConnection.encryptedAccessToken,
          accessTokenExpiresAt: latestConnection.accessTokenExpiresAt,
          scopes: latestConnection.scopes || ZOHO_MAIL_SCOPES.join(" "),
          status: "connected",
          lastConnectedAt: latestConnection.lastConnectedAt || new Date(),
          lastValidatedAt: new Date(),
          revokedAt: null,
        });
      }

      const attachedExpertIds = new Set(projectAssignments.map((assignment) => assignment.expertId));
      const senderName = senderProfile?.fullName || senderIdentity.fromName;
      const senderEmail = senderProfile?.email || senderIdentity.fromEmail;
      const logoUrl = buildAdvisorEmailLogoUrl(req);
      const results: Array<{
        invitationId: number;
        expertId?: number | null;
        advisorName?: string | null;
        advisorEmail?: string | null;
        status: "sent" | "skipped" | "failed";
        emailType?: "initial_invite" | "follow_up" | null;
        message: string;
      }> = [];

      let initialInviteCount = 0;
      let followUpCount = 0;
      let submittedSkippedCount = 0;
      let ineligibleSkippedCount = 0;

      for (const invitationId of invitationIds) {
        const invitation = await storage.getAdvisorProjectInvitation(invitationId);
        if (!invitation || invitation.projectId !== projectId) {
          ineligibleSkippedCount += 1;
          results.push({
            invitationId,
            status: "skipped",
            emailType: null,
            message: "Skipped: invalid invitation",
          });
          continue;
        }

        const expert = await storage.getExpert(invitation.expertId);
        const advisorName = expert?.name || `Expert #${invitation.expertId}`;
        const invitationEmail = normalizeEmailForMatch(invitation.email);
        const expertEmail = normalizeEmailForMatch(expert?.email);
        const toEmail = invitationEmail || expertEmail;
        const currentStatus = String(invitation.status || "not_sent").toLowerCase();

        if (!attachedExpertIds.has(invitation.expertId) || !expert) {
          ineligibleSkippedCount += 1;
          results.push({
            invitationId,
            expertId: invitation.expertId,
            advisorName,
            advisorEmail: toEmail || null,
            status: "skipped",
            emailType: null,
            message: "Skipped: invitation is not attached to this project",
          });
          continue;
        }

        if (currentStatus === "submitted") {
          submittedSkippedCount += 1;
          results.push({
            invitationId,
            expertId: invitation.expertId,
            advisorName,
            advisorEmail: toEmail || null,
            status: "skipped",
            emailType: null,
            message: "Skipped: already submitted",
          });
          continue;
        }

        if (!isSingleRecipientEmail(toEmail) || (invitationEmail && expertEmail && invitationEmail !== expertEmail)) {
          ineligibleSkippedCount += 1;
          results.push({
            invitationId,
            expertId: invitation.expertId,
            advisorName,
            advisorEmail: toEmail || null,
            status: "skipped",
            emailType: null,
            message: "Skipped: missing or invalid email",
          });
          continue;
        }

        const emailType: "initial_invite" | "follow_up" =
          currentStatus === "sent" || invitation.sentAt ? "follow_up" : "initial_invite";
        if (emailType === "follow_up") followUpCount += 1;
        else initialInviteCount += 1;

        let token: string;
        try {
          const tokenData = await ensureAdvisorProjectReviewTokenForSend(invitation);
          token = tokenData.token;
        } catch {
          results.push({
            invitationId,
            expertId: invitation.expertId,
            advisorName,
            advisorEmail: toEmail,
            status: "failed",
            emailType,
            message: "Failed: could not generate review link",
          });
          continue;
        }

        const reviewUrl = buildPublicAdvisorProjectReviewUrl(token, req);
        const { subject, body } = await resolveAdvisorEmailTemplateForSend({
          templateType: mapAdvisorEmailTypeToTemplateType(emailType),
          language: "en",
          context: {
            advisorName: getFirstNameForEmail(advisorName) || advisorName,
            senderName: getFirstNameForEmail(senderName) || senderName,
            senderTitle: senderProfile?.jobTitle || null,
            senderEmail,
            senderMobile: senderProfile?.mobilePhone || null,
            reviewLink: reviewUrl,
          },
        });
        const emailHtml = renderAdvisorEmailHtml({
          body,
          senderName,
          senderEmail,
          signatureName: senderProfile?.signatureName || null,
          jobTitle: senderProfile?.jobTitle || null,
          mobilePhone: senderProfile?.mobilePhone || null,
          logoUrl,
        });

        const zohoRes = await fetch(`${config.mailApiBaseUrl}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fromAddress: senderIdentity.fromEmail,
            toAddress: toEmail,
            subject,
            content: emailHtml,
            mailFormat: "html",
          }),
        });
        const zohoPayload: any = await zohoRes.json().catch(() => ({}));
        if (!zohoRes.ok) {
          console.warn("[zoho-send-selected-advisor-invite]", {
            provider: "zoho",
            userId: user.id,
            projectId,
            invitationId,
            status: zohoRes.status,
          });
          results.push({
            invitationId,
            expertId: invitation.expertId,
            advisorName,
            advisorEmail: toEmail,
            status: "failed",
            emailType,
            message: "Failed: Zoho send error",
          });
          continue;
        }

        const sentAt = new Date();
        const providerMessageId = getZohoProviderMessageId(zohoPayload) || null;
        await storage.createAdvisorProjectInvitationEmailSend({
          projectId,
          invitationId,
          expertId: invitation.expertId,
          sentByUserId: user.id,
          fromEmail: senderIdentity.fromEmail,
          fromName: senderIdentity.fromName || null,
          toEmail,
          subject,
          body,
          emailType,
          provider: "zoho",
          providerMessageId,
          status: "sent",
          sentAt,
        });

        await storage.updateAdvisorProjectInvitation(invitation.id, {
          status: "sent",
          sentAt,
        });

        results.push({
          invitationId,
          expertId: invitation.expertId,
          advisorName,
          advisorEmail: toEmail,
          status: "sent",
          emailType,
          message: emailType === "follow_up" ? "Sent follow-up" : "Sent initial invite",
        });
      }

      const sentCount = results.filter((result) => result.status === "sent").length;
      const skippedCount = results.filter((result) => result.status === "skipped").length;
      const failedCount = results.filter((result) => result.status === "failed").length;

      res.json({
        success: true,
        summary: {
          totalSelected: invitationIds.length,
          sentCount,
          skippedCount,
          failedCount,
          initialInviteCount,
          followUpCount,
          submittedSkippedCount,
          ineligibleSkippedCount,
        },
        results,
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "zoho_refresh_token_missing" || message === "zoho_access_token_refresh_failed") {
        return res.status(403).json({ error: "Zoho Mail connection needs to be reconnected before sending." });
      }
      console.error("Error sending selected advisor invitations through Zoho Mail:", error);
      res.status(500).json({ error: "Failed to send selected advisor invitation emails" });
    }
  });

  // POST /api/auth/change-password - Change password on first login
  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new passwords are required" });
      }

      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      if (confirmPassword !== undefined && newPassword !== confirmPassword) {
        return res.status(400).json({ error: "New password and confirmation do not match" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user from database
      const user = await storage.getUser(req.user.id);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const isSamePassword = await comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        return res.status(400).json({ error: "New password must be different from the current password" });
      }

      // Hash new password and update user
      const hashedNewPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.user.id, {
        passwordHash: hashedNewPassword,
        mustChangePassword: false,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const verifiedUser = await storage.getUser(req.user.id);
      if (!verifiedUser || !verifiedUser.passwordHash) {
        return res.status(500).json({ error: "Password update could not be verified" });
      }

      const newPasswordWorks = await comparePassword(newPassword, verifiedUser.passwordHash);
      const oldPasswordStillWorks = await comparePassword(currentPassword, verifiedUser.passwordHash);
      const passwordHashChanged = verifiedUser.passwordHash !== user.passwordHash;
      const passwordChangePersisted =
        passwordHashChanged &&
        newPasswordWorks &&
        !oldPasswordStillWorks &&
        verifiedUser.mustChangePassword === false;

      if (!passwordChangePersisted) {
        return res.status(500).json({ error: "Password update was not persisted" });
      }

      const authUser = {
        id: verifiedUser.id,
        fullName: verifiedUser.fullName,
        email: verifiedUser.email,
        role: verifiedUser.role,
        mustChangePassword: verifiedUser.mustChangePassword ?? false,
      };

      res.json({
        success: true,
        changePasswordRouteVersion: CHANGE_PASSWORD_ROUTE_VERSION,
        token: generateToken(authUser),
        user: authUser,
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Note: Some routes need to be public for expert registration
  // Public routes: /api/auth/*, /api/register-expert/:token, /api/invitation-links/:token (GET only)
  // ==================== USERS (PROTECTED) ====================
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get RAs for assignment (users with role 'ra')
  // IMPORTANT: Must be BEFORE /:id route to avoid route matching conflicts
  app.get("/api/users/ras", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const ras = users.filter(u => {
        const matchesRole = u.role === "ra" || u.role === "Research Associate";
        const isActive = u.isActive === true;
        return matchesRole && isActive;
      });
      const result = ras.map(ra => ({ 
        id: ra.id, 
        fullName: ra.fullName, 
        email: ra.email 
      }));
      res.json(result);
    } catch (error) {
      console.error("Error fetching RAs:", error);
      res.status(500).json({ error: "Failed to fetch RAs" });
    }
  });

  app.get("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", authMiddleware, async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const user = await storage.createUser(result.data);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const user = await storage.updateUser(id, result.data);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==================== EMPLOYEES (ADMIN ONLY) ====================
  const normalizeOptionalEmployeeText = (value: unknown) => {
    if (value === undefined) return undefined;
    const text = String(value || "").trim();
    return text || null;
  };

  const isValidOptionalMobilePhone = (value: string | null | undefined) =>
    !value || /^[+\d\s().-]+$/.test(value);

  app.get("/api/employees", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { fullName, localPart, role, tempPassword } = req.body;
      const signatureName = normalizeOptionalEmployeeText(req.body.signatureName);
      const jobTitle = normalizeOptionalEmployeeText(req.body.jobTitle);
      const mobilePhone = normalizeOptionalEmployeeText(req.body.mobilePhone);
      
      if (!fullName || !localPart || !role || !tempPassword) {
        return res.status(400).json({ error: "fullName, localPart, role, and tempPassword are required" });
      }
      
      if (!["admin", "pm", "ra", "finance"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be admin, pm, ra, or finance" });
      }
      if (!isValidOptionalMobilePhone(mobilePhone)) {
        return res.status(400).json({ error: "Mobile phone may contain only +, spaces, numbers, parentheses, periods, and hyphens" });
      }
      
      const email = `${localPart.toLowerCase()}@miraeconnext.com`;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An employee with this email already exists" });
      }
      
      const passwordHash = await hashPassword(tempPassword);
      
      const user = await storage.createUser({
        fullName,
        email,
        passwordHash,
        role,
        signatureName,
        jobTitle,
        mobilePhone,
        isActive: true,
        mustChangePassword: true, // Force password change on first login
      });
      
      // Remove passwordHash from response
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { fullName, role, isActive } = req.body;
      
      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (role !== undefined) {
        if (!["admin", "pm", "ra", "finance"].includes(role)) {
          return res.status(400).json({ error: "Invalid role. Must be admin, pm, ra, or finance" });
        }
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (req.body.signatureName !== undefined) updateData.signatureName = normalizeOptionalEmployeeText(req.body.signatureName);
      if (req.body.jobTitle !== undefined) updateData.jobTitle = normalizeOptionalEmployeeText(req.body.jobTitle);
      if (req.body.mobilePhone !== undefined) {
        const mobilePhone = normalizeOptionalEmployeeText(req.body.mobilePhone);
        if (!isValidOptionalMobilePhone(mobilePhone)) {
          return res.status(400).json({ error: "Mobile phone may contain only +, spaces, numbers, parentheses, periods, and hyphens" });
        }
        updateData.mobilePhone = mobilePhone;
      }
      
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Remove passwordHash from response
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.post("/api/employees/:id/reset-password", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { tempPassword } = req.body;
      
      if (!tempPassword) {
        return res.status(400).json({ error: "tempPassword is required" });
      }
      
      const passwordHash = await hashPassword(tempPassword);
      const user = await storage.updateUser(id, { passwordHash });
      
      if (!user) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ==================== CLIENTS (CRM) ====================
  // All roles can view clients
  app.get("/api/clients", authMiddleware, async (req, res) => {
    try {
      const { q, industry, status } = req.query;
      const clients = await storage.searchClients({
        query: q as string | undefined,
        industry: industry as string | undefined,
        status: status as string | undefined,
      });
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Only admin and pm can create clients
  app.post("/api/clients", authMiddleware, requireRoles("admin", "pm", "ra"), async (req, res) => {
    try {
      const result = insertClientSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const client = await storage.createClient(result.data);
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // Only admin and pm can update clients
  app.patch("/api/clients/:id", authMiddleware, requireRoles("admin", "pm", "ra"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const client = await storage.updateClient(id, result.data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Only admin can delete clients
  app.delete("/api/clients/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClient(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ==================== CLIENT ORGANIZATIONS ====================
  app.get("/api/client-organizations", authMiddleware, async (req, res) => {
    try {
      const organizations = await storage.getClientOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client organizations" });
    }
  });

  app.get("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = await storage.getClientOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client organization" });
    }
  });

  app.get("/api/client-organizations/:id/projects", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projects = await storage.getProjectsByOrganization(id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization projects" });
    }
  });

  app.get("/api/client-organizations/:id/pocs", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pocs = await storage.getClientPocsByOrganization(id);
      res.json(pocs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization POCs" });
    }
  });

  app.get("/api/client-organizations/:id/cu-summary", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = await storage.getClientOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Client organization not found" });
      }

      const now = new Date();
      const retainerPeriod = (org.retainerPeriod || "contract").toLowerCase();
      const contractStart = org.contractStartDate ? new Date(org.contractStartDate) : null;
      const contractEnd = org.contractEndDate ? new Date(org.contractEndDate) : null;
      let periodStart: Date | null = contractStart;
      let periodEnd: Date | null = contractEnd;

      if (retainerPeriod === "monthly") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      } else if (retainerPeriod === "quarterly") {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        periodStart = new Date(now.getFullYear(), quarterStartMonth, 1);
        periodEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 1);
      } else if (retainerPeriod === "annual" || retainerPeriod === "yearly") {
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear() + 1, 0, 1);
      }

      if (contractStart && periodStart && periodStart < contractStart) periodStart = contractStart;
      if (contractEnd && periodEnd && periodEnd > contractEnd) periodEnd = contractEnd;

      const organizationProjects = await storage.getProjectsByOrganization(id);
      const organizationProjectIds = organizationProjects.map((project) => project.id);
      const completedCalls = await db
        .select({
          id: callRecords.id,
          completedAt: callRecords.completedAt,
          callDate: callRecords.callDate,
          cuUsed: callRecords.cuUsed,
          projectCuRatePerCU: projects.cuRatePerCU,
        })
        .from(callRecords)
        .innerJoin(projects, eq(callRecords.projectId, projects.id))
        .where(
          and(
            organizationProjectIds.length > 0 ? inArray(projects.id, organizationProjectIds) : sql`false`,
            eq(callRecords.status, "completed"),
            sql`${callRecords.completedAt} IS NOT NULL`
          )
        );

      const completedCu = completedCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
      const retainerCompletedCu = completedCalls
        .filter((call) => {
          const completedAt = call.completedAt ? new Date(call.completedAt) : null;
          if (!completedAt) return false;
          if (periodStart && completedAt < periodStart) return false;
          if (periodEnd && completedAt >= periodEnd) return false;
          return true;
        })
        .reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);

      const purchasedCu = parseFloat(org.purchasedCu || org.creditBalance || "0");
      const retainerCuAllowance = parseFloat(org.retainerCuAllowance || org.retainerBalance || "0");
      const defaultCuRate = parseFloat(org.defaultCuRate || "0");
      const pricingModel = (org.pricingModel || org.contractType || "").toLowerCase();
      const isPayAsYouGo = pricingModel.includes("pay") || pricingModel.includes("usage");
      const payAsYouGoBillableCu = isPayAsYouGo ? completedCu : 0;
      const estimatedRevenue = completedCalls.reduce((sum, call) => {
        const cuUsed = parseFloat(call.cuUsed || "0");
        const rate = parseFloat(call.projectCuRatePerCU || "") || defaultCuRate;
        return sum + cuUsed * rate;
      }, 0);

      res.json({
        clientOrganizationId: id,
        pricingModel: org.pricingModel,
        contractType: org.contractType,
        currency: org.currency || "USD",
        defaultCuRate,
        completedCu: Math.round(completedCu * 100) / 100,
        purchasedCu,
        remainingPrepaidCu: Math.round((purchasedCu - completedCu) * 100) / 100,
        retainerCuAllowance,
        retainerPeriod: org.retainerPeriod || null,
        retainerPeriodStart: periodStart,
        retainerPeriodEnd: periodEnd,
        retainerCompletedCu: Math.round(retainerCompletedCu * 100) / 100,
        remainingRetainerCu: Math.max(0, Math.round((retainerCuAllowance - retainerCompletedCu) * 100) / 100),
        payAsYouGoBillableCu: Math.round(payAsYouGoBillableCu * 100) / 100,
        estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
        completedCallCount: completedCalls.length,
      });
    } catch (error) {
      console.error("Failed to calculate client CU summary:", error);
      res.status(500).json({ error: "Failed to calculate client CU summary" });
    }
  });

  app.post("/api/client-organizations", authMiddleware, async (req, res) => {
    try {
      const result = insertClientOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const org = await storage.createClientOrganization(result.data);
      res.status(201).json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client organization" });
    }
  });

  app.patch("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientOrganizationSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const org = await storage.updateClientOrganization(id, result.data);
      if (!org) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client organization" });
    }
  });

  app.delete("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClientOrganization(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client organization" });
    }
  });

  // ==================== CLIENT POCS ====================
  app.get("/api/client-pocs", authMiddleware, async (req, res) => {
    try {
      const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string) : null;
      const pocs = organizationId
        ? await storage.getClientPocsByOrganization(organizationId)
        : await storage.getClientPocs();
      res.json(pocs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client POCs" });
    }
  });

  app.post("/api/client-pocs", authMiddleware, async (req, res) => {
    try {
      const result = insertClientPocSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const poc = await storage.createClientPoc(result.data);
      res.status(201).json(poc);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client POC" });
    }
  });

  app.patch("/api/client-pocs/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientPocSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const poc = await storage.updateClientPoc(id, result.data);
      if (!poc) {
        return res.status(404).json({ error: "Client POC not found" });
      }
      res.json(poc);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client POC" });
    }
  });

  app.delete("/api/client-pocs/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClientPoc(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client POC not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client POC" });
    }
  });

  // ==================== PROJECTS ====================
  app.get("/api/projects", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      let projects = await storage.getProjects();
      
      // Filter by RA's assigned projects if user is RA
      if (user?.role === "ra" || user?.role === "Research Associate") {
        projects = projects.filter((p: any) => 
          p.assignedRaId === user.id || 
          (p.assignedRaIds && p.assignedRaIds.includes(user.id))
        );
      }
      
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Helper function to check if RA has access to project
  // Checks both legacy single RA field (assignedRaId) and new array field (assignedRaIds)
  function raHasProjectAccess(project: any, userId: number): boolean {
    // Check legacy single RA assignment
    if (project.assignedRaId === userId) {
      return true;
    }
    // Check new array-based assignment (only if array exists and has entries)
    if (Array.isArray(project.assignedRaIds) && project.assignedRaIds.includes(userId)) {
      return true;
    }
    return false;
  }

  function canManageProjectAdvisorInvitations(project: any, user: any): boolean {
    const role = String(user?.role || "").toLowerCase();
    if (["admin", "ceo", "coo"].includes(role)) return true;
    if (role === "pm") {
      return !project.createdByPmId || project.createdByPmId === user.id;
    }
    return false;
  }

  function canManageProjectPaymentDetails(project: any, user: any): boolean {
    const role = String(user?.role || "").toLowerCase();
    if (["admin", "ceo", "coo", "finance"].includes(role)) return true;
    if (role === "pm") return !project.createdByPmId || project.createdByPmId === user.id;
    if (role === "ra" || role === "research associate") return raHasProjectAccess(project, user.id);
    return false;
  }

  app.get("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check RA access
      if ((user?.role === "ra" || user?.role === "Research Associate") && !raHasProjectAccess(project, user.id)) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this project" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", authMiddleware, async (req, res) => {
    try {
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const project = await storage.createProject(result.data);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const project = await storage.updateProject(id, result.data);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Get project detail with experts, activities, and vetting questions
  app.get("/api/projects/:id/detail", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check RA access
      if ((user?.role === "ra" || user?.role === "Research Associate") && !raHasProjectAccess(project, user.id)) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this project" });
      }

      // Fetch related data
      const [projectExperts, vettingQuestions, activities, inviteLinks, angles, advisorResponses] = await Promise.all([
        storage.getProjectExpertsByProject(id),
        storage.getVettingQuestionsByProject(id),
        storage.getProjectActivities(id),
        storage.getExpertInvitationLinksByProject(id),
        storage.getProjectAngles(id),
        storage.getAdvisorProjectResponsesByProject(id),
      ]);

      const advisorResponseByExpertId = new Map<number, typeof advisorResponses[number]>();
      advisorResponses.forEach((response) => {
        if (!advisorResponseByExpertId.has(response.expertId)) {
          advisorResponseByExpertId.set(response.expertId, response);
        }
      });

      // Enrich project experts with expert details
      const enrichedExperts = await Promise.all(
        projectExperts.map(async (pe) => {
          const expert = await storage.getExpert(pe.expertId);
          let sourcedByRa = null;
          const inviteLink = inviteLinks.find((link) =>
            link.token === pe.invitationToken ||
            (expert?.email && link.candidateEmail === expert.email)
          );
          if (pe.sourcedByRaId || inviteLink?.raId || inviteLink?.recruitedBy) {
            sourcedByRa = pe.sourcedByRaId || inviteLink?.raId
              ? await storage.getUser(pe.sourcedByRaId || inviteLink!.raId!)
              : await storage.getUserByEmail(inviteLink!.recruitedBy);
          }
          const submittedAdvisorResponse = advisorResponseByExpertId.get(pe.expertId);
          return {
            ...pe,
            expert,
            sourcedByRa: sourcedByRa ? { id: sourcedByRa.id, fullName: sourcedByRa.fullName, email: sourcedByRa.email } : null,
            hasSubmittedAdvisorResponse: Boolean(submittedAdvisorResponse),
            submittedAdvisorResponseAt: submittedAdvisorResponse?.submittedAt || null,
            submittedAdvisorInvitationId: submittedAdvisorResponse?.invitationId || null,
          };
        })
      );

      // Fetch assigned RAs details
      let assignedRas: { id: number; fullName: string; email: string }[] = [];
      if (project.assignedRaIds && project.assignedRaIds.length > 0) {
        const raPromises = project.assignedRaIds.map(async (raId) => {
          const ra = await storage.getUser(raId);
          return ra ? { id: ra.id, fullName: ra.fullName, email: ra.email } : null;
        });
        assignedRas = (await Promise.all(raPromises)).filter(Boolean) as typeof assignedRas;
      }

      // Fetch PM details
      let createdByPm = null;
      if (project.createdByPmId) {
        const pm = await storage.getUser(project.createdByPmId);
        if (pm) {
          createdByPm = { id: pm.id, fullName: pm.fullName, email: pm.email };
        }
      }

      const isReviewableApplication = (assignment: typeof enrichedExperts[number]) =>
        assignment.hasSubmittedAdvisorResponse === true ||
        assignment.applicationStatus === "submitted" ||
        Boolean(assignment.acceptedAt) ||
        Boolean(assignment.expectedHourlyRateUsd) ||
        (Array.isArray(assignment.vqAnswers) && assignment.vqAnswers.length > 0);

      // Separate experts by source type for backward-compatible consumers.
      const internalExperts = enrichedExperts.filter(e => e.sourceType === "internal_db");
      const raSourcedExperts = enrichedExperts.filter(e =>
        e.sourceType === "ra_external" ||
        e.sourceType === "ra_sourced" ||
        e.sourceType === "quick_invite" ||
        e.applicationStatus === "submitted"
      );
      const projectAdvisors = enrichedExperts;
      const projectApplications = enrichedExperts.filter(isReviewableApplication);

      const normalizeInviteEmail = (email?: string | null) => String(email || "").trim().toLowerCase();
      const onboardedExpertEmails = new Set(
        raSourcedExperts
          .map((assignment) => normalizeInviteEmail(assignment.expert?.email))
          .filter(Boolean)
      );
      const pendingInviteStatuses = new Set(["pending", "pending_onboarding", "sent", "opened", "in_progress", "awaiting_submission"]);

      // Get RA/quick invite links that have not yet produced an onboarded expert.
      const raInviteLinks = inviteLinks.filter((link) => {
        if (link.inviteType !== "ra" && link.inviteType !== "quick") return false;
        if (!link.isActive) return false;
        if (!pendingInviteStatuses.has(link.status)) return false;
        if (link.expertId) return false;
        const candidateEmail = normalizeInviteEmail(link.candidateEmail);
        if (candidateEmail && onboardedExpertEmails.has(candidateEmail)) return false;
        return true;
      });

      res.json({
        ...project,
        createdByPm,
        assignedRas,
        vettingQuestions,
        internalExperts,
        raSourcedExperts,
        projectAdvisors,
        projectApplications,
        activities,
        raInviteLinks,
        angles,
      });
    } catch (error) {
      console.error("Error fetching project detail:", error);
      res.status(500).json({ error: "Failed to fetch project detail" });
    }
  });

  app.get("/api/projects/:projectId/consultations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = req.user!;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if ((user.role === "ra" || user.role === "Research Associate") && !raHasProjectAccess(project, user.id)) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this project" });
      }

      if (user.role === "pm" && project.createdByPmId && project.createdByPmId !== user.id) {
        return res.status(403).json({ error: "Access denied: You are not the PM owner for this project" });
      }

      const records = await storage.getCallRecordsByProject(projectId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project consultations" });
    }
  });

  app.post("/api/projects/:projectId/consultations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = req.user!;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (user.role === "ra" || user.role === "Research Associate") {
        return res.status(403).json({ error: "Access denied: RAs cannot schedule consultations" });
      }

      if (user.role === "pm" && project.createdByPmId && project.createdByPmId !== user.id) {
        return res.status(403).json({ error: "Access denied: You are not the PM owner for this project" });
      }

      const result = insertCallRecordSchema.safeParse({
        ...req.body,
        projectId,
        status: req.body.status || "pending",
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      if (result.data.projectId !== projectId) {
        return res.status(400).json({ error: "Consultation project does not match route project" });
      }

      const projectExperts = await storage.getProjectExpertsByProject(projectId);
      const isAttachedExpert = projectExperts.some((assignment) => assignment.expertId === result.data.expertId);
      if (!isAttachedExpert) {
        return res.status(400).json({ error: "Expert is not attached to this project" });
      }

      const record = await storage.createCallRecord({
        ...result.data,
        projectId,
        status: "pending",
      });
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project consultation" });
    }
  });

  app.get("/api/projects/:projectId/advisor-invitations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = req.user!;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot view advisor invitation records for this project" });
      }

      const invitations = await storage.getAdvisorProjectInvitationsByProject(projectId);
      const invitationsWithLatestEmail = await Promise.all(
        invitations.map(async (invitation) => {
          const [latestEmailSend] = await storage.getAdvisorProjectInvitationEmailHistory(invitation.id);
          return {
            ...invitation,
            latestEmailSend: latestEmailSend ? {
              id: latestEmailSend.id,
              sentAt: latestEmailSend.sentAt,
              sentBy: latestEmailSend.sentByName || latestEmailSend.sentByEmail || null,
              sentByEmail: latestEmailSend.sentByEmail,
              fromEmail: latestEmailSend.fromEmail,
              toEmail: latestEmailSend.toEmail,
              subject: latestEmailSend.subject,
              emailType: latestEmailSend.emailType,
              provider: latestEmailSend.provider,
              providerMessageId: latestEmailSend.providerMessageId,
              status: latestEmailSend.status,
            } : null,
          };
        })
      );
      res.json(invitationsWithLatestEmail);
    } catch (error) {
      console.error("Error fetching advisor project invitations:", error);
      res.status(500).json({ error: "Failed to fetch advisor project invitations" });
    }
  });

  app.get("/api/projects/:projectId/advisor-invitations/:invitationId/email-history", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const invitationId = parseInt(req.params.invitationId);
      const user = req.user!;

      if (!Number.isInteger(projectId) || !Number.isInteger(invitationId)) {
        return res.status(400).json({ error: "Invalid project or invitation id" });
      }

      const [project, invitation] = await Promise.all([
        storage.getProject(projectId),
        storage.getAdvisorProjectInvitation(invitationId),
      ]);

      if (!project || !invitation || invitation.projectId !== projectId) {
        return res.status(404).json({ error: "Advisor invitation email history not found" });
      }

      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot view advisor invitation email history for this project" });
      }

      const history = await storage.getAdvisorProjectInvitationEmailHistory(invitationId);
      res.json(history.map((item) => ({
        id: item.id,
        sentAt: item.sentAt,
        sentBy: item.sentByName || item.sentByEmail || null,
        sentByEmail: item.sentByEmail,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        toEmail: item.toEmail,
        subject: item.subject,
        emailType: item.emailType,
        provider: item.provider,
        providerMessageId: item.providerMessageId,
        status: item.status,
      })));
    } catch (error) {
      console.error("Error fetching advisor invitation email history:", error);
      res.status(500).json({ error: "Failed to fetch advisor invitation email history" });
    }
  });

  app.get("/api/projects/:projectId/advisor-responses/:expertId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const expertId = parseInt(req.params.expertId);
      const user = req.user!;

      if (!Number.isInteger(projectId) || !Number.isInteger(expertId)) {
        return res.status(400).json({ error: "Invalid project or expert id" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Submitted advisor response not found" });
      }

      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot view advisor responses for this project" });
      }

      const [response, expert, projectAssignments] = await Promise.all([
        storage.getAdvisorProjectResponseByProjectExpert(projectId, expertId),
        storage.getExpert(expertId),
        storage.getProjectExpertsByProject(projectId),
      ]);

      const isAttachedExpert = projectAssignments.some((assignment) => assignment.expertId === expertId);
      if (!response || !expert || !isAttachedExpert) {
        return res.status(404).json({ error: "Submitted advisor response not found" });
      }

      const invitation = await storage.getAdvisorProjectInvitation(response.invitationId);
      if (!invitation || invitation.projectId !== projectId || invitation.expertId !== expertId) {
        return res.status(404).json({ error: "Submitted advisor response not found" });
      }

      res.json({
        expert: {
          id: expert.id,
          name: expert.name,
          title: expert.jobTitle,
          company: expert.company,
          location: [expert.city, expert.country].filter(Boolean).join(", ") || null,
          bio: expert.bio || expert.biography || expert.expertise || null,
          rate: expert.hourlyRate,
        },
        invitation: {
          status: invitation.status,
          submittedAt: invitation.submittedAt,
        },
        response: {
          answers: Array.isArray(response.answers) ? response.answers : [],
          consentAccepted: response.consentAccepted,
          submittedAt: response.submittedAt,
        },
      });
    } catch (error) {
      console.error("Error fetching advisor project response:", error);
      res.status(500).json({ error: "Failed to fetch advisor response" });
    }
  });

  app.post("/api/projects/:projectId/advisor-invitations/create-placeholder", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = req.user!;
      const { expertIds } = req.body;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot create advisor invitation drafts for this project" });
      }

      if (!Array.isArray(expertIds) || expertIds.length === 0) {
        return res.status(400).json({ error: "Select at least one advisor" });
      }

      const normalizedExpertIds = Array.from(
        new Set(
          expertIds
            .map((expertId) => Number(expertId))
            .filter((expertId) => Number.isInteger(expertId) && expertId > 0)
        )
      );

      if (normalizedExpertIds.length === 0) {
        return res.status(400).json({ error: "Select at least one valid advisor" });
      }

      const invitations = await storage.createAdvisorProjectInvitationPlaceholders(
        projectId,
        normalizedExpertIds,
        user.id
      );

      res.status(201).json({
        invitations,
        createdCount: invitations.length,
      });
    } catch (error) {
      console.error("Error creating advisor project invitation drafts:", error);
      res.status(500).json({ error: "Failed to create advisor project invitation drafts" });
    }
  });

  app.post("/api/projects/:projectId/advisor-invitations/:invitationId/generate-link", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const invitationId = parseInt(req.params.invitationId);
      const user = req.user!;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!canManageProjectAdvisorInvitations(project, user)) {
        return res.status(403).json({ error: "Access denied: You cannot generate advisor review links for this project" });
      }

      const invitation = await storage.getAdvisorProjectInvitation(invitationId);
      if (!invitation || invitation.projectId !== projectId) {
        return res.status(404).json({ error: "Advisor invitation not found" });
      }

      const now = new Date();
      const currentExpiration = invitation.expiresAt ? new Date(invitation.expiresAt) : null;
      const hasValidToken = Boolean(
        invitation.token &&
        currentExpiration &&
        !Number.isNaN(currentExpiration.getTime()) &&
        currentExpiration > now
      );

      let token = invitation.token;
      let expiresAt = currentExpiration;

      if (!hasValidToken) {
        if (token && (!currentExpiration || Number.isNaN(currentExpiration.getTime()))) {
          expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        } else {
          token = null;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const candidate = generateAdvisorProjectReviewToken();
            const existing = await storage.getAdvisorProjectInvitationByToken(candidate);
            if (!existing) {
              token = candidate;
              break;
            }
          }
          expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        }

        if (!token) {
          return res.status(500).json({ error: "Failed to generate advisor review token" });
        }

        await storage.updateAdvisorProjectInvitation(invitation.id, {
          token,
          expiresAt,
          status: invitation.status === "not_sent" ? "draft" : invitation.status || "draft",
        });
      } else if (invitation.status === "not_sent") {
        await storage.updateAdvisorProjectInvitation(invitation.id, {
          status: "draft",
        });
      }

      res.json({
        invitationId: invitation.id,
        projectId,
        expertId: invitation.expertId,
        publicReviewUrl: buildPublicAdvisorProjectReviewUrl(token!, req),
        expiresAt,
      });
    } catch (error) {
      console.error("Error generating advisor project review link:", error);
      res.status(500).json({ error: "Failed to generate advisor project review link" });
    }
  });

  app.get("/api/public/advisor-project-review/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      const invitation = await storage.getAdvisorProjectInvitationByToken(token);
      const expiresAt = invitation?.expiresAt ? new Date(invitation.expiresAt) : null;
      if (
        !invitation ||
        !expiresAt ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= new Date()
      ) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      const [project, expert, vettingQuestions] = await Promise.all([
        storage.getProject(invitation.projectId),
        storage.getExpert(invitation.expertId),
        storage.getVettingQuestionsByProject(invitation.projectId),
      ]);

      if (!project || !expert) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      const safeBrief = String((project as any).externalAdvisorBrief || "").trim() ||
        "Project details will be shared by the Mirae Connext team.";

      res.json({
        project: {
          id: project.id,
          advisorBrief: safeBrief,
        },
        invitation: {
          id: invitation.id,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          submittedAt: invitation.submittedAt,
        },
        advisor: {
          name: expert.name,
        },
        alreadySubmitted: invitation.status === "submitted" || Boolean(invitation.submittedAt),
        screeningQuestions: vettingQuestions
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((question) => ({
            id: question.id,
            question: question.question,
            questionType: question.questionType,
            isRequired: question.isRequired,
            orderIndex: question.orderIndex,
          })),
      });
    } catch (error) {
      console.error("Error fetching public advisor project review:", error);
      res.status(500).json({ error: "Unable to load this review link" });
    }
  });

  app.post("/api/public/advisor-project-review/:token/submit", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      const invitation = await storage.getAdvisorProjectInvitationByToken(token);
      const expiresAt = invitation?.expiresAt ? new Date(invitation.expiresAt) : null;
      if (
        !invitation ||
        !expiresAt ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= new Date()
      ) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      const [project, expert, vettingQuestions] = await Promise.all([
        storage.getProject(invitation.projectId),
        storage.getExpert(invitation.expertId),
        storage.getVettingQuestionsByProject(invitation.projectId),
      ]);

      if (!project || !expert) {
        return res.status(404).json({ error: "Invalid or expired review link" });
      }

      if (req.body?.consentAccepted !== true) {
        return res.status(400).json({ error: "Consent is required before submitting responses." });
      }

      const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const answerByQuestionId = new Map<number, string>();
      for (const item of incomingAnswers) {
        const questionId = Number(item?.questionId);
        if (!Number.isInteger(questionId)) continue;
        answerByQuestionId.set(questionId, String(item?.answer || "").trim());
      }

      const orderedQuestions = [...vettingQuestions].sort((a, b) => a.orderIndex - b.orderIndex);
      const missingRequiredQuestions = orderedQuestions.filter((question) =>
        question.isRequired && !answerByQuestionId.get(question.id)
      );

      if (missingRequiredQuestions.length > 0) {
        return res.status(400).json({
          error: "Please answer all required screening questions before submitting.",
          missingQuestionIds: missingRequiredQuestions.map((question) => question.id),
        });
      }

      const answers = orderedQuestions.map((question) => ({
        questionId: question.id,
        questionText: question.question,
        answer: answerByQuestionId.get(question.id) || "",
      }));

      const submittedAt = new Date();
      const response = await storage.saveAdvisorProjectResponse({
        invitationId: invitation.id,
        projectId: invitation.projectId,
        expertId: invitation.expertId,
        answers,
        consentAccepted: true,
        submittedAt,
      });

      await storage.updateAdvisorProjectInvitation(invitation.id, {
        status: "submitted",
        submittedAt,
      });

      const projectAssignments = await storage.getProjectExpertsByProject(invitation.projectId);
      const assignment = projectAssignments.find((item) => item.expertId === invitation.expertId);
      if (assignment) {
        await storage.updateProjectExpert(assignment.id, {
          invitationStatus: "submitted",
          applicationStatus: "submitted",
          vqAnswers: answers.map((answer) => ({
            questionId: answer.questionId,
            questionText: answer.questionText,
            answerText: answer.answer,
          })),
          respondedAt: submittedAt,
          lastActivityAt: submittedAt,
        } as any);
      }

      res.json({
        success: true,
        submittedAt: response.submittedAt,
        status: "submitted",
        message: "Thank you. Your responses have been submitted to Mirae Connext.",
      });
    } catch (error) {
      console.error("Error submitting public advisor project review:", error);
      res.status(500).json({ error: "Unable to submit this review link" });
    }
  });

  // Assign RAs to project
  app.post("/api/projects/:id/assign-ras", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { raIds } = req.body;

      if (!Array.isArray(raIds)) {
        return res.status(400).json({ error: "raIds must be an array" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Update project with assigned RAs
      const updated = await storage.updateProject(id, {
        assignedRaIds: raIds,
        updatedAt: new Date(),
      } as any);

      // Log activity
      const user = (req as any).user;
      await storage.createProjectActivity({
        projectId: id,
        userId: user?.id,
        activityType: "ra_assigned",
        description: `Assigned ${raIds.length} RA(s) to project`,
        metadata: { raIds } as Record<string, any>,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error assigning RAs:", error);
      res.status(500).json({ error: "Failed to assign RAs" });
    }
  });

  // Generate RA-specific invite link (always creates a NEW unique token)
  app.post("/api/projects/:id/ra-invite-link", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { raId, candidateName, candidateEmail } = req.body;

      if (!raId) {
        return res.status(400).json({ error: "raId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const ra = await storage.getUser(raId);
      if (!ra || (ra.role !== "ra" && ra.role !== "Research Associate")) {
        return res.status(400).json({ error: "Invalid RA" });
      }

      const existingLink = await storage.getExpertInvitationLinkByProjectAndRa(projectId, raId);
      if (existingLink) {
        await storage.updateExpertInvitationLink(existingLink.id, {
          status: "expired",
          isActive: false,
        });
      }

      // ALWAYS generate a NEW unique token for each invitation
      const token = generateRecruitmentToken();
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        raId,
        inviteType: "ra",
        candidateName: candidateName || null,
        candidateEmail: candidateEmail || null,
        status: "pending_onboarding",
        recruitedBy: ra.email,
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      const inviteUrl = buildPublicRecruitmentUrl(link.token, req as AuthRequest);
      res.json({ link, inviteUrl });
    } catch (error) {
      console.error("Error generating RA invite link:", error);
      res.status(500).json({ error: "Failed to generate RA invite link" });
    }
  });

  // Register new expert from RA Sourcing tab (creates expert, attaches to project, generates invite)
  app.post("/api/projects/:projectId/register-expert", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const {
        email,
        firstName,
        lastName,
        country,
        region,
        countryCode,
        phoneNumber,
        linkedinUrl,
        city,
        canConsultInEnglish,
        timezone,
        experiences,
        biography,
        workHistory,
        hourlyRate,
        currency,
      } = req.body;

      // Check if expert with email already exists
      const existingExpert = await storage.getExpertByEmail(email);
      if (existingExpert) {
        return res.status(400).json({ error: "An expert with this email already exists" });
      }

      // Format phone number
      const fullPhone = `${countryCode} ${phoneNumber}`.trim();

      // Format experience for bio/company/job title
      const currentExperience = experiences?.find((e: any) => e.isCurrent) || experiences?.[0];
      const experienceText = experiences?.map((e: any) => {
        const period = e.isCurrent 
          ? `${e.fromMonth}/${e.fromYear} - Present`
          : `${e.fromMonth}/${e.fromYear} - ${e.toMonth}/${e.toYear}`;
        return `${e.title} at ${e.company} (${period})`;
      }).join("\n") || "";

      // Track the employee who directly sourced this expert.
      let sourcedByRaId: number | null = null;
      if (user && canOwnSourcingAttribution(user.role)) {
        sourcedByRaId = user.id;
      }

      // Create expert
      const expertData = {
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone: fullPhone || null,
        linkedinUrl: linkedinUrl || null,
        country: country || null,
        city: city || null,
        region: region || null,
        timezone: timezone || null,
        company: currentExperience?.company || null,
        jobTitle: currentExperience?.title || null,
        expertise: currentExperience?.title || null,
        industry: project.industry || null,
        yearsOfExperience: 0,
        hourlyRate: hourlyRate || null,
        currency: currency || "USD",
        bio: biography || null,
        biography: biography || null,
        workHistory: {
          summary: workHistory,
          experiences: experiences || [],
        },
        languages: canConsultInEnglish === "yes" ? ["English"] : [],
        status: "available" as const,
        sourcedByRaId,
        sourcedAt: sourcedByRaId ? new Date() : undefined,
        pastEmployers: experiences?.map((e: any) => e.company) || [],
      };

      const newExpert = await storage.createExpert(expertData);

      // Attach expert to project
      const projectExpert = await storage.createProjectExpert({
        projectId,
        expertId: newExpert.id,
        status: "assigned",
        sourceType: "ra_sourced",
        sourcedByRaId,
        pipelineStatus: "ra_sourced",
      });

      // Generate unique invite token
      const token = generateRecruitmentToken();
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        expertId: newExpert.id,
        inviteType: "existing",
        candidateName: newExpert.name,
        candidateEmail: newExpert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        raId: sourcedByRaId,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update project expert with invitation info
      await storage.updateProjectExpert(projectExpert.id, {
        invitationStatus: "invited",
        invitedAt: new Date(),
        invitationToken: token,
      });

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        expertId: newExpert.id,
        activityType: "expert_registered",
        description: `Registered and invited expert ${newExpert.name} to project`,
      });

      const inviteUrl = `/expert/project-invite/${token}`;
      
      res.status(201).json({
        expertId: newExpert.id,
        projectExpertId: projectExpert.id,
        inviteUrl,
        token,
        message: "Expert registered and attached to project successfully",
      });
    } catch (error) {
      console.error("Error registering expert:", error);
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // PUBLIC: Fetch quick invite onboarding data by token
  app.get("/api/quick-invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "pending_onboarding" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const [vettingQuestions, angles] = await Promise.all([
        storage.getVettingQuestionsByProject(link.projectId),
        storage.getProjectAngles(link.projectId),
      ]);
      const angleMap = new Map(angles.map((angle) => [angle.id, angle.title]));

      res.json({
        token: link.token,
        candidateName: link.candidateName,
        candidateEmail: link.candidateEmail,
        project: {
          id: project.id,
          name: project.name,
          industry: project.industry,
          projectOverview: project.projectOverview,
        },
        angles: angles.map((angle) => ({
          id: angle.id,
          title: angle.title,
          description: angle.description,
        })),
        vettingQuestions: vettingQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          angleId: q.angleId,
          angleTitle: q.angleId ? angleMap.get(q.angleId) || null : null,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
        })),
      });
    } catch (error) {
      console.error("Error fetching quick invite data:", error);
      res.status(500).json({ error: "Failed to fetch invite data" });
    }
  });

  // PUBLIC: Submit full expert onboarding form
  app.post("/api/quick-invite/:token/onboard", async (req, res) => {
    try {
      const { token } = req.params;
      const {
        fullName,
        email,
        phoneWhatsapp,
        country,
        city,
        currentTitle,
        currentCompany,
        expectedHourlyRateUsd,
        termsAccepted,
        lgpdAccepted,
        consentLanguage,
        termsVersion,
        privacyPolicyVersion,
        workHistory,
        yearsOfExperience,
        sectorExpertise,
        regionalExpertise,
        professionalBio,
        sampleAnswers,
        availability,
        conflictCheck,
      } = req.body;

      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "pending_onboarding" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      if (!termsAccepted || !lgpdAccepted) {
        return res.status(400).json({ error: "Terms and LGPD consent are required" });
      }

      if (
        !String(fullName || "").trim() ||
        !String(email || "").trim() ||
        !String(phoneWhatsapp || "").trim() ||
        !String(country || "").trim() ||
        !String(city || "").trim() ||
        !String(currentTitle || "").trim() ||
        !String(currentCompany || "").trim() ||
        !expectedHourlyRateUsd ||
        !String(availability || "").trim()
      ) {
        return res.status(400).json({ error: "Missing required onboarding fields" });
      }

      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);
      const normalizedWorkHistory = Array.isArray(workHistory)
        ? workHistory.filter((item: any) => String(item?.company || "").trim() && String(item?.jobTitle || "").trim())
        : [];
      if (normalizedWorkHistory.length === 0) {
        return res.status(400).json({ error: "Work history is required" });
      }

      const requiredQuestionIds = vettingQuestions
        .filter((question) => question.isRequired)
        .map((question) => question.id);
      const answeredQuestionIds = new Set(
        Array.isArray(sampleAnswers)
          ? sampleAnswers
              .filter((answer: any) => answer?.answerText && String(answer.answerText).trim())
              .map((answer: any) => Number(answer.questionId))
          : []
      );
      const missingRequiredAnswer = requiredQuestionIds.some((questionId) => !answeredQuestionIds.has(questionId));
      if (missingRequiredAnswer) {
        return res.status(400).json({ error: "Required vetting question answers are missing" });
      }

      const questionMap = new Map(vettingQuestions.map((question) => [question.id, question.question]));
      const formattedAnswers = Array.isArray(sampleAnswers)
        ? sampleAnswers
            .filter((answer: any) => answer?.answerText && String(answer.answerText).trim())
            .map((answer: any) => ({
              questionId: Number(answer.questionId),
              questionText: questionMap.get(Number(answer.questionId)) || "",
              answerText: String(answer.answerText).trim(),
            }))
        : [];

      const normalizedEmail = String(email).trim().toLowerCase();
      const acceptedAt = new Date();
      const numericRate = Number(expectedHourlyRateUsd);
      const sourceOwner = link.raId
        ? await storage.getUser(link.raId)
        : link.recruitedBy
        ? await storage.getUserByEmail(link.recruitedBy)
        : null;
      const sourceOwnerId = sourceOwner?.id;
      const safeYearsOfExperience = Number.isFinite(Number(yearsOfExperience)) ? Number(yearsOfExperience) : 0;
      const safeSectorExpertise = typeof sectorExpertise === "string" ? sectorExpertise.trim() : "";
      const safeRegionalExpertise = typeof regionalExpertise === "string" ? regionalExpertise.trim() : "";
      const safeProfessionalBio = typeof professionalBio === "string" ? professionalBio.trim() : "";
      const safeExpertise = safeSectorExpertise || project.industry || "Professional";
      if (!Number.isFinite(numericRate) || numericRate <= 0) {
        return res.status(400).json({ error: "Expected hourly rate must be a positive USD amount" });
      }

      // Check if expert with email already exists
      let expert = await storage.getExpertByEmail(normalizedEmail);
      
      if (!expert) {
        // Create new expert with recruitment tracking
        expert = await storage.createExpert({
          name: String(fullName).trim(),
          email: normalizedEmail,
          phone: phoneWhatsapp || null,
          whatsapp: phoneWhatsapp || null,
          country: country || null,
          city: city || null,
          jobTitle: currentTitle || null,
          company: currentCompany || null,
          expertise: safeExpertise,
          sectorExpertise: safeSectorExpertise,
          regionalExpertise: safeRegionalExpertise,
          industry: safeExpertise,
          yearsOfExperience: safeYearsOfExperience,
          hourlyRate: String(numericRate),
          workHistory: normalizedWorkHistory,
          biography: safeProfessionalBio,
          bio: safeProfessionalBio,
          status: "available",
          sourcedByRaId: sourceOwnerId || undefined,
          sourcedAt: sourceOwnerId ? new Date() : undefined,
          termsAccepted: true,
          lgpdAccepted: true,
        });
      } else {
        await storage.updateExpert(expert.id, {
          name: String(fullName).trim(),
          phone: phoneWhatsapp || expert.phone,
          whatsapp: phoneWhatsapp || expert.whatsapp,
          country: country || expert.country,
          city: city || expert.city,
          jobTitle: currentTitle || expert.jobTitle,
          company: currentCompany || expert.company,
          sectorExpertise: safeSectorExpertise || (expert as any).sectorExpertise || "",
          regionalExpertise: safeRegionalExpertise || (expert as any).regionalExpertise || "",
          industry: safeSectorExpertise || expert.industry || project.industry || "Professional",
          expertise: safeSectorExpertise || expert.expertise || project.industry || "Professional",
          yearsOfExperience: safeYearsOfExperience,
          hourlyRate: String(numericRate),
          workHistory: normalizedWorkHistory,
          biography: safeProfessionalBio || expert.biography || "",
          bio: safeProfessionalBio || expert.bio || "",
          termsAccepted: true,
          lgpdAccepted: true,
          ...(sourceOwnerId && !expert.sourcedByRaId
            ? { sourcedByRaId: sourceOwnerId, sourcedAt: new Date() }
            : {}),
        });
        expert = await storage.getExpert(expert.id) || expert;
      }

      const existingProjectExperts = await db
        .select()
        .from(projectExperts)
        .where(and(eq(projectExperts.projectId, link.projectId), eq(projectExperts.expertId, expert.id)))
        .limit(1);

      const projectExpertData = {
        projectId: link.projectId,
        expertId: expert.id,
        angleIds: link.angleIds || undefined,
        status: "pending_review",
        invitationStatus: "submitted",
        pipelineStatus: "interested",
        sourceType: "ra_external",
        sourcedByRaId: sourceOwnerId || undefined,
        invitedAt: link.createdAt || new Date(),
        respondedAt: new Date(),
        invitationToken: token,
        vqAnswers: formattedAnswers,
        availabilityNote: availability || null,
        expectedHourlyRateUsd: String(numericRate),
        termsAccepted: true,
        lgpdAccepted: true,
        acceptedAt,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get("user-agent") || null,
        consentLanguage: typeof consentLanguage === "string" ? consentLanguage : "en",
        termsVersion: typeof termsVersion === "string" ? termsVersion : "2026-06-01",
        privacyPolicyVersion: typeof privacyPolicyVersion === "string" ? privacyPolicyVersion : "2026-06-01",
        conflictCheck: conflictCheck || null,
        applicationStatus: "submitted",
        lastActivityAt: new Date(),
      } as any;

      let projectExpert = existingProjectExperts[0];
      if (projectExpert) {
        projectExpert = await storage.updateProjectExpert(projectExpert.id, projectExpertData) || projectExpert;
      } else {
        projectExpert = await storage.createProjectExpert(projectExpertData);
      }

      await db.update(expertInvitationLinks)
        .set({ status: "onboarded", expertId: expert.id, usedAt: new Date(), updatedAt: new Date() })
        .where(eq(expertInvitationLinks.token, token));

      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: expert.id,
        activityType: "expert_application_submitted",
        description: `Expert ${expert.name} submitted onboarding application`,
      });

      res.json({
        success: true,
        expertId: expert.id,
        projectExpertId: projectExpert.id,
        message: "Onboarding application submitted",
      });
    } catch (error) {
      console.error("Error during onboarding:", error);
      res.status(500).json({ error: "Failed to save profile" });
    }
  });

  // PUBLIC: Fetch decision page data
  app.get("/api/quick-invite/:token/decision", async (req, res) => {
    try {
      const { token } = req.params;
      
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "onboarded" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);

      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
        },
        vettingQuestions: vettingQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          isRequired: q.isRequired,
        })),
      });
    } catch (error) {
      console.error("Error fetching decision data:", error);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  });

  // PUBLIC: Submit decision (Accept/Decline)
  app.post("/api/quick-invite/:token/decide", async (req, res) => {
    try {
      const { token } = req.params;
      const { decision, sampleAnswers } = req.body;

      if (!["accepted", "declined"].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision" });
      }

      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "onboarded" || !link.isActive) {
        return res.status(404).json({ error: "This invitation has already been completed or is no longer valid" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      // Get expert by email from link candidate data
      let expert = link.candidateEmail ? await storage.getExpertByEmail(link.candidateEmail) : null;
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }

      // Create or update project expert with final status
      const existingProjectExperts = await db.select()
        .from(projectExperts)
        .where(
          and(
            eq(projectExperts.projectId, link.projectId),
            eq(projectExperts.expertId, expert.id)
          )
        )
        .limit(1);
      
      let projectExpert = existingProjectExperts[0];

      const finalStatus = decision === "accepted" ? "interested" : "declined";
      const finalPipelineStatus = decision === "accepted" ? "interested" : "declined";

      if (!projectExpert) {
        projectExpert = await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: expert.id,
          status: finalStatus,
          sourceType: "quick_invite",
          sourcedByRaId: link.raId,
          pipelineStatus: finalPipelineStatus,
        });
      } else {
        await storage.updateProjectExpert(projectExpert.id, {
          status: finalStatus,
          pipelineStatus: finalPipelineStatus,
        });
      }

      // Store sample answers if accepted
      if (decision === "accepted" && sampleAnswers && Object.keys(sampleAnswers).length > 0) {
        for (const [questionId, answer] of Object.entries(sampleAnswers)) {
          if (answer && (answer as string).trim()) {
            await storage.createProjectActivity({
              projectId: link.projectId,
              expertId: expert.id,
              activityType: "vq_answered",
              description: `Expert provided sample answer to question ${questionId}`,
            });
          }
        }
      }

      // Update invitation link status
      await db.update(expertInvitationLinks)
        .set({ status: decision === "accepted" ? "accepted" : "declined" })
        .where(eq(expertInvitationLinks.token, token));

      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: expert.id,
        activityType: decision === "accepted" ? "expert_accepted" : "expert_declined",
        description: `Expert ${decision === "accepted" ? "accepted" : "declined"} invitation to project`,
      });

      res.json({
        success: true,
        decision,
        message: decision === "accepted" ? "Welcome to the project!" : "Decision noted",
      });
    } catch (error) {
      console.error("Error submitting decision:", error);
      res.status(500).json({ error: "Failed to submit decision" });
    }
  });

  // Quick invite - generate invite link with minimal info (just name + one contact method)
  app.post("/api/projects/:projectId/quick-invite", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;
      const { candidateName, linkedinUrl, email, phoneNumber } = req.body;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!candidateName) {
        return res.status(400).json({ error: "Candidate name is required" });
      }

      // Determine candidate contact (prefer email, then phone, then linkedin)
      const candidateContact = email || phoneNumber || linkedinUrl || null;

      // Generate unique invite token
      const token = generateRecruitmentToken();
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        inviteType: "quick",
        candidateName,
        candidateEmail: email || null,
        status: "pending_onboarding",
        recruitedBy: user?.email || "system",
        raId: user?.role === "ra" || user?.role === "Research Associate" ? user.id : null,
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        activityType: "quick_invite_created",
        description: `Generated quick invite link for ${candidateName} (Contact: ${candidateContact})`,
      });

      const inviteUrl = buildPublicRecruitmentUrl(token, req as AuthRequest);
      res.status(201).json({
        link,
        inviteUrl,
        token,
        message: "Quick invite link generated successfully",
      });
    } catch (error) {
      console.error("Error generating quick invite:", error);
      res.status(500).json({ error: "Failed to generate quick invite link" });
    }
  });

  // Generate existing expert project invite link (always creates a NEW unique token)
  app.post("/api/projects/:projectId/experts/:expertId/invite-link", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const expertId = parseInt(req.params.expertId);
      const { angleIds } = req.body; // Optional: specific angles to invite for

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const expert = await storage.getExpert(expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }

      // ALWAYS generate a NEW unique token for each invitation
      const token = generateRecruitmentToken();
      const user = (req as any).user;
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        expertId,
        angleIds: angleIds || null,
        inviteType: "existing",
        candidateName: expert.name,
        candidateEmail: expert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update project expert status with angle IDs
      const projectExperts = await storage.getProjectExpertsByProject(projectId);
      const pe = projectExperts.find(p => p.expertId === expertId);
      if (pe) {
        await storage.updateProjectExpert(pe.id, {
          invitationStatus: "invited",
          invitedAt: new Date(),
          invitationToken: token,
          angleIds: angleIds || pe.angleIds,
        });
      }

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        expertId,
        activityType: "expert_invited",
        description: `Invited expert ${expert.name} to project`,
      });

      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/expert/project-invite/${link.token}`;
      res.json({ link, inviteUrl });
    } catch (error) {
      console.error("Error generating expert invite link:", error);
      res.status(500).json({ error: "Failed to generate invite link" });
    }
  });

  // Get project activities
  app.get("/api/projects/:id/activities", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activities = await storage.getProjectActivities(id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Add project activity/note
  app.post("/api/projects/:id/activities", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { activityType, description, metadata } = req.body;
      const user = (req as any).user;

      const activity = await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        activityType: activityType || "note_added",
        description,
        metadata,
      });

      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to add activity" });
    }
  });

  // ==================== EXPERTS ====================
  app.get("/api/experts", authMiddleware, async (req, res) => {
    try {
      const query = req.query.search as string;
      const experts = query
        ? await storage.searchExperts(query)
        : await storage.getExperts();
      res.json(experts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch experts" });
    }
  });

  // Advanced expert search with filters
  app.get("/api/experts/search", authMiddleware, async (req, res) => {
    try {
      const params = {
        query: req.query.q as string | undefined,
        country: req.query.country as string | undefined,
        companyName: req.query.companyName as string | undefined,
        companyScope: req.query.companyScope as "current" | "past" | "any" | undefined,
        currentEmployer: req.query.currentEmployer as string | undefined,
        pastEmployers: req.query.pastEmployers as string | undefined,
        minRate: req.query.minRate ? parseFloat(req.query.minRate as string) : undefined,
        maxRate: req.query.maxRate ? parseFloat(req.query.maxRate as string) : undefined,
        minYearsExperience: req.query.minYearsExperience ? parseInt(req.query.minYearsExperience as string) : undefined,
        maxYearsExperience: req.query.maxYearsExperience ? parseInt(req.query.maxYearsExperience as string) : undefined,
        employmentFromMonth: req.query.employmentFromMonth ? parseInt(req.query.employmentFromMonth as string) : undefined,
        employmentFromYear: req.query.employmentFromYear ? parseInt(req.query.employmentFromYear as string) : undefined,
        employmentToMonth: req.query.employmentToMonth ? parseInt(req.query.employmentToMonth as string) : undefined,
        employmentToYear: req.query.employmentToYear ? parseInt(req.query.employmentToYear as string) : undefined,
        jobTitle: req.query.jobTitle as string | undefined,
        industry: req.query.industry as string | undefined,
        language: req.query.language as string | undefined,
        hasPriorProjects: req.query.hasPriorProjects === 'true',
        minAcceptanceRate: req.query.minAcceptanceRate ? parseInt(req.query.minAcceptanceRate as string) : undefined,
        minHoursWorked: req.query.minHoursWorked ? parseFloat(req.query.minHoursWorked as string) : undefined,
        availableOnly: req.query.availableOnly === 'true',
        excludeProjectId: req.query.excludeProjectId ? parseInt(req.query.excludeProjectId as string) : undefined,
      };
      const experts = await storage.searchExpertsAdvanced(params);
      res.json(experts);
    } catch (error) {
      console.error("Expert search error:", error);
      res.status(500).json({ error: "Failed to search experts" });
    }
  });

  app.get("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expert = await storage.getExpert(id);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert" });
    }
  });

  app.get("/api/experts/:id/consultations", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callRecords = await storage.getCallRecordsByExpert(id);
      res.json(callRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert consultations" });
    }
  });

  app.get("/api/experts/:id/assignments", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignments = await storage.getProjectExpertsByExpert(id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert assignments" });
    }
  });

  app.post("/api/experts", authMiddleware, async (req, res) => {
    try {
      const result = insertExpertSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const expert = await storage.createExpert(result.data);
      res.status(201).json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expert" });
    }
  });

  app.patch("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertExpertSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const expert = await storage.updateExpert(id, result.data);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expert" });
    }
  });

  app.delete("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExpert(id);
      if (!deleted) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expert" });
    }
  });

  app.get("/api/companies", authMiddleware, async (req, res) => {
    try {
      const companies = await storage.getCompanies({
        search: req.query.search as string | undefined,
        country: req.query.country as string | undefined,
        companyType: req.query.companyType as string | undefined,
        status: req.query.status as string | undefined,
        dncStatus: req.query.dncStatus as string | undefined,
        verificationStatus: req.query.verificationStatus as string | undefined,
      });
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Company id is required" });
      }
      const company = await storage.getCompanyDetail(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  const normalizeCompanyAccessRole = (role?: string | null) => {
    const normalized = String(role || "").toLowerCase().trim();
    if (normalized === "administrator") return "admin";
    if (normalized === "chief executive officer") return "ceo";
    if (normalized === "chief operating officer") return "coo";
    if (normalized === "research associate") return "ra";
    if (normalized === "project manager") return "pm";
    return normalized;
  };
  const hasCompanyComplianceAccess = (role?: string | null) =>
    ["admin", "ceo", "coo"].includes(normalizeCompanyAccessRole(role));

  app.post("/api/companies", authMiddleware, requireRoles("admin", "ceo", "coo", "ra"), async (req, res) => {
    try {
      const result = insertCompanySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      if (String(result.data.verificationStatus || "").toLowerCase() === "verified" && !String(result.data.officialWebsite || "").trim()) {
        return res.status(400).json({ error: "Official website is required for verified companies" });
      }
      if (
        !hasCompanyComplianceAccess((req as AuthRequest).user?.role) &&
        (
          ["restricted", "dnc"].includes(String(result.data.status || "")) ||
          ["do_not_contact", "consent_required", "legal_hold"].includes(String(result.data.dncStatus || ""))
        )
      ) {
        return res.status(403).json({ error: "Only Admin, CEO, or COO users can set restricted, DNC, consent required, or legal hold statuses." });
      }
      const company = await storage.createCompany(result.data);
      res.status(201).json(company);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create company";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/companies/:id", authMiddleware, requireRoles("admin", "ceo", "coo", "ra"), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Company id is required" });
      }
      const result = insertCompanySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const existing = await storage.getCompany(id);
      if (!existing) {
        return res.status(404).json({ error: "Company not found" });
      }
      const nextVerificationStatus = result.data.verificationStatus ?? existing.verificationStatus;
      const nextOfficialWebsite = result.data.officialWebsite ?? existing.officialWebsite;
      if (String(nextVerificationStatus || "").toLowerCase() === "verified" && !String(nextOfficialWebsite || "").trim()) {
        return res.status(400).json({ error: "Official website is required for verified companies" });
      }

      const complianceChanging =
        (result.data.status !== undefined && result.data.status !== existing.status) ||
        (result.data.dncStatus !== undefined && result.data.dncStatus !== existing.dncStatus);
      if (complianceChanging && !hasCompanyComplianceAccess(req.user?.role)) {
        return res.status(403).json({ error: "Only Admin, CEO, or COO users can update restricted, DNC, consent required, or legal hold statuses." });
      }

      const company = await storage.updateCompany(id, result.data);
      res.json(company);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update company";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/experts/:id/company-review", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const review = await storage.getExpertCompanyReview(id);
      if (!review) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(review);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company review" });
    }
  });

  app.post("/api/experts/:id/work-history/:index/link-company", authMiddleware, requireRoles("admin", "ceo", "coo", "ra"), async (req: AuthRequest, res) => {
    try {
      const expertId = parseInt(req.params.id);
      const workHistoryIndex = parseInt(req.params.index);
      const companyId = Number(req.body?.companyId);
      if (!Number.isInteger(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "Company id is required" });
      }
      const expert = await storage.linkExpertWorkHistoryCompany(expertId, workHistoryIndex, companyId, req.user!.id);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to link company";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/experts/:id/work-history/:index/create-company", authMiddleware, requireRoles("admin", "ceo", "coo", "ra"), async (req: AuthRequest, res) => {
    try {
      const expertId = parseInt(req.params.id);
      const workHistoryIndex = parseInt(req.params.index);
      const result = insertCompanySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      if (String(result.data.verificationStatus || "").toLowerCase() === "verified" && !String(result.data.officialWebsite || "").trim()) {
        return res.status(400).json({ error: "Official website is required for verified companies" });
      }
      const linked = await storage.createCompanyAndLinkExpertWorkHistory(
        expertId,
        workHistoryIndex,
        { ...result.data, alias: String(req.body?.alias || "").trim() || undefined },
        req.user!.id
      );
      if (!linked) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.status(201).json(linked);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create and link company";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/experts/:id/work-history/:index/company-status", authMiddleware, requireRoles("admin", "ceo", "coo", "ra"), async (req: AuthRequest, res) => {
    try {
      const expertId = parseInt(req.params.id);
      const workHistoryIndex = parseInt(req.params.index);
      const status = String(req.body?.status || "");
      if (status !== "unclear" && status !== "ignored") {
        return res.status(400).json({ error: "Status must be unclear or ignored" });
      }
      const expert = await storage.updateExpertWorkHistoryCompanyStatus(expertId, workHistoryIndex, status, req.user!.id);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update company review status";
      res.status(400).json({ error: message });
    }
  });

  // ==================== PROJECT ANGLES ====================
  app.get("/api/projects/:projectId/angles", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const angles = await storage.getProjectAngles(projectId);
      res.json(angles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project angles" });
    }
  });

  app.get("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const angle = await storage.getProjectAngle(id);
      if (!angle) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch angle" });
    }
  });

  app.post("/api/projects/:projectId/angles", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const result = insertProjectAngleSchema.safeParse({
        ...req.body,
        projectId,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const angle = await storage.createProjectAngle(result.data);
      res.status(201).json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to create angle" });
    }
  });

  app.patch("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectAngleSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const angle = await storage.updateProjectAngle(id, result.data);
      if (!angle) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to update angle" });
    }
  });

  app.delete("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Also delete VQs for this angle
      await storage.deleteVettingQuestionsByAngle(id);
      const deleted = await storage.deleteProjectAngle(id);
      if (!deleted) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete angle" });
    }
  });

  app.post("/api/projects/:projectId/angles/reorder", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { angleIds } = req.body;
      if (!Array.isArray(angleIds)) {
        return res.status(400).json({ error: "angleIds must be an array" });
      }
      const angles = await storage.reorderProjectAngles(projectId, angleIds);
      res.json(angles);
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder angles" });
    }
  });

  // Get VQs by angle
  app.get("/api/angles/:angleId/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const angleId = parseInt(req.params.angleId);
      const questions = await storage.getVettingQuestionsByAngle(angleId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vetting questions for angle" });
    }
  });

  // ==================== VETTING QUESTIONS ====================
  app.get("/api/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const angleId = req.query.angleId ? parseInt(req.query.angleId as string) : null;
      
      let questions;
      if (angleId) {
        questions = await storage.getVettingQuestionsByAngle(angleId);
      } else if (projectId) {
        questions = await storage.getVettingQuestionsByProject(projectId);
      } else {
        questions = await storage.getVettingQuestions();
      }
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vetting questions" });
    }
  });

  app.post("/api/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const result = insertVettingQuestionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const question = await storage.createVettingQuestion(result.data);
      res.status(201).json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vetting question" });
    }
  });

  app.patch("/api/vetting-questions/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertVettingQuestionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const question = await storage.updateVettingQuestion(id, result.data);
      if (!question) {
        return res.status(404).json({ error: "Vetting question not found" });
      }
      res.json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vetting question" });
    }
  });

  app.delete("/api/vetting-questions/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVettingQuestion(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vetting question not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vetting question" });
    }
  });

  // ==================== PROJECT EXPERTS ====================
  app.get("/api/project-experts", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const assignments = projectId
        ? await storage.getProjectExpertsByProject(projectId)
        : await storage.getProjectExperts();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project experts" });
    }
  });

  app.get("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getProjectExpert(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  app.post("/api/project-experts", authMiddleware, async (req, res) => {
    try {
      const result = insertProjectExpertSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const assignment = await storage.createProjectExpert(result.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign expert to project" });
    }
  });

  app.patch("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectExpertSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const assignment = await storage.updateProjectExpert(id, result.data);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // Mark an existing project advisor as invited internally.
  // This intentionally does not send email; provider integration can attach here later.
  app.post("/api/project-experts/:id/mark-invited", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const existingAssignment = await storage.getProjectExpert(id);

      if (!existingAssignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const now = new Date();
      const assignment = await storage.updateProjectExpert(id, {
        status: "invited",
        invitationStatus: "invited",
        pipelineStatus: existingAssignment.pipelineStatus || "interested",
        invitedAt: existingAssignment.invitedAt || now,
        lastActivityAt: now,
      });

      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      await storage.createProjectActivity({
        projectId: assignment.projectId,
        expertId: assignment.expertId,
        userId: user?.id,
        activityType: "expert_invite_status_updated",
        description: "Advisor marked as invited internally. No email was sent.",
        metadata: {
          emailSent: false,
          futureIntegrationPoint: "Attach Zoho Mail delivery here after miraeconnext.com SPF/DKIM/DMARC setup.",
        },
      });

      res.json({
        assignment,
        emailSent: false,
        message: "Advisor marked as invited internally. No email was sent.",
      });
    } catch (error) {
      console.error("Failed to mark advisor invited:", error);
      res.status(500).json({ error: "Failed to update advisor invite status" });
    }
  });

  // Send invitation to expert (always creates a NEW unique token)
  app.post("/api/project-experts/:id/invite", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get assignment, expert, and project data
      const assignment = await storage.getProjectExpert(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const expert = await storage.getExpert(assignment.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      const project = await storage.getProject(assignment.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for this project
      const vqs = await storage.getVettingQuestionsByProject(assignment.projectId);
      
      // ALWAYS create a NEW unique token for each invitation
      const token = generateRecruitmentToken();
      const user = (req as any).user;
      const link = await storage.createExpertInvitationLink({
        token,
        projectId: assignment.projectId,
        expertId: assignment.expertId,
        angleIds: assignment.angleIds,
        inviteType: "existing",
        candidateName: expert.name,
        candidateEmail: expert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
      const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
      
      // Send email
      await sendExpertInvitationEmail({
        expertName: expert.name,
        expertEmail: expert.email,
        projectName: project.name,
        clientName: project.clientName,
        industry: project.industry,
        invitationUrl,
        vettingQuestionsCount: vqs.length,
      });
      
      // Update status to invited
      const updatedAssignment = await storage.updateProjectExpert(id, {
        status: "invited",
        invitationStatus: "invited",
        invitedAt: new Date(),
        invitationToken: link.token,
      });
      
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Failed to send invitation:", error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // Expert accepts invitation
  app.post("/api/project-experts/:id/accept", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { vqAnswers, availabilityNote } = req.body;
      const assignment = await storage.updateProjectExpert(id, {
        status: "accepted",
        respondedAt: new Date(),
        vqAnswers,
        availabilityNote,
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Expert declines invitation
  app.post("/api/project-experts/:id/decline", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.updateProjectExpert(id, {
        status: "declined",
        respondedAt: new Date(),
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  });

  // Client selects expert
  app.post("/api/project-experts/:id/select", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.updateProjectExpert(id, {
        status: "client_selected",
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to select expert" });
    }
  });

  app.delete("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProjectExpert(id);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove expert from project" });
    }
  });

  // Bulk attach experts to project
  app.post("/api/projects/:projectId/experts/bulk", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { expertIds } = req.body;
      
      if (!Array.isArray(expertIds) || expertIds.length === 0) {
        return res.status(400).json({ error: "expertIds must be a non-empty array" });
      }
      
      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get existing assignments to avoid duplicates
      const existingAssignments = await storage.getProjectExpertsByProject(projectId);
      const existingExpertIds = new Set(existingAssignments.map(a => a.expertId));
      
      // Filter out already assigned experts
      const newExpertIds = expertIds.filter((id: number) => !existingExpertIds.has(id));
      
      if (newExpertIds.length === 0) {
        return res.status(200).json({ 
          message: "All experts are already assigned to this project",
          assignments: [] 
        });
      }
      
      const assignments = await storage.createProjectExpertsBulk(
        newExpertIds.map((expertId: number) => ({
          projectId,
          expertId,
          status: "assigned",
          sourceType: "internal_db",
        }))
      );
      
      res.status(201).json({ 
        message: `${assignments.length} experts attached to project`,
        assignments 
      });
    } catch (error) {
      console.error("Bulk attach error:", error);
      res.status(500).json({ error: "Failed to attach experts to project" });
    }
  });

  // Send bulk invitations with angle selection
  app.post("/api/projects/:projectId/invitations/bulk-send", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { projectExpertIds, angleIds, channel } = req.body; // angleIds: array of angle IDs to assign (OPTIONAL)

      if (!Array.isArray(projectExpertIds) || projectExpertIds.length === 0) {
        return res.status(400).json({ error: "projectExpertIds must be a non-empty array" });
      }
      
      // Angles are OPTIONAL - allow empty arrays
      if (angleIds && !Array.isArray(angleIds)) {
        return res.status(400).json({ error: "angleIds must be an array" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for the project
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectId);
      
      const results = [];
      
      // Process each expert directly (don't use internal fetch)
      for (const peId of projectExpertIds) {
        try {
          const pe = await storage.getProjectExpert(peId);
          if (!pe || pe.projectId !== projectId) continue;
          
          const expert = await storage.getExpert(pe.expertId);
          if (!expert) continue;

          // Determine angles to use: use provided angleIds if given and non-empty, otherwise use existing
          const finalAngleIds = angleIds && angleIds.length > 0 ? angleIds : pe.angleIds;
          
          // ALWAYS create a NEW unique token for each invitation
          const token = generateRecruitmentToken();
          const link = await storage.createExpertInvitationLink({
            token,
            projectId,
            expertId: expert.id,
            angleIds: finalAngleIds,
            inviteType: "existing",
            candidateName: expert.name,
            candidateEmail: expert.email || null,
            status: "pending",
            recruitedBy: "system",
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          
          // Generate invitation URL
          const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
          const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
          
          // Send email invitation
          let emailSent = false;
          if (channel === 'email' || channel === 'both' || !channel) {
            try {
              emailSent = await sendExpertInvitationEmail({
                expertName: expert.name,
                expertEmail: expert.email,
                projectName: project.name,
                clientName: project.clientName || "Client",
                industry: project.industry || undefined,
                invitationUrl,
                vettingQuestionsCount: vettingQuestions.length,
            });
          } catch (emailError) {
              console.error("Failed to send project invitation email:", emailError);
            }
          }
          
          // Update status to invited ONLY AFTER EMAIL IS SENT
          // Include angleIds update if provided and non-empty
          const updateData: any = {
            status: "invited",
            invitationStatus: "invited",
            invitedAt: new Date(),
            invitationToken: link.token,
          };
          
          // Only add angleIds to update if we have values to set
          if (angleIds && angleIds.length > 0) {
            updateData.angleIds = angleIds;
          }
          
          await storage.updateProjectExpert(peId, updateData);
          
          results.push({
            expertId: expert.id,
            expertName: expert.name,
            email: expert.email,
            invitationUrl,
            status: emailSent ? "sent" : "failed",
            emailSent,
          });
        } catch (expertError) {
          console.error("Failed to process project invitation recipient:", expertError);
          // Continue processing other experts even if one fails
        }
      }
      
      const successCount = results.filter(r => r.emailSent).length;
      const failedCount = results.filter(r => !r.emailSent).length;

      // Return 200 with proper summary (success if at least one was sent)
      res.status(200).json({
        message: `Invitations: ${successCount} sent, ${failedCount} failed`,
        channel: channel || 'email',
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failedCount,
        }
      });
    } catch (error) {
      console.error("Failed to send project invitations:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send bulk invitations";
      res.status(500).json({ 
        success: false,
        error: "Failed to send bulk invitations",
        details: errorMessage,
        message: errorMessage
      });
    }
  });

  // Send bulk invitations to experts
  app.post("/api/projects/:projectId/invitations/send", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { projectExpertIds, channel } = req.body; // channel: 'email' | 'whatsapp' | 'both'

      if (!Array.isArray(projectExpertIds) || projectExpertIds.length === 0) {
        return res.status(400).json({ error: "projectExpertIds must be a non-empty array" });
      }
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for the project
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectId);
      
      const results = [];
      
      for (const peId of projectExpertIds) {
        const pe = await storage.getProjectExpert(peId);
        if (!pe || pe.projectId !== projectId) continue;
        
        const expert = await storage.getExpert(pe.expertId);
        if (!expert) continue;

        // ALWAYS create a NEW unique token for each invitation
        const token = generateRecruitmentToken();
        const link = await storage.createExpertInvitationLink({
          token,
          projectId,
          expertId: expert.id,
          angleIds: pe.angleIds,
          inviteType: "existing",
          candidateName: expert.name,
          candidateEmail: expert.email || null,
          status: "pending",
          recruitedBy: "system",
          isActive: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        // Update project-expert with token and status
        const updatedPe = await storage.updateProjectExpert(peId, {
          status: "invited",
          invitationStatus: "invited",
          invitedAt: new Date(),
          invitationToken: link.token,
        });
        
        // Generate invitation URL
        const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
        const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
        
        // Send email invitation
        let emailSent = false;
        if (channel === 'email' || channel === 'both' || !channel) {
          try {
            emailSent = await sendExpertInvitationEmail({
              expertName: expert.name,
              expertEmail: expert.email,
              projectName: project.name,
              clientName: project.clientName || "Client",
              industry: project.industry || undefined,
              invitationUrl,
              vettingQuestionsCount: vettingQuestions.length,
            });
          } catch (emailError) {
            console.error("Failed to send project invitation email:", emailError);
          }
        }

        results.push({
          expertId: expert.id,
          expertName: expert.name,
          email: expert.email,
          invitationUrl,
          status: emailSent ? "sent" : "failed",
          emailSent,
        });
      }
      
      const successCount = results.filter(r => r.emailSent).length;
      const failedCount = results.filter(r => !r.emailSent).length;

      res.json({
        message: `Invitations: ${successCount} sent, ${failedCount} failed`,
        channel: channel || 'email',
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failedCount,
        }
      });
    } catch (error) {
      console.error("Failed to send project invitations:", error);
      res.status(500).json({ error: "Failed to send invitations" });
    }
  });

  // ==================== EXPERT INVITATION (PUBLIC) ====================
  // Get invitation details by token (for expert to view project and questions)
  app.get("/api/expert-invite/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Check if already responded
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Get project details
      const project = await storage.getProject(pe.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get expert details
      const expert = await storage.getExpert(pe.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      // Get vetting questions
      const vettingQuestions = await storage.getVettingQuestionsByProject(pe.projectId);
      
      res.json({
        projectExpertId: pe.id,
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        expert: {
          id: expert.id,
          name: expert.name,
          email: expert.email,
        },
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
        })),
        invitedAt: pe.invitedAt,
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // Accept invitation with VQ answers
  app.post("/api/expert-invite/:token/accept", async (req, res) => {
    try {
      const token = req.params.token;
      const { vqAnswers, availabilityNote } = req.body;
      
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Update project-expert with answers and status
      const updated = await storage.updateProjectExpert(pe.id, {
        status: "accepted",
        respondedAt: new Date(),
        vqAnswers,
        availabilityNote,
      });
      
      res.json({
        message: "Thank you, your response has been recorded.",
        status: "accepted",
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Decline invitation
  app.post("/api/expert-invite/:token/decline", async (req, res) => {
    try {
      const token = req.params.token;
      const { reason } = req.body;
      
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Update project-expert with declined status
      const updated = await storage.updateProjectExpert(pe.id, {
        status: "declined",
        respondedAt: new Date(),
        notes: reason || null,
      });
      
      res.json({
        message: "Thank you, your response has been recorded.",
        status: "declined",
      });
    } catch (error) {
      console.error("Decline invitation error:", error);
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  });

  // ==================== CALL RECORDS ====================
  const getConsultationInvitationContext = async (callRecordId: number, user: any) => {
    const [row] = await db
      .select({
        callRecord: callRecords,
        project: projects,
        expert: experts,
        pmName: users.fullName,
        clientOrganizationName: clientOrganizations.name,
      })
      .from(callRecords)
      .innerJoin(projects, eq(callRecords.projectId, projects.id))
      .innerJoin(experts, eq(callRecords.expertId, experts.id))
      .leftJoin(users, eq(callRecords.pmId, users.id))
      .leftJoin(clientOrganizations, eq(projects.clientOrganizationId, clientOrganizations.id))
      .where(eq(callRecords.id, callRecordId));

    if (!row) return null;
    if (!canManageProjectAdvisorInvitations(row.project, user)) {
      throw new Error("consultation_invitation_access_denied");
    }
    return row;
  };

  const buildConsultationInvitationPreview = (context: NonNullable<Awaited<ReturnType<typeof getConsultationInvitationContext>>>, audience: "expert" | "client") => {
    const { callRecord, project, expert, pmName } = context;
    const scheduledAt = callRecord.scheduledStartTime || callRecord.callDate;
    const recipientEmail = audience === "expert" ? normalizeEmailForMatch(expert.email) : normalizeEmailForMatch(project.clientPocEmail);
    const recipientName = audience === "expert" ? expert.name : project.clientPocName;
    const missingFields: string[] = [];

    if (!recipientEmail || !isSingleRecipientEmail(recipientEmail)) {
      missingFields.push(audience === "expert" ? "expert email" : "client contact email");
    }
    if (!scheduledAt) missingFields.push("scheduled date and time");
    if (!callRecord.durationMinutes || callRecord.durationMinutes <= 0) missingFields.push("planned duration");
    if (!callRecord.zoomLink?.trim()) missingFields.push("meeting link");
    if (!["pending", "scheduled"].includes(String(callRecord.status || "").toLowerCase())) {
      missingFields.push("scheduled consultation status");
    }

    const template = buildConsultationInvitationTemplate({
      audience,
      expertName: expert.name,
      expertTitle: expert.jobTitle || expert.expertise || null,
      clientContactName: project.clientPocName || null,
      scheduledAt: scheduledAt || new Date(),
      timezone: callRecord.timezone,
      durationMinutes: callRecord.durationMinutes,
      meetingLink: callRecord.zoomLink || "",
      pmName,
    });

    return {
      audience,
      templateType: template.templateType,
      recipientName: recipientName || null,
      recipientEmail,
      subject: template.subject,
      body: template.body,
      missingFields,
      canSend: missingFields.length === 0,
      consultation: {
        id: callRecord.id,
        projectId: callRecord.projectId,
        projectName: project.name,
        expertName: expert.name,
        clientOrganizationName: context.clientOrganizationName || project.clientName || null,
        scheduledStartTime: callRecord.scheduledStartTime || callRecord.callDate,
        scheduledEndTime: callRecord.scheduledEndTime,
        timezone: callRecord.timezone || "America/Sao_Paulo",
        durationMinutes: callRecord.durationMinutes,
        meetingLink: callRecord.zoomLink || null,
        status: callRecord.status,
        expertInvitationStatus: callRecord.expertInvitationStatus || "not_sent",
        clientInvitationStatus: callRecord.clientInvitationStatus || "not_sent",
      },
    };
  };

  const getZohoSendAccountForUser = async (user: any, senderIdentity: ReturnType<typeof resolveEmailSenderIdentity>) => {
    const config = getZohoOAuthConfig();
    if (!config.isConfigured) {
      return { errorStatus: 503, error: "Zoho OAuth is not configured." } as const;
    }

    const connection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER);
    if (!connection || connection.status !== "connected") {
      return { errorStatus: 403, error: "Connect your Zoho Mail account before sending consultation invitations." } as const;
    }
    if (normalizeEmailForMatch(connection.providerEmail) !== senderIdentity.fromEmail) {
      return { errorStatus: 403, error: "Connected Zoho Mail account does not match your CRM sender identity." } as const;
    }

    const accessToken = await getZohoAccessTokenForConnection(connection, config);
    let accountId = String(connection.providerAccountId || "").trim();
    if (!accountId) {
      const latestConnection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER) || connection;
      const accountsRes = await fetch(`${config.mailApiBaseUrl}/api/accounts`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const accountsPayload: any = await accountsRes.json().catch(() => ({}));
      if (!accountsRes.ok) {
        return { errorStatus: 502, error: "Unable to verify Zoho Mail account before sending." } as const;
      }
      const matchingAccount = extractZohoAccounts(accountsPayload).find(
        (account) => getZohoAccountEmail(account) === senderIdentity.fromEmail
      );
      accountId = getZohoAccountId(matchingAccount);
      if (!accountId) {
        return { errorStatus: 403, error: "Connected Zoho Mail account does not match your CRM sender identity." } as const;
      }
      await storage.upsertUserEmailConnection({
        userId: latestConnection.userId,
        provider: latestConnection.provider || ZOHO_MAIL_PROVIDER,
        providerEmail: senderIdentity.fromEmail,
        providerAccountId: accountId,
        providerUserId: String(matchingAccount?.userId || matchingAccount?.zohoUserId || latestConnection.providerUserId || ""),
        providerOrgId: String(matchingAccount?.organizationId || matchingAccount?.orgId || latestConnection.providerOrgId || ""),
        encryptedRefreshToken: latestConnection.encryptedRefreshToken,
        encryptedAccessToken: latestConnection.encryptedAccessToken,
        accessTokenExpiresAt: latestConnection.accessTokenExpiresAt,
        scopes: latestConnection.scopes || ZOHO_MAIL_SCOPES.join(" "),
        status: "connected",
        lastConnectedAt: latestConnection.lastConnectedAt || new Date(),
        lastValidatedAt: new Date(),
        revokedAt: null,
      });
    }

    return { config, accessToken, accountId } as const;
  };

  app.get("/api/consultations/:id/invitations/:audience/preview", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const callRecordId = Number(req.params.id);
      const audience = String(req.params.audience || "") as "expert" | "client";
      if (!Number.isInteger(callRecordId) || callRecordId <= 0 || !consultationInvitationAudiences.has(audience)) {
        return res.status(400).json({ error: "Invalid consultation invitation preview request." });
      }

      const context = await getConsultationInvitationContext(callRecordId, req.user);
      if (!context) return res.status(404).json({ error: "Consultation not found." });
      res.json(buildConsultationInvitationPreview(context, audience));
    } catch (error: any) {
      if (error?.message === "consultation_invitation_access_denied") {
        return res.status(403).json({ error: "Access denied for this consultation." });
      }
      console.error("Failed to build consultation invitation preview:", error);
      res.status(500).json({ error: "Failed to build consultation invitation preview." });
    }
  });

  app.post("/api/consultations/:id/invitations/:audience/send", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const callRecordId = Number(req.params.id);
      const audience = String(req.params.audience || "") as "expert" | "client";
      if (!Number.isInteger(callRecordId) || callRecordId <= 0 || !consultationInvitationAudiences.has(audience)) {
        return res.status(400).json({ error: "Invalid consultation invitation send request." });
      }

      const forbiddenFields = ["toEmail", "toEmails", "recipients", "cc", "bcc", "attachments"].filter((field) =>
        Object.prototype.hasOwnProperty.call(req.body || {}, field)
      );
      if (forbiddenFields.length > 0) {
        return res.status(400).json({ error: "Consultation invitations do not support arbitrary recipients, CC, BCC, or attachments." });
      }

      const context = await getConsultationInvitationContext(callRecordId, user);
      if (!context) return res.status(404).json({ error: "Consultation not found." });
      const preview = buildConsultationInvitationPreview(context, audience);
      if (!preview.canSend) {
        return res.status(400).json({ error: "Required fields are missing before sending.", missingFields: preview.missingFields });
      }

      const subject = String(req.body?.subject || preview.subject).trim();
      const body = String(req.body?.body || preview.body).trim();
      if (!subject || !body) return res.status(400).json({ error: "Subject and body are required before sending." });
      if (subject.length > 300 || body.length > 20000) return res.status(400).json({ error: "Subject or body is too long to send safely." });

      const senderIdentity = resolveEmailSenderIdentity(user);
      if (!senderIdentity.isValid) {
        return res.status(400).json({
          error: senderIdentity.reason || "Sender identity is not configured for Mirae Connext email sending.",
        });
      }

      const zoho = await getZohoSendAccountForUser(user, senderIdentity);
      if ("error" in zoho) return res.status(zoho.errorStatus).json({ error: zoho.error });

      const senderProfile = await storage.getUser(user.id);
      const signatureSenderName = senderProfile?.fullName || senderIdentity.fromName;
      const signatureSenderEmail = senderProfile?.email || senderIdentity.fromEmail;
      const emailHtml = renderAdvisorEmailHtml({
        body,
        senderName: signatureSenderName,
        senderEmail: signatureSenderEmail,
        signatureName: senderProfile?.signatureName || null,
        jobTitle: senderProfile?.jobTitle || null,
        mobilePhone: senderProfile?.mobilePhone || null,
        logoUrl: buildAdvisorEmailLogoUrl(req),
      });

      const zohoRes = await fetch(`${zoho.config.mailApiBaseUrl}/api/accounts/${encodeURIComponent(zoho.accountId)}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${zoho.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAddress: senderIdentity.fromEmail,
          toAddress: preview.recipientEmail,
          subject,
          content: emailHtml,
          mailFormat: "html",
        }),
      });
      const zohoPayload: any = await zohoRes.json().catch(() => ({}));
      if (!zohoRes.ok) {
        console.warn("[zoho-send-consultation-invitation]", {
          provider: "zoho",
          userId: user.id,
          consultationId: callRecordId,
          audience,
          status: zohoRes.status,
        });
        await storage.updateCallRecord(callRecordId, {
          [audience === "expert" ? "expertInvitationStatus" : "clientInvitationStatus"]: "failed",
        } as any);
        return res.status(502).json({ error: "Zoho Mail could not send the consultation invitation." });
      }

      const sentAt = new Date();
      const providerMessageId = getZohoProviderMessageId(zohoPayload) || null;
      await storage.createConsultationInvitationEmailSend({
        callRecordId,
        projectId: context.callRecord.projectId,
        expertId: context.callRecord.expertId,
        sentByUserId: user.id,
        audience,
        fromEmail: senderIdentity.fromEmail,
        fromName: senderIdentity.fromName || null,
        toEmail: preview.recipientEmail,
        subject,
        body,
        provider: "zoho",
        providerMessageId,
        status: "sent",
        sentAt,
      });

      const previousStatus = audience === "expert"
        ? context.callRecord.expertInvitationStatus
        : context.callRecord.clientInvitationStatus;
      const nextStatus = previousStatus === "sent" || previousStatus === "resent" ? "resent" : "sent";
      await storage.updateCallRecord(callRecordId, audience === "expert"
        ? {
            expertInvitationStatus: nextStatus,
            expertInvitationSentAt: sentAt,
            expertInvitationSentByUserId: user.id,
            expertInvitationRecipientEmails: [preview.recipientEmail],
          }
        : {
            clientInvitationStatus: nextStatus,
            clientInvitationSentAt: sentAt,
            clientInvitationSentByUserId: user.id,
            clientInvitationRecipientEmails: [preview.recipientEmail],
          }
      );

      res.json({
        success: true,
        status: nextStatus,
        audience,
        sentAt,
        provider: "zoho",
        providerMessageId,
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "consultation_invitation_access_denied") {
        return res.status(403).json({ error: "Access denied for this consultation." });
      }
      if (message === "zoho_refresh_token_missing" || message === "zoho_access_token_refresh_failed") {
        return res.status(403).json({ error: "Zoho Mail connection needs to be reconnected before sending." });
      }
      console.error("Failed to send consultation invitation:", error);
      res.status(500).json({ error: "Failed to send consultation invitation." });
    }
  });

  app.get("/api/dashboard/consultation-calendar", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const role = normalizeSourcingRole(user.role);
      const canViewAll = ["admin", "ceo", "coo"].includes(role);
      const canViewOwn = role === "pm";

      if (!canViewAll && !canViewOwn) {
        return res.json({ events: [] });
      }

      const parseDateParam = (value: unknown, endOfDay = false) => {
        if (typeof value !== "string" || !value.trim()) return undefined;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return undefined;
        if (endOfDay) date.setHours(23, 59, 59, 999);
        return date;
      };

      const startDate = parseDateParam(req.query.start);
      const endDate = parseDateParam(req.query.end, true);
      const events = await storage.getConsultationCalendarEvents({
        startDate,
        endDate,
        userId: user.id,
        includeAll: canViewAll,
      });

      res.json({ events });
    } catch (error) {
      console.error("Failed to fetch consultation calendar:", error);
      res.status(500).json({ error: "Failed to fetch consultation calendar" });
    }
  });

  app.get("/api/call-records", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const expertId = req.query.expertId ? parseInt(req.query.expertId as string) : null;
      const user = (req as any).user;
      
      let records;
      if (projectId) {
        records = await storage.getCallRecordsByProject(projectId);
      } else if (expertId) {
        records = await storage.getCallRecordsByExpert(expertId);
      } else {
        records = await storage.getCallRecords();
      }
      
      // Filter by RA's assigned projects if user is RA
      if (user?.role === "ra" || user?.role === "Research Associate") {
        const allProjects = await storage.getProjects();
        const raProjectIds = new Set(
          allProjects
            .filter((p: any) => p.assignedRaId === user.id || (p.assignedRaIds && p.assignedRaIds.includes(user.id)))
            .map((p: any) => p.id)
        );
        records = records.filter((r: any) => raProjectIds.has(r.projectId));
      }
      
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call records" });
    }
  });

  app.get("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getCallRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call record" });
    }
  });

  app.post("/api/call-records", authMiddleware, async (req, res) => {
    try {
      const result = insertCallRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.createCallRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create call record" });
    }
  });

  app.patch("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertCallRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.updateCallRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      if (record.status === "completed") {
        await storage.syncBillableUsageForCallRecord(record.id);
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update call record" });
    }
  });

  // Schedule consultation
  app.post("/api/call-records/:id/schedule", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledStartTime, scheduledEndTime, timezone, zoomLink } = req.body;
      const record = await storage.updateCallRecord(id, {
        status: "scheduled",
        scheduledStartTime: new Date(scheduledStartTime),
        scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : undefined,
        timezone: timezone || "America/Sao_Paulo",
        zoomLink,
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to schedule consultation" });
    }
  });

  // Complete consultation
  app.post("/api/call-records/:id/complete", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { actualDurationMinutes, recordingUrl, notes } = req.body;

      const existingRecord = await storage.getCallRecord(id);
      if (!existingRecord) {
        return res.status(404).json({ error: "Call record not found" });
      }

      const completedDurationMinutes = actualDurationMinutes || existingRecord.durationMinutes;
      const cuUsed = calculateCU(completedDurationMinutes);
      const record = await storage.updateCallRecord(id, {
        status: "completed",
        actualDurationMinutes: completedDurationMinutes,
        durationMinutes: completedDurationMinutes,
        cuUsed: cuUsed.toString(),
        recordingUrl,
        notes,
        completedAt: new Date(),
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      await storage.syncBillableUsageForCallRecord(record.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete consultation" });
    }
  });

  // Cancel consultation
  app.post("/api/call-records/:id/cancel", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const record = await storage.updateCallRecord(id, {
        status: "cancelled",
        notes: reason,
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel consultation" });
    }
  });

  app.delete("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCallRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete call record" });
    }
  });

  // ==================== INSIGHT HUB ====================
  const normalizeInsightRole = (role?: string | null) => String(role || "").trim().toLowerCase();
  const hasInsightManagementAccess = (role?: string | null) =>
    ["admin", "ceo", "coo"].includes(normalizeInsightRole(role));
  const canReviewInsightProject = (user: NonNullable<AuthRequest["user"]>, project: any) =>
    hasInsightManagementAccess(user.role) || (normalizeInsightRole(user.role) === "pm" && project.createdByPmId === user.id);
  const reportQualityPlaceholderPatterns = [
    /requires?\s+pm\s+review(?:\s+before\s+report\s+use)?\.?$/i,
    /requires?\s+pm\s+validation(?:\s+before\s+approval)?\.?$/i,
    /business\s+implication\s+requires?\s+pm\s+review/i,
    /confidence\s+assessment\s+has\s+not\s+been\s+structured\s+yet\.?$/i,
    /has\s+not\s+been\s+structured\s+yet\.?$/i,
    /^pending\s+review\.?$/i,
    /^tbd\.?$/i,
    /^to\s+be\s+completed\.?$/i,
    /^to\s+be\s+determined\.?$/i,
    /^not\s+provided\.?$/i,
    /^not\s+available\.?$/i,
  ];
  const getReportQualityTextIssue = (field: string, value?: string | null) => {
    const normalized = String(value || "").trim();
    if (!normalized) return { field, reason: "Required report-quality field is empty" };

    const matchedPattern = reportQualityPlaceholderPatterns.find((pattern) => pattern.test(normalized));
    if (matchedPattern) {
      return { field, reason: `Contains internal placeholder phrase: ${normalized}` };
    }

    return null;
  };
  const isReportQualityTextComplete = (value?: string | null) => {
    return !getReportQualityTextIssue("field", value);
  };
  const getInsightReportQualityIssues = (insight: Partial<InsertInsight> & Record<string, any>) => {
    const issues: Array<{ field: string; reason: string }> = [];
    const coreObservationIssue = getReportQualityTextIssue("coreObservation", insight.coreObservation || insight.observedTrend);
    const evidenceSummaryIssue = getReportQualityTextIssue("evidenceSummary", insight.evidenceSummary);
    const businessImplicationIssue = getReportQualityTextIssue("businessImplication", insight.businessImplication);
    const confidenceReasonIssue = getReportQualityTextIssue("confidenceReason", insight.confidenceReason);

    if (coreObservationIssue) issues.push(coreObservationIssue);
    if (evidenceSummaryIssue) issues.push(evidenceSummaryIssue);
    if (businessImplicationIssue) issues.push(businessImplicationIssue);
    if (!String(insight.confidenceLevel || "").trim()) issues.push({ field: "confidenceLevel", reason: "Confidence level is required" });
    if (confidenceReasonIssue) issues.push(confidenceReasonIssue);
    if (
      String(insight.confidenceLevel || "").trim().toLowerCase() === "strong" &&
      confidenceReasonIssue
    ) {
      issues.push({ field: "confidenceReason", reason: "Strong confidence requires a meaningful confidence reason" });
    }
    return issues;
  };
  const buildClientQuestionFromProject = async (project: any) => {
    const questions = await storage.getVettingQuestionsByProject(project.id);
    const insightQuestions = questions
      .filter((question) => question.question?.trim())
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((question, index) => `${index + 1}. ${question.question.trim()}`)
      .join("\n");
    return insightQuestions || project.clientRequestNotes || project.projectOverview || project.description || "Client consultation question not recorded.";
  };
  const buildPlaceholderInsightDraft = async (callRecord: any, project: any, userId: number) => {
    const expert = await storage.getExpert(callRecord.expertId);
    const clientOrg = project.clientOrganizationId ? await storage.getClientOrganization(project.clientOrganizationId) : undefined;
    const callDate = new Date(callRecord.completedAt || callRecord.callDate);
    const safeCallDate = Number.isNaN(callDate.getTime()) ? new Date() : callDate;
    const duration = callRecord.actualDurationMinutes || callRecord.durationMinutes || undefined;
    const clientQuestion = await buildClientQuestionFromProject(project);
    const industry = project.industry || expert?.industry || "Market";
    const market = project.name || industry;
    const geography = project.region || expert?.country || "Not specified";
    const expertContext = [
      expert?.jobTitle,
      expert?.industry,
      expert?.yearsOfExperience ? `${expert.yearsOfExperience} years of experience` : null,
    ].filter(Boolean).join(", ") || "consultation expert";
    const pmNotes = callRecord.notes || "PM notes were not provided for this consultation.";
    const insightTitle = `${industry} signal from ${project.name}`;
    const coreObservation = `The completed consultation surfaced a structured ${industry.toLowerCase()} signal for ${market}. ${pmNotes}`;
    const evidenceSummary = `Evidence is based on a ${duration ? `${duration}-minute` : "completed"} expert consultation with a ${expertContext}.`;
    const businessImplication = `This signal should be reviewed for relevance to the client's question and may inform market sizing, competitive positioning, or diligence follow-up.`;

    return {
      projectId: project.id,
      consultationId: `CALL-${callRecord.id}`,
      callRecordId: callRecord.id,
      month: format(safeCallDate, "yyyy-MM"),
      callDate: safeCallDate,
      clientType: clientOrg?.clientType || "Client",
      industry,
      market,
      geography,
      clientQuestion,
      observedTrend: coreObservation,
      keyTags: [industry, geography, "Generated Draft"].filter(Boolean),
      signalStrength: "Emerging",
      companyMentioned: null,
      expertSeniority: expert?.jobTitle || expert?.yearsOfExperience ? `${expert?.jobTitle || "Expert"}${expert?.yearsOfExperience ? `, ${expert.yearsOfExperience} yrs` : ""}` : null,
      callDurationMin: duration,
      recordingLink: callRecord.recordingUrl || null,
      transcriptLink: null,
      pmNotes,
      insightTitle,
      coreObservation,
      evidenceSummary,
      businessImplication,
      signalType: "Market Signal",
      confidenceLevel: "Preliminary",
      confidenceReason: "Deterministic placeholder draft generated from CRM consultation metadata and PM notes. Requires PM validation before approval.",
      recommendedFollowUpQuestions: [
        "Which customer segments are most affected by this signal?",
        "What evidence would strengthen or weaken this observation?",
        "Which follow-up experts should be consulted to validate this pattern?",
      ],
      reportVisibility: "internal",
      reviewStatus: "ai_draft",
      sourceType: "placeholder_generated",
      generatedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      internalNotes: `Generated placeholder draft by user ${userId}. Review before using in any client-facing report.`,
    } as InsertInsight;
  };

  app.get("/api/insights", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const projectIdQuery = req.query.projectId;
      const hasProjectScope = projectIdQuery !== undefined && projectIdQuery !== null && String(projectIdQuery).trim() !== "";
      const projectIdParam = hasProjectScope ? Number(projectIdQuery) : null;

      if (!hasProjectScope) {
        if (!hasInsightManagementAccess(user.role)) {
          return res.status(403).json({ error: "Global Insight Hub access is restricted to admin, CEO, and COO users" });
        }
        const insights = await storage.getInsights();
        return res.json(insights);
      }

      if (!Number.isInteger(projectIdParam) || projectIdParam <= 0) {
        return res.status(400).json({ error: "Invalid projectId" });
      }
      const projectId = projectIdParam as number;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!canReviewInsightProject(user, project)) {
        return res.status(403).json({ error: "Project insight access is restricted to admin and owning PM users" });
      }

      const insights = await storage.getInsightsByProjectId(projectId);
      return res.json(insights);
    } catch (error) {
      console.error("Failed to fetch insights:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  app.post("/api/insights/generate-draft", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const callRecordId = Number(req.body?.callRecordId);
      if (!Number.isInteger(callRecordId) || callRecordId <= 0) {
        return res.status(400).json({ error: "callRecordId is required" });
      }

      const callRecord = await storage.getCallRecord(callRecordId);
      if (!callRecord) {
        return res.status(404).json({ error: "Call record not found" });
      }
      if (callRecord.status !== "completed") {
        return res.status(400).json({ error: "Insight drafts can only be generated from completed consultations" });
      }

      const project = await storage.getProject(callRecord.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (!canReviewInsightProject(user, project)) {
        return res.status(403).json({ error: "Access denied for this project" });
      }

      const existingInsight = await storage.getInsightByCallRecordId(callRecordId);
      if (existingInsight) {
        return res.status(409).json({ error: "An insight already exists for this call record" });
      }

      const draft = await buildPlaceholderInsightDraft(callRecord, project, user.id);
      const insight = await storage.createInsight(draft);
      res.status(201).json(insight);
    } catch (error) {
      console.error("Failed to generate insight draft:", error);
      res.status(500).json({ error: "Failed to generate insight draft" });
    }
  });

  app.get("/api/insights/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const insight = await storage.getInsight(id);
      if (!insight) {
        return res.status(404).json({ error: "Insight not found" });
      }
      const project = insight.projectId
        ? await storage.getProject(insight.projectId)
        : insight.callRecordId
          ? await storage.getCallRecord(insight.callRecordId).then((call) => call ? storage.getProject(call.projectId) : undefined)
          : undefined;
      if (project && !canReviewInsightProject(req.user!, project)) {
        return res.status(403).json({ error: "Access denied for this insight" });
      }
      res.json(insight);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch insight" });
    }
  });

  app.post("/api/insights", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      if (!hasInsightManagementAccess(user.role) && normalizeInsightRole(user.role) !== "pm") {
        return res.status(403).json({ error: "Insight creation is restricted to admin and PM users" });
      }

      const result = insertInsightSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      if (["approved", "published"].includes(String(result.data.reviewStatus || "").trim())) {
        const qualityIssues = getInsightReportQualityIssues(result.data as any);
        if (qualityIssues.length > 0) {
          return res.status(400).json({
            error: "This insight needs a completed business implication, evidence summary, and confidence reason before it can be approved.",
            qualityIssues,
          });
        }
      }

      const callRecordId = result.data.callRecordId;
      if (!callRecordId) {
        if (hasInsightManagementAccess(user.role)) {
          const insight = await storage.createInsight({
            ...result.data,
            sourceType: result.data.sourceType || "manual",
            reviewStatus: result.data.reviewStatus || "pm_reviewed",
            reviewedBy: result.data.reviewedBy || user.id,
            reviewedAt: result.data.reviewedAt || new Date(),
          } as InsertInsight);
          return res.status(201).json(insight);
        }
        return res.status(400).json({ error: "callRecordId is required to create a project insight" });
      }

      const callRecord = await storage.getCallRecord(callRecordId);
      if (!callRecord) {
        return res.status(404).json({ error: "Call record not found" });
      }

      if (callRecord.status !== "completed") {
        return res.status(400).json({ error: "Insights can only be created from completed calls" });
      }

      const project = await storage.getProject(callRecord.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!canReviewInsightProject(user, project)) {
        return res.status(403).json({ error: "Access denied for this project" });
      }

      const existingInsight = await storage.getInsightByCallRecordId(callRecordId);
      if (existingInsight) {
        return res.status(409).json({ error: "An insight already exists for this call record" });
      }

      const insight = await storage.createInsight({
        ...result.data,
        projectId: result.data.projectId || project.id,
        sourceType: result.data.sourceType || "manual",
        reviewStatus: result.data.reviewStatus || "pm_reviewed",
        reviewedBy: result.data.reviewedBy || user.id,
        reviewedAt: result.data.reviewedAt || new Date(),
      } as InsertInsight);
      res.status(201).json(insight);
    } catch (error) {
      console.error("Failed to create insight:", error);
      res.status(500).json({ error: "Failed to create insight" });
    }
  });

  app.patch("/api/insights/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      const existingInsight = await storage.getInsight(id);
      if (!existingInsight) {
        return res.status(404).json({ error: "Insight not found" });
      }

      const project = existingInsight.projectId
        ? await storage.getProject(existingInsight.projectId)
        : existingInsight.callRecordId
          ? await storage.getCallRecord(existingInsight.callRecordId).then((call) => call ? storage.getProject(call.projectId) : undefined)
          : undefined;
      if (project && !canReviewInsightProject(user, project)) {
        return res.status(403).json({ error: "Access denied for this insight" });
      }
      if (!project && !hasInsightManagementAccess(user.role)) {
        return res.status(403).json({ error: "Only management users can edit global insights" });
      }

      const result = insertInsightSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const nextReviewStatus = String(result.data.reviewStatus || existingInsight.reviewStatus || "").trim();
      const reviewStatusIsChanging = Object.prototype.hasOwnProperty.call(result.data, "reviewStatus");
      const existingQualityIssues = getInsightReportQualityIssues(existingInsight);
      const candidateInsight = { ...existingInsight, ...result.data } as any;
      const candidateQualityIssues = getInsightReportQualityIssues(candidateInsight);

      if (reviewStatusIsChanging && ["approved", "published"].includes(nextReviewStatus) && candidateQualityIssues.length > 0) {
        return res.status(400).json({
          error: "This insight needs a completed business implication, evidence summary, and confidence reason before it can be approved.",
          qualityIssues: candidateQualityIssues,
        });
      }

      if (
        !reviewStatusIsChanging &&
        ["approved", "published"].includes(String(existingInsight.reviewStatus || "").trim()) &&
        existingQualityIssues.length === 0 &&
        candidateQualityIssues.length > 0
      ) {
        return res.status(400).json({
          error: "This edit would remove report-quality fields from an approved insight. Move it back to PM Reviewed before saving incomplete report content.",
          qualityIssues: candidateQualityIssues,
        });
      }

      const updatedInsight = await storage.updateInsight(id, result.data);
      res.json(updatedInsight);
    } catch (error) {
      console.error("Failed to update insight:", error);
      res.status(500).json({ error: "Failed to update insight" });
    }
  });

  app.post("/api/insights/:id/review", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      const nextStatus = String(req.body?.reviewStatus || "").trim();
      if (!["pm_reviewed", "approved", "rejected", "published"].includes(nextStatus)) {
        return res.status(400).json({ error: "Invalid review status" });
      }

      const existingInsight = await storage.getInsight(id);
      if (!existingInsight) {
        return res.status(404).json({ error: "Insight not found" });
      }

      const project = existingInsight.projectId
        ? await storage.getProject(existingInsight.projectId)
        : existingInsight.callRecordId
          ? await storage.getCallRecord(existingInsight.callRecordId).then((call) => call ? storage.getProject(call.projectId) : undefined)
          : undefined;
      if (nextStatus === "approved" || nextStatus === "published") {
        if (!hasInsightManagementAccess(user.role)) {
          return res.status(403).json({ error: "Only admin, CEO, and COO users can approve or publish insights" });
        }
        const qualityIssues = getInsightReportQualityIssues(existingInsight);
        if (qualityIssues.length > 0) {
          return res.status(400).json({
            error: "This insight needs a completed business implication, evidence summary, and confidence reason before it can be approved.",
            qualityIssues,
          });
        }
      } else if (project && !canReviewInsightProject(user, project)) {
        return res.status(403).json({ error: "Access denied for this insight" });
      } else if (!project && !hasInsightManagementAccess(user.role)) {
        return res.status(403).json({ error: "Only management users can review global insights" });
      }

      const updates: Partial<InsertInsight> = {
        reviewStatus: nextStatus,
        internalNotes: req.body?.internalNotes ?? existingInsight.internalNotes ?? undefined,
      };
      if (nextStatus === "pm_reviewed" || nextStatus === "rejected") {
        updates.reviewedBy = user.id;
        updates.reviewedAt = new Date();
      }
      if (nextStatus === "approved" || nextStatus === "published") {
        updates.approvedBy = user.id;
        updates.approvedAt = new Date();
      }

      const updatedInsight = await storage.updateInsight(id, updates);
      res.json(updatedInsight);
    } catch (error) {
      console.error("Failed to update insight review status:", error);
      res.status(500).json({ error: "Failed to update insight review status" });
    }
  });

  // ==================== EXPERT INVITATION LINKS ====================
  // List all invites (with optional filters)
  app.get("/api/invitation-links", authMiddleware, async (req, res) => {
    try {
      const links = await storage.getExpertInvitationLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation links" });
    }
  });

  // List invites by project (with role-based access control)
  app.get("/api/projects/:projectId/invites", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;
      
      // RAs can only see invites for projects they're assigned to
      if (user.role === "ra" || user.role === "Research Associate") {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        const hasAccess = raHasProjectAccess(project, user.id);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - not assigned to this project" });
        }
      }
      
      const links = await storage.getExpertInvitationLinksByProject(projectId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project invites" });
    }
  });

  // List invites by RA (with role-based access control)
  app.get("/api/ras/:raId/invites", authMiddleware, async (req, res) => {
    try {
      const raId = parseInt(req.params.raId);
      const user = (req as any).user;
      
      // RAs can only see their own invites
      if ((user.role === "ra" || user.role === "Research Associate") && user.id !== raId) {
        return res.status(403).json({ error: "Access denied - can only view your own invites" });
      }
      
      const links = await storage.getExpertInvitationLinksByRa(raId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RA invites" });
    }
  });

  app.get("/api/invitation-links/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }
      res.json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation link" });
    }
  });

  app.post("/api/invitation-links", authMiddleware, async (req, res) => {
    try {
      const token = generateRecruitmentToken();
      const result = insertExpertInvitationLinkSchema.safeParse({
        ...req.body,
        token,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const link = await storage.createExpertInvitationLink(result.data);
      res.status(201).json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invitation link" });
    }
  });

  // Register expert via invitation link
  app.post("/api/register-expert/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }

      const expertData = {
        ...req.body,
        recruitedBy: link.recruitedBy,
      };

      const result = insertExpertSchema.safeParse(expertData);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const expert = await storage.createExpert(result.data);
      await storage.markInvitationLinkUsed(token, expert.id, "onboarded");

      // If link is for a specific project, auto-assign expert
      if (link.projectId) {
        await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: expert.id,
          status: "assigned",
        });
      }

      res.status(201).json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // ==================== EXPERT ONBOARDING (NEW FLOW) ====================
  // GET /api/invite/:projectId/:inviteType/:token - Validate invitation and get project/vetting questions
  app.get("/api/invite/:projectId/:inviteType/:token", async (req, res) => {
    try {
      const { projectId, inviteType, token } = req.params;
      const projectIdNum = parseInt(projectId);
      
      // Validate the invitation link
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }
      
      // Verify project ID matches
      if (link.projectId !== projectIdNum) {
        return res.status(400).json({ error: "Invalid invitation link for this project" });
      }
      
      // Get project details
      const project = await storage.getProject(projectIdNum);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectIdNum);
      
      // Get sourcing owner information when the invite was created by an eligible employee.
      let recruitedByRaId: number | null = null;
      if (link.recruitedBy) {
        const sourcingUser = await storage.getUserByEmail(link.recruitedBy);
        if (sourcingUser && canOwnSourcingAttribution(sourcingUser.role)) {
          recruitedByRaId = sourcingUser.id;
        }
      }
      
      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
        })),
        recruitedBy: link.recruitedBy,
        recruitedByRaId,
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // POST /api/invite/:projectId/:inviteType/:token/submit - Submit expert registration
  app.post("/api/invite/:projectId/:inviteType/:token/submit", async (req, res) => {
    try {
      const { projectId, inviteType, token } = req.params;
      const projectIdNum = parseInt(projectId);
      
      // Validate the invitation link again
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }
      if (link.projectId !== projectIdNum) {
        return res.status(400).json({ error: "Invalid invitation link for this project" });
      }
      
      const {
        email,
        password,
        firstName,
        lastName,
        country,
        region,
        countryCode,
        phoneNumber,
        linkedinUrl,
        city,
        canConsultInEnglish,
        timezone,
        experiences,
        biography,
        workHistory,
        hourlyRate,
        currency,
        vqAnswers,
      } = req.body;
      
      // Check if expert with email already exists
      const existingExpert = await storage.getExpertByEmail(email);
      if (existingExpert) {
        return res.status(400).json({ error: "An expert with this email already exists" });
      }
      
      // Hash password for expert login (future use)
      const passwordHash = await hashPassword(password);
      
      // Track the employee who directly sourced this expert.
      let sourcedByRaId: number | null = null;
      if (link.recruitedBy) {
        const sourcingUser = await storage.getUserByEmail(link.recruitedBy);
        if (sourcingUser && canOwnSourcingAttribution(sourcingUser.role)) {
          sourcedByRaId = sourcingUser.id;
        }
      }
      
      // Format phone number
      const fullPhone = `${countryCode} ${phoneNumber}`.trim();
      
      // Format experience for bio/company/job title
      const currentExperience = experiences.find((e: any) => e.isCurrent) || experiences[0];
      const experienceText = experiences.map((e: any) => {
        const period = e.isCurrent 
          ? `${e.fromMonth}/${e.fromYear} - Present`
          : `${e.fromMonth}/${e.fromYear} - ${e.toMonth}/${e.toYear}`;
        return `${e.title} at ${e.company} (${period})`;
      }).join("\n");
      
      // Calculate years of experience from earliest date
      const earliestYear = Math.min(...experiences.map((e: any) => parseInt(e.fromYear)));
      const currentYear = new Date().getFullYear();
      const yearsOfExperience = currentYear - earliestYear;
      
      // Create expert record with hashed password
      const expertData = {
        name: `${firstName} ${lastName}`,
        email,
        passwordHash,
        phone: fullPhone,
        linkedinUrl: linkedinUrl || null,
        country,
        timezone,
        whatsapp: fullPhone,
        expertise: currentExperience?.title || "Expert",
        areasOfExpertise: [canConsultInEnglish === "yes" ? "English consultations available" : ""],
        industry: "Consulting",
        company: currentExperience?.company || "",
        jobTitle: currentExperience?.title || "",
        yearsOfExperience,
        hourlyRate: hourlyRate,
        bio: `${biography}\n\nWork History:\n${workHistory}\n\nExperience:\n${experienceText}`,
        status: "available" as const,
        recruitedBy: link.recruitedBy,
        sourcedByRaId,
        sourcedAt: new Date(),
        termsAccepted: true,
        lgpdAccepted: true,
        billingInfo: `Currency: ${currency}, Region: ${region || ""}, City: ${city || ""}`,
      };
      
      const result = insertExpertSchema.safeParse(expertData);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      
      const expert = await storage.createExpert(result.data);
      
      // Mark invitation link as used and link it to the created expert
      await storage.markInvitationLinkUsed(token, expert.id, "onboarded");
      
      // Get project for vetting question mapping
      const project = await storage.getProject(projectIdNum);
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectIdNum);
      
      // Format VQ answers for storage
      const formattedVqAnswers = vqAnswers.map((answer: { questionId: number; answer: string }) => {
        const question = vettingQuestions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || "",
          answerText: answer.answer,
        };
      });
      
      // Create project-expert assignment with status "interested"
      await storage.createProjectExpert({
        projectId: projectIdNum,
        expertId: expert.id,
        status: "accepted",
        invitationStatus: "submitted",
        pipelineStatus: "interested",
        sourceType: inviteType === "ra" ? "ra_external" : "quick_invite",
        sourcedByRaId: sourcedByRaId || undefined,
        invitedAt: new Date(),
        respondedAt: new Date(),
        invitationToken: token,
        vqAnswers: formattedVqAnswers,
        applicationStatus: "submitted",
        acceptedAt: new Date(),
        lastActivityAt: new Date(),
        notes: `Self-registered via invitation link. Invite type: ${inviteType}`,
      });
      
      res.status(201).json({ 
        success: true, 
        expertId: expert.id,
        message: "Expert registered successfully" 
      });
    } catch (error) {
      console.error("Expert registration error:", error);
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // ==================== EXISTING EXPERT PROJECT INVITE (Accept/Decline) ====================
  // GET /api/expert/project-invite/:token - Get project invite details for existing expert
  app.get("/api/expert/project-invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find the invitation link
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.inviteType !== "existing") {
        return res.status(400).json({ error: "Invalid invite type" });
      }
      if (!link.isActive) {
        return res.status(400).json({ error: "Invitation link is no longer active" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link has expired" });
      }
      if (!link.projectId || !link.expertId) {
        return res.status(400).json({ error: "Invalid invitation link" });
      }
      
      // Get project details
      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get expert details
      const expert = await storage.getExpert(link.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      // Get vetting questions
      const allVettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);
      
      // Get project angles for context
      const angles = await storage.getProjectAngles(link.projectId);
      
      // Filter VQs based on angleIds if specified in the link
      let vettingQuestions = allVettingQuestions;
      let relevantAngles: typeof angles = [];
      
      if (link.angleIds && link.angleIds.length > 0) {
        // Include VQs that belong to the specified angles or have no angle (general)
        vettingQuestions = allVettingQuestions.filter(q => 
          q.angleId === null || link.angleIds!.includes(q.angleId)
        );
        // Only include relevant angles
        relevantAngles = angles.filter(a => link.angleIds!.includes(a.id));
      } else {
        // No angle filter - include all VQs
        relevantAngles = angles;
      }
      
      // Get project-expert assignment
      const projectExperts = await storage.getProjectExpertsByProject(link.projectId);
      const assignment = projectExperts.find(pe => pe.expertId === link.expertId);
      
      // Update invitation status to "opened" if not already responded
      if (assignment && assignment.invitationStatus !== "accepted" && assignment.invitationStatus !== "declined") {
        await storage.updateProjectExpert(assignment.id, {
          invitationStatus: "opened",
          openedAt: new Date(),
          lastActivityAt: new Date(),
        });
        
        // Log activity
        await storage.createProjectActivity({
          projectId: link.projectId,
          expertId: link.expertId,
          activityType: "expert_opened",
          description: `Expert ${expert.name} opened the project invitation`,
        });
      }
      
      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          clientCompany: project.clientCompany,
          industry: project.industry,
          region: project.region,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        expert: {
          id: expert.id,
          name: expert.name,
          email: expert.email,
        },
        angles: relevantAngles.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
        })),
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
          angleId: q.angleId,
          questionType: q.questionType,
        })),
        currentStatus: assignment?.invitationStatus || "not_invited",
        hasResponded: assignment?.invitationStatus === "accepted" || assignment?.invitationStatus === "declined",
      });
    } catch (error) {
      console.error("Get project invite error:", error);
      res.status(500).json({ error: "Failed to fetch project invite details" });
    }
  });

  // POST /api/expert/project-invite/:token/respond - Expert responds to project invite (Accept/Decline)
  app.post("/api/expert/project-invite/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { response, vqAnswers, availabilityNote } = req.body;
      
      if (!response || (response !== "accept" && response !== "decline")) {
        return res.status(400).json({ error: "Response must be 'accept' or 'decline'" });
      }
      
      // Find the invitation link
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.inviteType !== "existing") {
        return res.status(400).json({ error: "Invalid invite type" });
      }
      if (!link.isActive) {
        return res.status(400).json({ error: "Invitation link is no longer active" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link has expired" });
      }
      if (!link.projectId || !link.expertId) {
        return res.status(400).json({ error: "Invalid invitation link" });
      }
      
      // Get project and expert
      const project = await storage.getProject(link.projectId);
      const expert = await storage.getExpert(link.expertId);
      
      if (!project || !expert) {
        return res.status(404).json({ error: "Project or expert not found" });
      }
      
      // Get vetting questions for formatting answers
      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);
      
      // Format VQ answers
      const formattedVqAnswers = vqAnswers?.map((answer: { questionId: number; answer: string }) => {
        const question = vettingQuestions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || "",
          answerText: answer.answer,
        };
      }) || [];
      
      // Get or create project-expert assignment
      const projectExperts = await storage.getProjectExpertsByProject(link.projectId);
      let assignment = projectExperts.find(pe => pe.expertId === link.expertId);
      
      const newStatus = response === "accept" ? "pending_review" : "declined";
      const newInvitationStatus = response === "accept" ? "submitted" : "declined";
      const newPipelineStatus = response === "accept" ? "pending_review" : "declined";
      const newApplicationStatus = response === "accept" ? "submitted" : "declined";
      
      if (assignment) {
        // Update existing assignment
        await storage.updateProjectExpert(assignment.id, {
          status: newStatus,
          invitationStatus: newInvitationStatus,
          pipelineStatus: newPipelineStatus,
          applicationStatus: newApplicationStatus,
          respondedAt: new Date(),
          lastActivityAt: new Date(),
          vqAnswers: formattedVqAnswers.length > 0 ? formattedVqAnswers : assignment.vqAnswers,
          availabilityNote: availabilityNote || assignment.availabilityNote,
        });
      } else {
        // Create new assignment (shouldn't happen normally, but just in case)
        await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: link.expertId,
          status: newStatus,
          invitationStatus: newInvitationStatus,
          pipelineStatus: newPipelineStatus,
          applicationStatus: newApplicationStatus,
          sourceType: "internal_db",
          invitedAt: link.createdAt,
          respondedAt: new Date(),
          invitationToken: token,
          vqAnswers: formattedVqAnswers,
          availabilityNote,
        });
      }
      
      // Mark invitation link as used and update status in a single coordinated update
      const inviteStatus = response === "accept" ? "accepted" : "declined";
      await storage.updateExpertInvitationLink(link.id, { 
        isActive: false,
        usedAt: new Date(),
        status: inviteStatus,
      } as any);
      
      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: link.expertId,
        activityType: response === "accept" ? "expert_accepted" : "expert_declined",
        description: `Expert ${expert.name} ${response === "accept" ? "accepted" : "declined"} the project invitation`,
        metadata: { response, hasVqAnswers: formattedVqAnswers.length > 0 } as Record<string, any>,
      });
      
      res.json({ 
        success: true, 
        response,
        message: response === "accept" 
          ? "Thank you for accepting! The team will be in touch soon." 
          : "Thank you for your response. We appreciate your time.",
      });
    } catch (error) {
      console.error("Project invite response error:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // ==================== CU LEDGER (READ-ONLY) ====================
  app.get("/api/cu-ledger", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const parseOptionalId = (value: unknown) => {
        if (!value) return undefined;
        const parsed = parseInt(String(value), 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      };
      const parseOptionalDate = (value: unknown, endOfDay = false) => {
        if (!value) return undefined;
        const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
        return Number.isNaN(date.getTime()) ? undefined : date;
      };

      const rows = await storage.getCuLedgerRows({
        startDate: parseOptionalDate(req.query.startDate),
        endDate: parseOptionalDate(req.query.endDate, true),
        projectId: parseOptionalId(req.query.projectId),
        expertId: parseOptionalId(req.query.expertId),
        pmId: parseOptionalId(req.query.pmId),
        raId: parseOptionalId(req.query.raId),
        clientOrganizationId: parseOptionalId(req.query.clientOrganizationId),
      });

      const completedCalls = rows.length;
      const totalCUUsed = rows.reduce((sum, row) => sum + Number(row.cuUsed || 0), 0);
      const totalCompletedMinutes = rows.reduce(
        (sum, row) => sum + (row.actualDurationMinutes || row.durationMinutes || 0),
        0
      );
      const avgCUPerCall = completedCalls > 0 ? totalCUUsed / completedCalls : 0;

      res.json({
        summary: {
          completedCalls,
          totalCUUsed: Math.round(totalCUUsed * 100) / 100,
          totalCompletedMinutes,
          avgCUPerCall: Math.round(avgCUPerCall * 100) / 100,
        },
        rows,
      });
    } catch (error) {
      console.error("Failed to fetch CU ledger:", error);
      res.status(500).json({ error: "Failed to fetch CU ledger" });
    }
  });

  // ==================== BILLABLE USAGE (FINANCE REVIEW) ====================
  app.get("/api/billable-usage", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const parseOptionalId = (value: unknown) => {
        if (!value) return undefined;
        const parsed = parseInt(String(value), 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      };
      const parseOptionalDate = (value: unknown, endOfDay = false) => {
        if (!value) return undefined;
        const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
        return Number.isNaN(date.getTime()) ? undefined : date;
      };

      const report = await storage.getBillableUsage({
        startDate: parseOptionalDate(req.query.startDate),
        endDate: parseOptionalDate(req.query.endDate, true),
        status: req.query.status ? String(req.query.status) : undefined,
        clientOrganizationId: parseOptionalId(req.query.clientOrganizationId),
        projectId: parseOptionalId(req.query.projectId),
      });

      res.json(report);
    } catch (error) {
      console.error("Failed to fetch billable usage:", error);
      res.status(500).json({ error: "Failed to fetch billable usage" });
    }
  });

  app.post("/api/billable-usage/sync", authMiddleware, requireRoles("admin", "finance"), async (_req, res) => {
    try {
      const result = await storage.syncBillableUsageFromCompletedCalls();
      res.status(201).json(result);
    } catch (error) {
      console.error("Failed to sync billable usage:", error);
      res.status(500).json({ error: "Failed to sync billable usage" });
    }
  });

  app.post("/api/billable-usage/refresh-rates", authMiddleware, requireRoles("admin", "finance"), async (_req, res) => {
    try {
      const result = await storage.refreshMissingBillableUsageRates();
      res.json(result);
    } catch (error) {
      console.error("Failed to refresh billable usage rates:", error);
      res.status(500).json({ error: "Failed to refresh billable usage rates" });
    }
  });

  // ==================== EXPERT PAYABLES (FINANCE AP) ====================
  app.get("/api/expert-payables", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const rows = await storage.getExpertPayables({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
      });
      res.json({ rows });
    } catch (error) {
      console.error("Failed to fetch expert payables:", error);
      res.status(500).json({ error: "Failed to fetch expert payables" });
    }
  });

  app.get("/api/expert-payables/eligible-consultations", authMiddleware, requireRoles("admin", "finance"), async (_req, res) => {
    try {
      const rows = await storage.getEligibleExpertPayableConsultations();
      res.json({ rows });
    } catch (error) {
      console.error("Failed to fetch eligible expert payable consultations:", error);
      res.status(500).json({ error: "Failed to fetch eligible consultations" });
    }
  });

  app.post("/api/expert-payables", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const consultationId = Number(req.body?.consultationId);
      if (!Number.isInteger(consultationId) || consultationId <= 0) {
        return res.status(400).json({ error: "Valid consultationId is required." });
      }

      const payable = await storage.createExpertPayableFromConsultation(consultationId, req.user?.id);
      res.status(201).json(payable);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create expert payable";
      console.error("Failed to create expert payable:", error);
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/expert-payables/:id", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid expert payable id." });
      }

      const payable = await storage.getExpertPayableById(id);
      if (!payable) {
        return res.status(404).json({ error: "Expert payable not found." });
      }
      res.json(payable);
    } catch (error) {
      console.error("Failed to fetch expert payable:", error);
      res.status(500).json({ error: "Failed to fetch expert payable" });
    }
  });

  app.post("/api/expert-payables/:id/approve", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid expert payable id." });
      }

      const payable = await storage.approveExpertPayable(id, req.user!.id);
      res.json(payable);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve expert payable";
      console.error("Failed to approve expert payable:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/expert-payables/:id/mark-paid", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid expert payable id." });
      }

      const payable = await storage.markExpertPayablePaid(id, req.user!.id, {
        paymentMethod: req.body?.paymentMethod,
        paymentReferenceNumber: req.body?.paymentReferenceNumber,
        paymentNotes: req.body?.paymentNotes,
      });
      res.json(payable);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark expert payable as paid";
      console.error("Failed to mark expert payable as paid:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/expert-payables/:id/void", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid expert payable id." });
      }

      const payable = await storage.voidExpertPayable(id, req.user!.id, {
        voidReason: req.body?.voidReason,
      });
      res.json(payable);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to void expert payable";
      console.error("Failed to void expert payable:", error);
      res.status(400).json({ error: message });
    }
  });

  const getPaymentDetailsRequestStatus = (request: any) => {
    if (!request) return "not_requested";
    if (request.status === "submitted" || request.submittedAt) return "submitted";
    const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return "expired";
    return request.status === "sent" ? "sent" : "link_generated";
  };

  const getInternalPaymentDetailsRequest = (request: any, authReq: AuthRequest) => {
    const status = getPaymentDetailsRequestStatus(request);
    const canUseLink = request && status !== "expired" && status !== "submitted";
    return {
      id: request?.id || null,
      status,
      hasActiveLink: Boolean(canUseLink),
      magicLink: canUseLink ? buildPublicExpertPaymentDetailsUrl(request.token, authReq) : null,
      expiresAt: request?.expiresAt || null,
      requestedAt: request?.requestedAt || null,
      sentAt: request?.sentAt || null,
      submittedAt: request?.submittedAt || null,
      preferredPaymentMethod: request?.preferredPaymentMethod || null,
      accountHolderName: request?.accountHolderName || null,
      paymentIdentifier: request?.paymentIdentifier || null,
      country: request?.country || null,
      paymentDetails: request?.paymentDetails || null,
      notes: request?.notes || null,
      confirmationAccepted: Boolean(request?.confirmationAccepted),
    };
  };

  const getProjectPaymentDetailsRequest = (request: any, authReq: AuthRequest) => {
    const internal = getInternalPaymentDetailsRequest(request, authReq);
    return {
      id: internal.id,
      status: internal.status,
      hasActiveLink: internal.hasActiveLink,
      magicLink: internal.magicLink,
      expiresAt: internal.expiresAt,
      requestedAt: internal.requestedAt,
      sentAt: internal.sentAt,
      submittedAt: internal.submittedAt,
    };
  };

  const canViewSensitiveExpertPaymentDetails = (user: any) =>
    ["admin", "finance"].includes(String(user?.role || "").toLowerCase());

  const canAccessPayablePaymentDetails = async (payable: any, user: any) => {
    const project = await storage.getProject(payable.projectId);
    return Boolean(project && canManageProjectPaymentDetails(project, user));
  };

  const ensureExpertPaymentDetailsRequest = async (payable: any, userId: number) => {
    if (["paid", "void"].includes(String(payable.status || "").toLowerCase())) {
      throw new Error("Payment details cannot be requested for paid or void payables.");
    }
    const existing = await storage.getExpertPaymentDetailRequestByPayableId(payable.id);
    const existingStatus = getPaymentDetailsRequestStatus(existing);
    if (existingStatus === "submitted") return existing!;
    if (existing && existingStatus !== "expired") return existing;

    const email = normalizeEmailForMatch(payable.expertEmail);
    if (!isSingleRecipientEmail(email)) {
      throw new Error("Expert must have a valid email before requesting payment details.");
    }

    let token = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateExpertPaymentDetailsToken();
      if (!(await storage.getExpertPaymentDetailRequestByToken(candidate))) {
        token = candidate;
        break;
      }
    }
    if (!token) throw new Error("Unable to generate a secure payment details link.");

    const now = new Date();
    return storage.upsertExpertPaymentDetailRequest({
      expertPayableId: payable.id,
      expertId: payable.expertId,
      email,
      token,
      status: "link_generated",
      expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      requestedAt: now,
      requestedByUserId: userId,
      confirmationAccepted: false,
    });
  };

  app.get("/api/projects/:projectId/payment-details-requests", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) return res.status(400).json({ error: "Invalid project id." });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found." });
      if (!canManageProjectPaymentDetails(project, req.user)) return res.status(403).json({ error: "Access denied for this project." });

      const projectPayables = (await storage.getExpertPayables({})).filter((payable) => payable.projectId === projectId);
      const rows = await Promise.all(projectPayables.map(async (payable) => {
        const request = await storage.getExpertPaymentDetailRequestByPayableId(payable.id);
        return {
          consultationId: payable.consultationId,
          payableId: payable.id,
          expertId: payable.expertId,
          payableStatus: payable.status,
          ...getProjectPaymentDetailsRequest(request, req),
        };
      }));
      res.json({ rows });
    } catch (error) {
      console.error("Failed to fetch project payment details request statuses:", error);
      res.status(500).json({ error: "Failed to fetch payment details request statuses." });
    }
  });

  app.get("/api/expert-payables/:id/payment-details-request", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payableId = Number(req.params.id);
      if (!Number.isInteger(payableId) || payableId <= 0) return res.status(400).json({ error: "Invalid expert payable id." });
      const payable = await storage.getExpertPayableById(payableId);
      if (!payable) return res.status(404).json({ error: "Expert payable not found." });
      if (!(await canAccessPayablePaymentDetails(payable, req.user))) return res.status(403).json({ error: "Access denied for this project." });
      const request = await storage.getExpertPaymentDetailRequestByPayableId(payableId);
      res.json(canViewSensitiveExpertPaymentDetails(req.user)
        ? getInternalPaymentDetailsRequest(request, req)
        : getProjectPaymentDetailsRequest(request, req));
    } catch (error) {
      console.error("Failed to fetch expert payment details request:", error);
      res.status(500).json({ error: "Failed to fetch payment details request." });
    }
  });

  app.post("/api/expert-payables/:id/payment-details-request/generate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payableId = Number(req.params.id);
      if (!Number.isInteger(payableId) || payableId <= 0) return res.status(400).json({ error: "Invalid expert payable id." });
      const payable = await storage.getExpertPayableById(payableId);
      if (!payable) return res.status(404).json({ error: "Expert payable not found." });
      if (!(await canAccessPayablePaymentDetails(payable, req.user))) return res.status(403).json({ error: "Access denied for this project." });
      const request = await ensureExpertPaymentDetailsRequest(payable, req.user!.id);
      if (getPaymentDetailsRequestStatus(request) === "submitted") {
        return res.status(409).json({ error: "Payment details have already been submitted." });
      }
      res.json(canViewSensitiveExpertPaymentDetails(req.user)
        ? getInternalPaymentDetailsRequest(request, req)
        : getProjectPaymentDetailsRequest(request, req));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate payment details link.";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/expert-payables/:id/payment-details-request/send", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payableId = Number(req.params.id);
      if (!Number.isInteger(payableId) || payableId <= 0) return res.status(400).json({ error: "Invalid expert payable id." });
      const payable = await storage.getExpertPayableById(payableId);
      if (!payable) return res.status(404).json({ error: "Expert payable not found." });
      if (!(await canAccessPayablePaymentDetails(payable, req.user))) return res.status(403).json({ error: "Access denied for this project." });

      const user = req.user!;
      const senderIdentity = resolveEmailSenderIdentity(user);
      if (!senderIdentity.isValid) return res.status(400).json({ error: senderIdentity.reason });
      const request = await ensureExpertPaymentDetailsRequest(payable, user.id);
      if (getPaymentDetailsRequestStatus(request) === "submitted") {
        return res.status(409).json({ error: "Payment details have already been submitted." });
      }

      const config = getZohoOAuthConfig();
      if (!config.isConfigured) return res.status(503).json({ error: "Zoho OAuth is not configured." });
      const connection = await storage.getUserEmailConnection(user.id, ZOHO_MAIL_PROVIDER);
      if (!connection || connection.status !== "connected") {
        return res.status(403).json({ error: "Connect your Zoho Mail account before sending this request." });
      }
      if (normalizeEmailForMatch(connection.providerEmail) !== senderIdentity.fromEmail) {
        return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
      }

      const accessToken = await getZohoAccessTokenForConnection(connection, config);
      let accountId = String(connection.providerAccountId || "").trim();
      if (!accountId) {
        const accountsRes = await fetch(`${config.mailApiBaseUrl}/api/accounts`, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        const accountsPayload: any = await accountsRes.json().catch(() => ({}));
        if (!accountsRes.ok) return res.status(502).json({ error: "Unable to verify Zoho Mail account before sending." });
        const matchingAccount = extractZohoAccounts(accountsPayload).find(
          (account) => getZohoAccountEmail(account) === senderIdentity.fromEmail
        );
        accountId = getZohoAccountId(matchingAccount);
        if (!accountId) return res.status(403).json({ error: "Connected Zoho Mail account does not match your CRM sender identity." });
      }

      const magicLink = buildPublicExpertPaymentDetailsUrl(request.token, req);
      const expertFirstName = getFirstNameForEmail(payable.expertName) || "there";
      const subject = "Thank you for your participation - payment details request";
      const body = `Hi ${expertFirstName},

Thank you for participating in the consultation with Mirae Connext.

To help us process your compensation, please submit your preferred payment details through the secure link below:

${magicLink}

You may provide details for PayPal, Wise, Pix, bank transfer, or another preferred method.

Please do not reply to this email with sensitive payment information. For security, payment details should be submitted through the secure form only.`;
      const senderProfile = await storage.getUser(user.id);
      const signatureSenderName = senderProfile?.fullName || senderIdentity.fromName;
      const signatureSenderEmail = senderProfile?.email || senderIdentity.fromEmail;
      const emailHtml = renderAdvisorEmailHtml({
        body,
        senderName: signatureSenderName,
        senderEmail: signatureSenderEmail,
        signatureName: senderProfile?.signatureName || null,
        jobTitle: senderProfile?.jobTitle || null,
        mobilePhone: senderProfile?.mobilePhone || null,
        logoUrl: buildAdvisorEmailLogoUrl(req),
      });

      const zohoRes = await fetch(`${config.mailApiBaseUrl}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: senderIdentity.fromEmail,
          toAddress: request.email,
          subject,
          content: emailHtml,
          mailFormat: "html",
        }),
      });
      if (!zohoRes.ok) {
        return res.status(502).json({ error: "Zoho Mail could not send the payment details request." });
      }

      const updated = await storage.markExpertPaymentDetailRequestSent(request.id, user.id);
      res.json(canViewSensitiveExpertPaymentDetails(req.user)
        ? getInternalPaymentDetailsRequest(updated, req)
        : getProjectPaymentDetailsRequest(updated, req));
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message === "zoho_refresh_token_missing" || message === "zoho_access_token_refresh_failed") {
        return res.status(403).json({ error: "Zoho Mail connection needs to be reconnected before sending." });
      }
      console.error("Failed to send expert payment details request:", error);
      res.status(500).json({ error: "Failed to send payment details request." });
    }
  });

  app.get("/api/public/expert-payment-details/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const request = token ? await storage.getExpertPaymentDetailRequestByToken(token) : undefined;
      if (!request) return res.status(404).json({ error: "Invalid payment details link." });
      const payable = await storage.getExpertPayableById(request.expertPayableId);
      if (!payable || payable.expertId !== request.expertId) return res.status(404).json({ error: "Invalid payment details link." });

      res.json({
        status: getPaymentDetailsRequestStatus(request),
        expertName: payable.expertName,
        payableAmount: payable.payableAmount,
        currency: payable.payoutCurrency,
        serviceDate: payable.serviceDate,
        durationMinutes: payable.durationMinutes,
        expiresAt: request.expiresAt,
        submittedAt: request.submittedAt,
      });
    } catch (error) {
      console.error("Failed to load public expert payment details request:", error);
      res.status(500).json({ error: "Unable to load this payment details request." });
    }
  });

  app.post("/api/public/expert-payment-details/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const request = token ? await storage.getExpertPaymentDetailRequestByToken(token) : undefined;
      if (!request) return res.status(404).json({ error: "Invalid payment details link." });
      const status = getPaymentDetailsRequestStatus(request);
      if (status === "expired") return res.status(410).json({ error: "This payment details link has expired." });
      if (status === "submitted") return res.status(409).json({ error: "Payment details have already been submitted." });

      const preferredPaymentMethod = String(req.body?.preferredPaymentMethod || "").trim();
      const accountHolderName = String(req.body?.accountHolderName || "").trim();
      const paymentIdentifier = String(req.body?.paymentIdentifier || "").trim();
      if (!expertPaymentMethods.has(preferredPaymentMethod)) return res.status(400).json({ error: "Select a valid payment method." });
      if (!accountHolderName || accountHolderName.length > 200) return res.status(400).json({ error: "Account holder or beneficiary name is required." });
      if (!paymentIdentifier || paymentIdentifier.length > 500) return res.status(400).json({ error: "Payment identifier is required." });
      if (req.body?.confirmationAccepted !== true) return res.status(400).json({ error: "Confirmation is required before submitting." });

      const submitted = await storage.submitExpertPaymentDetails(request.id, {
        preferredPaymentMethod,
        accountHolderName,
        paymentIdentifier,
        country: String(req.body?.country || "").slice(0, 200),
        paymentDetails: String(req.body?.paymentDetails || "").slice(0, 5000),
        notes: String(req.body?.notes || "").slice(0, 2000),
        confirmationAccepted: true,
      });
      res.json({
        success: true,
        status: submitted.status,
        submittedAt: submitted.submittedAt,
        message: "Thank you. Your payment details have been submitted securely.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit payment details.";
      res.status(400).json({ error: message });
    }
  });

  // ==================== INVOICES (FINANCE DRAFT LAYER) ====================
  const normalizeInvoiceDateOnly = (value: Date | string | null | undefined) => {
    if (!value) return "";
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return "";
      return value.toISOString().slice(0, 10);
    }

    const rawValue = String(value).trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
    }

    const date = new Date(rawValue);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };

  const parseInvoiceDateOnly = (value: unknown) => {
    if (!value) return null;
    const normalizedDate = normalizeInvoiceDateOnly(String(value));
    if (!normalizedDate) return undefined;
    return new Date(`${normalizedDate}T12:00:00.000Z`);
  };

  const formatInvoiceDateOnly = (value: Date | string | null | undefined) => {
    const normalizedDate = normalizeInvoiceDateOnly(value);
    if (!normalizedDate) return "-";
    const [year, month, day] = normalizedDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });
  };

  const formatInvoiceDateRange = (start: Date | string | null | undefined, end: Date | string | null | undefined) => {
    const normalizedStart = normalizeInvoiceDateOnly(start);
    const normalizedEnd = normalizeInvoiceDateOnly(end);
    if (!normalizedStart && !normalizedEnd) return "-";
    if (!normalizedEnd) return formatInvoiceDateOnly(normalizedStart);
    if (!normalizedStart) return formatInvoiceDateOnly(normalizedEnd);
    return `${formatInvoiceDateOnly(normalizedStart)} - ${formatInvoiceDateOnly(normalizedEnd)}`;
  };

  app.get("/api/invoices", authMiddleware, requireRoles("admin", "finance"), async (_req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const invoice = await storage.getInvoiceById(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/:id/pdf", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const invoiceDetail = await storage.getInvoiceById(id);
      if (!invoiceDetail) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const { invoice, lineItems } = invoiceDetail;
      const normalizedInvoiceStatus = String(invoice.status || "").trim().toLowerCase();
      if (normalizedInvoiceStatus !== "issued" && normalizedInvoiceStatus !== "sent" && normalizedInvoiceStatus !== "paid") {
        return res.status(400).json({ error: "Only issued, sent, or paid invoices can be downloaded as PDF" });
      }

      const invoiceNumber = invoice.invoiceNumber || invoice.draftNumber || `INV-${invoice.id}`;
      const safeFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
      const formatUsd = (value: string | number | null | undefined) => {
        const amount = Number(value || 0);
        return `USD ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };
      const formatCu = (value: string | number | null | undefined) => Number(value || 0).toFixed(2);
      const invoicePeriodFromStoredDates = formatInvoiceDateRange(invoice.periodStart, invoice.periodEnd);
      const fallbackInvoicePeriod = formatInvoiceDateRange(lineItems[0]?.serviceDate, lineItems[lineItems.length - 1]?.serviceDate);
      const invoicePeriod = invoicePeriodFromStoredDates === "-" ? fallbackInvoicePeriod : invoicePeriodFromStoredDates;

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 48, bottom: 56, left: 48, right: 48 },
        bufferPages: true,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
      doc.pipe(res);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const rightEdge = doc.page.width - doc.page.margins.right;
      const footerTop = doc.page.height - 52;
      const contentBottom = footerTop - 24;
      const brandBurgundy = "#7A1F2B";
      const brandInk = "#111827";
      const brandMuted = "#6b7280";
      const brandLine = "#e5e7eb";
      const brandPanel = "#faf7f5";
      const ensureSpace = (height: number) => {
        if (doc.y + height > contentBottom) {
          doc.addPage();
        }
      };

      const logoPath = path.resolve(process.cwd(), "attached_assets", "Logo_1764382033313.png");
      const headerTop = doc.page.margins.top - 14;
      doc.rect(0, 0, doc.page.width, 104).fill(brandPanel);
      doc.rect(0, 0, 7, doc.page.height).fill(brandBurgundy);

      const logoY = headerTop;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, doc.page.margins.left, logoY, { width: 82 });
        } catch {
          doc.font("Helvetica-Bold").fontSize(18).fillColor(brandBurgundy).text("Mirae Connext", doc.page.margins.left, logoY);
          doc.font("Helvetica").fontSize(9).fillColor(brandMuted).text("Expert Network Service");
        }
      } else {
        doc.font("Helvetica-Bold").fontSize(18).fillColor(brandBurgundy).text("Mirae Connext", doc.page.margins.left, logoY);
        doc.font("Helvetica").fontSize(9).fillColor(brandMuted).text("Expert Network Service");
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor(brandInk)
        .text("Invoice", rightEdge - 210, headerTop - 1, { width: 210, align: "right" });
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(brandBurgundy)
        .text(invoiceNumber, rightEdge - 250, headerTop + 30, { width: 250, align: "right" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brandMuted)
        .text(`Issue Date: ${formatInvoiceDateOnly(invoice.issuedAt || invoice.invoiceDate)}`, rightEdge - 250, headerTop + 48, { width: 250, align: "right" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brandMuted)
        .text("Currency: USD", rightEdge - 250, headerTop + 63, { width: 250, align: "right" });

      doc.y = 122;

      const panelTop = doc.y;
      const panelGap = 14;
      const billToPanelWidth = 210;
      const summaryPanelWidth = pageWidth - billToPanelWidth - panelGap;
      const panelHeight = 118;
      doc.roundedRect(doc.page.margins.left, panelTop, billToPanelWidth, panelHeight, 6).fill("#ffffff");
      doc.roundedRect(doc.page.margins.left, panelTop, billToPanelWidth, panelHeight, 6).strokeColor(brandLine).lineWidth(1).stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(brandMuted)
        .text("BILL TO", doc.page.margins.left + 18, panelTop + 18);
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(brandInk)
        .text(invoice.clientName || "-", doc.page.margins.left + 18, panelTop + 40, {
          width: billToPanelWidth - 36,
        });

      const summaryX = doc.page.margins.left + billToPanelWidth + panelGap;
      doc.roundedRect(summaryX, panelTop, summaryPanelWidth, panelHeight, 6).fill("#ffffff");
      doc.roundedRect(summaryX, panelTop, summaryPanelWidth, panelHeight, 6).strokeColor(brandLine).lineWidth(1).stroke();
      const summaryRows = [
        ["Billing Period", invoicePeriod],
        ["Issue Date", formatInvoiceDateOnly(invoice.issuedAt || invoice.invoiceDate)],
        ["Currency", "USD"],
        ["Total", formatUsd(invoice.total)],
      ];
      summaryRows.forEach(([label, value], index) => {
        const y = panelTop + 17 + index * 22;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(brandMuted).text(label.toUpperCase(), summaryX + 16, y, { width: 82 });
        doc
          .font(index === summaryRows.length - 1 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(index === summaryRows.length - 1 ? 13 : 9.5)
          .fillColor(index === summaryRows.length - 1 ? brandBurgundy : brandInk)
          .text(value, summaryX + 102, y - (index === summaryRows.length - 1 ? 3 : 0), {
          width: summaryPanelWidth - 118,
          align: "right",
          lineGap: 1,
        });
      });

      doc.y = panelTop + panelHeight + 24;

      doc.font("Helvetica-Bold").fontSize(13).fillColor(brandInk).text("Line Items", doc.page.margins.left, doc.y);
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(brandMuted).text("Completed consultation services billed in USD.", doc.page.margins.left, doc.y);
      doc.moveDown(0.9);

      const tableLeft = doc.page.margins.left;
      const columns = [
        { title: "Service Date", x: tableLeft, width: 72, align: "left" as const },
        { title: "Project", x: tableLeft + 78, width: 150, align: "left" as const },
        { title: "Expert", x: tableLeft + 234, width: 82, align: "left" as const },
        { title: "CU", x: tableLeft + 322, width: 38, align: "right" as const },
        { title: "USD CU Rate", x: tableLeft + 366, width: 74, align: "right" as const },
        { title: "Amount", x: tableLeft + 446, width: 66, align: "right" as const },
      ];
      const renderTableHeader = () => {
        ensureSpace(48);
        const headerTop = doc.y;
        doc.rect(tableLeft, headerTop, pageWidth, 24).fill(brandBurgundy);
        columns.forEach((column) => {
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor("#ffffff")
            .text(column.title, column.x + 4, headerTop + 7, { width: column.width - 8, align: column.align });
        });
        doc.y = headerTop + 32;
      };

      renderTableHeader();
      if (lineItems.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(10).fillColor(brandMuted).text("No line items were found for this issued invoice.");
      } else {
        lineItems.forEach((item, index) => {
          const projectHeight = doc.heightOfString(item.projectName || "-", { width: columns[1].width - 8 });
          const expertHeight = doc.heightOfString(item.expertName || "-", { width: columns[2].width - 8 });
          const rowHeight = Math.max(34, projectHeight, expertHeight) + 10;
          if (doc.y + rowHeight > contentBottom) {
            doc.addPage();
            renderTableHeader();
          }
          const rowTop = doc.y;

          if (index % 2 === 1) {
            doc.rect(tableLeft, rowTop - 2, pageWidth, rowHeight).fill("#fbfbfb");
          }
          doc.moveTo(tableLeft, rowTop + rowHeight - 2).lineTo(rightEdge, rowTop + rowHeight - 2).strokeColor(brandLine).stroke();
          doc.font("Helvetica").fontSize(8.5).fillColor(brandInk);
          doc.text(formatInvoiceDateOnly(item.serviceDate), columns[0].x + 4, rowTop + 7, { width: columns[0].width - 8 });
          doc.font("Helvetica-Bold").text(item.projectName || "-", columns[1].x + 4, rowTop + 7, { width: columns[1].width - 8 });
          doc.font("Helvetica").text(item.expertName || "-", columns[2].x + 4, rowTop + 7, { width: columns[2].width - 8 });
          doc.text(formatCu(item.cuUsed), columns[3].x + 4, rowTop + 7, { width: columns[3].width - 8, align: "right" });
          doc.text(formatUsd(item.cuRate), columns[4].x + 4, rowTop + 7, { width: columns[4].width - 8, align: "right" });
          doc.font("Helvetica-Bold").text(formatUsd(item.amount), columns[5].x + 4, rowTop + 5, {
            width: columns[5].width - 8,
            align: "right",
          });
          doc.y = rowTop + rowHeight + 2;
        });
      }

      ensureSpace(76);
      doc.moveDown(0.8);
      const totalBoxWidth = 230;
      const totalBoxX = rightEdge - totalBoxWidth;
      const totalBoxY = doc.y;
      doc.roundedRect(totalBoxX, totalBoxY, totalBoxWidth, 58, 6).fill(brandPanel);
      doc.roundedRect(totalBoxX, totalBoxY, totalBoxWidth, 58, 6).strokeColor("#eadeda").stroke();
      doc.font("Helvetica-Bold").fontSize(9).fillColor(brandMuted).text("TOTAL DUE", totalBoxX + 18, totalBoxY + 15, { width: 82 });
      doc.font("Helvetica-Bold").fontSize(16).fillColor(brandBurgundy).text(formatUsd(invoice.total), totalBoxX + 96, totalBoxY + 13, {
        width: totalBoxWidth - 114,
        align: "right",
      });
      doc.font("Helvetica").fontSize(8.5).fillColor(brandMuted).text("All amounts are denominated in USD.", totalBoxX + 18, totalBoxY + 38, {
        width: totalBoxWidth - 36,
      });

      const pageRange = doc.bufferedPageRange();
      for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        doc.font("Helvetica").fontSize(8).fillColor(brandMuted);
        doc.moveTo(doc.page.margins.left, footerTop - 8).lineTo(rightEdge, footerTop - 8).strokeColor(brandLine).stroke();
        doc.text(
          "Thank you for working with Mirae Connext. This invoice reflects completed consultation services provided through Mirae Connext.",
          doc.page.margins.left,
          footerTop,
          { width: pageWidth, align: "center", lineBreak: false }
        );
      }

      doc.end();
    } catch (error) {
      console.error("Failed to generate invoice PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate invoice PDF" });
      }
    }
  });

  app.post("/api/invoices/draft", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const billableUsageIds = Array.isArray(req.body?.billableUsageIds)
        ? req.body.billableUsageIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];

      if (billableUsageIds.length === 0) {
        return res.status(400).json({ error: "At least one billable usage id is required" });
      }

      const periodStart = parseInvoiceDateOnly(req.body?.periodStart);
      const periodEnd = parseInvoiceDateOnly(req.body?.periodEnd);

      if (periodStart === undefined || periodEnd === undefined) {
        return res.status(400).json({ error: "Billing Period dates must be valid dates" });
      }

      const normalizedPeriodStart = periodStart ? normalizeInvoiceDateOnly(periodStart) : "";
      const normalizedPeriodEnd = periodEnd ? normalizeInvoiceDateOnly(periodEnd) : "";
      if (normalizedPeriodStart && normalizedPeriodEnd && normalizedPeriodStart > normalizedPeriodEnd) {
        return res.status(400).json({ error: "Billing Period Start must be on or before Billing Period End" });
      }

      const invoiceDraft = await storage.createInvoiceDraft(billableUsageIds, { periodStart, periodEnd });
      res.status(201).json(invoiceDraft);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create invoice draft";
      console.error("Failed to create invoice draft:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/cancel", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const canceledInvoice = await storage.cancelInvoiceDraft(id);
      res.json(canceledInvoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel invoice draft";
      console.error("Failed to cancel invoice draft:", error);
      const status = message === "Invoice not found." ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/issue", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const issuedInvoice = await storage.issueInvoice(id, req.user?.id);
      res.json(issuedInvoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to issue invoice";
      console.error("Failed to issue invoice:", error);
      const status = message === "Invoice not found." ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/mark-sent", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const sentInvoice = await storage.markInvoiceSent(
        id,
        {
          sentMethod: req.body?.sentMethod || "manual_email",
          sentRecipientEmail: req.body?.sentRecipientEmail || null,
          sentNotes: req.body?.sentNotes || null,
        },
        req.user?.id
      );
      res.json(sentInvoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark invoice as sent";
      console.error("Failed to mark invoice as sent:", error);
      const status = message === "Invoice not found." ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/mark-paid", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const paidInvoice = await storage.markInvoicePaid(
        id,
        {
          paymentMethod: req.body?.paymentMethod || null,
          paymentReferenceNumber: req.body?.paymentReferenceNumber || null,
          paymentNotes: req.body?.paymentNotes || null,
        },
        req.user?.id
      );
      res.json(paidInvoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark invoice as paid";
      console.error("Failed to mark invoice as paid:", error);
      const status = message === "Invoice not found." ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  // ==================== EXPENSES (FINANCE OPERATING EXPENSES) ====================
  const expenseCategories = new Set([
    "Software",
    "Hosting",
    "Database",
    "Email",
    "Website",
    "Sales Tool",
    "Communication",
    "Legal",
    "Accounting",
    "Admin",
    "AI / Automation",
    "Other",
  ]);
  const expenseBillingTypes = new Set(["One-time", "Monthly", "Annual", "Free Plan"]);
  const expenseStatuses = new Set(["Active", "Paid", "Cancelled", "Archived"]);
  const expenseAccountingStatuses = new Set(["Not Applicable", "Pending", "Sent to Accountant", "Booked", "No Cost"]);
  const allowedReceiptMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

  const parseExpenseFilters = (query: Record<string, unknown>) => {
    const parseOptionalDate = (value: unknown, endOfDay = false) => {
      if (!value) return undefined;
      const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
      return Number.isNaN(date.getTime()) ? undefined : date;
    };
    return {
      search: query.search ? String(query.search).trim() : undefined,
      category: query.category ? String(query.category) : undefined,
      status: query.status ? String(query.status) : undefined,
      currency: query.currency ? String(query.currency).toUpperCase() : undefined,
      billingType: query.billingType ? String(query.billingType) : undefined,
      accountingStatus: query.accountingStatus ? String(query.accountingStatus) : undefined,
      fromDate: parseOptionalDate(query.fromDate),
      toDate: parseOptionalDate(query.toDate, true),
    };
  };

  const normalizeExpensePayload = (body: Record<string, unknown>) => ({
    vendor: String(body.vendor || "").trim(),
    category: String(body.category || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    amount: Number(body.amount ?? 0).toFixed(2),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    billingType: String(body.billingType || "").trim(),
    expenseDate: body.expenseDate,
    renewalDate: body.renewalDate || null,
    paymentMethod: body.paymentMethod ? String(body.paymentMethod).trim() : null,
    status: String(body.status || "Active").trim(),
    ownerId: body.ownerId ? Number(body.ownerId) : null,
    approvedBy: body.approvedBy ? Number(body.approvedBy) : null,
    approvedAt: body.approvedAt || null,
    accountingStatus: String(body.accountingStatus || "Pending").trim(),
    notes: body.notes ? String(body.notes).trim() : null,
  });

  const validateExpensePayload = (payload: ReturnType<typeof normalizeExpensePayload>) => {
    const amount = Number(payload.amount);
    if (!payload.vendor) return "Vendor is required.";
    if (!payload.category || !expenseCategories.has(payload.category)) return "A valid category is required.";
    if (!payload.currency) return "Currency is required.";
    if (!payload.billingType || !expenseBillingTypes.has(payload.billingType)) return "A valid billing type is required.";
    if (!payload.expenseDate) return "Expense date is required.";
    if (!payload.status || !expenseStatuses.has(payload.status)) return "A valid status is required.";
    if (!payload.accountingStatus || !expenseAccountingStatuses.has(payload.accountingStatus)) return "A valid accounting status is required.";
    if (!Number.isFinite(amount) || amount < 0) return "Amount must be 0 or greater.";
    if (amount === 0 && payload.billingType !== "Free Plan" && payload.accountingStatus !== "No Cost") {
      return "Amount can be 0 only for Free Plan or No Cost expenses.";
    }
    return null;
  };

  const escapeCsvValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  app.get("/api/expenses/export.csv", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const report = await storage.getExpenses(parseExpenseFilters(req.query as Record<string, unknown>));
      const headers = [
        "Expense ID",
        "Vendor",
        "Category",
        "Description",
        "Amount",
        "Currency",
        "Billing Type",
        "Expense Date",
        "Renewal Date",
        "Payment Method",
        "Status",
        "Accounting Status",
        "Owner",
        "Approved By",
        "Approved At",
        "Receipt Status",
        "Receipt File Name",
        "Notes",
        "Created At",
        "Updated At",
      ];
      const rows = report.rows.map((row) => [
        row.expenseId,
        row.vendor,
        row.category,
        row.description,
        row.amount,
        row.currency,
        row.billingType,
        row.expenseDate,
        row.renewalDate,
        row.paymentMethod,
        row.status,
        row.accountingStatus,
        row.ownerName,
        row.approvedByName,
        row.approvedAt,
        row.hasReceipt ? "Attached" : Number(row.amount || 0) === 0 || row.billingType === "Free Plan" ? "N/A" : "Missing",
        row.receiptFileName,
        row.notes,
        row.createdAt,
        row.updatedAt,
      ]);
      const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="expenses_export.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Failed to export expenses:", error);
      res.status(500).json({ error: "Failed to export expenses" });
    }
  });

  app.get("/api/expenses", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const report = await storage.getExpenses(parseExpenseFilters(req.query as Record<string, unknown>));
      res.json(report);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const expense = await storage.getExpense(id);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      console.error("Failed to fetch expense:", error);
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const payload = normalizeExpensePayload(req.body || {});
      const validationError = validateExpensePayload(payload);
      if (validationError) return res.status(400).json({ error: validationError });
      const parsed = insertExpenseSchema.parse(payload);
      const expense = await storage.createExpense(parsed, req.user?.id);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Failed to create expense:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const payload = normalizeExpensePayload(req.body || {});
      const validationError = validateExpensePayload(payload);
      if (validationError) return res.status(400).json({ error: validationError });
      const parsed = insertExpenseSchema.partial().parse(payload);
      const expense = await storage.updateExpense(id, parsed);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      console.error("Failed to update expense:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const expense = await storage.archiveExpense(id);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      console.error("Failed to archive expense:", error);
      res.status(500).json({ error: "Failed to archive expense" });
    }
  });

  app.post("/api/expenses/:id/receipt", authMiddleware, requireRoles("admin", "finance"), expenseReceiptUpload, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      const mimeType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const fileName = decodeURIComponent(String(req.headers["x-file-name"] || "receipt").trim());
      if (!allowedReceiptMimeTypes.has(mimeType)) {
        return res.status(400).json({ error: "Receipt must be a PDF, PNG, JPG, or JPEG file." });
      }
      if (!body.length) return res.status(400).json({ error: "Receipt file is required." });
      if (body.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Receipt file must be 5MB or smaller." });
      const expense = await storage.saveExpenseReceipt(id, {
        fileName,
        mimeType,
        fileSize: body.length,
        data: body,
        uploadedBy: req.user?.id,
      });
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      console.error("Failed to upload expense receipt:", error);
      res.status(500).json({ error: "Failed to upload expense receipt" });
    }
  });

  app.get("/api/expenses/:id/receipt", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const receipt = await storage.getExpenseReceipt(id);
      if (!receipt) return res.status(404).json({ error: "Receipt not found" });
      res.setHeader("Content-Type", receipt.mimeType);
      res.setHeader("Content-Length", String(receipt.fileSize));
      res.setHeader("Content-Disposition", `attachment; filename="${receipt.fileName.replace(/"/g, "")}"`);
      res.send(receipt.data);
    } catch (error) {
      console.error("Failed to download expense receipt:", error);
      res.status(500).json({ error: "Failed to download expense receipt" });
    }
  });

  app.delete("/api/expenses/:id/receipt", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid expense id" });
      const expense = await storage.deleteExpenseReceipt(id);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      res.json(expense);
    } catch (error) {
      console.error("Failed to delete expense receipt:", error);
      res.status(500).json({ error: "Failed to delete expense receipt" });
    }
  });

  // ==================== OPERATIONS ANALYTICS (READ-ONLY) ====================
  app.get("/api/analytics/operations", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const parseOptionalDate = (value: unknown, endOfDay = false) => {
        if (!value) return undefined;
        const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
        return Number.isNaN(date.getTime()) ? undefined : date;
      };
      const requestedGranularity = String(req.query.granularity || "month");
      const granularity =
        requestedGranularity === "day" || requestedGranularity === "week" || requestedGranularity === "month"
          ? requestedGranularity
          : "month";

      const analytics = await storage.getOperationsAnalytics({
        startDate: parseOptionalDate(req.query.startDate),
        endDate: parseOptionalDate(req.query.endDate, true),
        granularity,
      });

      res.json(analytics);
    } catch (error) {
      console.error("Failed to fetch operations analytics:", error);
      res.status(500).json({ error: "Failed to fetch operations analytics" });
    }
  });

  // ==================== PM PERFORMANCE (READ-ONLY) ====================
  app.get("/api/performance/pm", authMiddleware, requireRoles("admin", "finance"), async (req, res) => {
    try {
      const parseOptionalDate = (value: unknown, endOfDay = false) => {
        if (!value) return undefined;
        const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
        return Number.isNaN(date.getTime()) ? undefined : date;
      };
      const parseOptionalInteger = (value: unknown, fallback: number) => {
        if (!value) return fallback;
        const parsed = parseInt(String(value), 10);
        return Number.isNaN(parsed) ? fallback : parsed;
      };
      const requestedSortBy = String(req.query.sortBy || "totalCUUsed");
      const sortBy =
        requestedSortBy === "completedCalls" ||
        requestedSortBy === "activeProjects" ||
        requestedSortBy === "cuPerRequest" ||
        requestedSortBy === "totalCUUsed"
          ? requestedSortBy
          : "totalCUUsed";
      const requestedOrder = String(req.query.order || "desc");
      const order = requestedOrder === "asc" ? "asc" : "desc";

      const report = await storage.getPmPerformance({
        startDate: parseOptionalDate(req.query.startDate),
        endDate: parseOptionalDate(req.query.endDate, true),
        search: req.query.search ? String(req.query.search) : undefined,
        sortBy,
        order,
        limit: parseOptionalInteger(req.query.limit, 50),
        offset: parseOptionalInteger(req.query.offset, 0),
      });

      res.json(report);
    } catch (error) {
      console.error("Failed to fetch PM performance:", error);
      res.status(500).json({ error: "Failed to fetch PM performance" });
    }
  });

  // ==================== USAGE RECORDS (LEGACY) ====================
  app.get("/api/usage", authMiddleware, async (req, res) => {
    try {
      const records = await storage.getUsageRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage records" });
    }
  });

  app.post("/api/usage", authMiddleware, async (req, res) => {
    try {
      const result = insertUsageRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.createUsageRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create usage record" });
    }
  });

  app.delete("/api/usage/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUsageRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Usage record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete usage record" });
    }
  });

  // ==================== CU CALCULATION UTILITY ====================
  app.get("/api/calculate-cu", (req, res) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 0;
      const cu = calculateCU(minutes);
      res.json({ minutes, cu });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate CU" });
    }
  });

  // ==================== KPI & INCENTIVE DASHBOARD ====================
  /**
   * GET /api/kpi/my-monthly
   * 
   * Returns monthly KPI data and incentive calculations for the authenticated user.
   * All date filtering is done in America/Sao_Paulo timezone.
   * 
   * Incentive Rules:
   * - RA: R$250 per completed call (expert must be sourced by RA and call within 60 days of sourcing). Cap: R$2,500/month.
   * - PM: R$70 per CU (Credit Unit = 1 hour). No cap.
   * - Admin/Finance: See global totals for all calls.
   */
  app.get("/api/kpi/my-monthly", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get current month boundaries in Brazil timezone (America/Sao_Paulo)
      // Using date-fns-tz for proper DST handling
      const BRAZIL_TZ = "America/Sao_Paulo";
      const now = new Date();
      
      // Convert current UTC time to Brazil timezone
      const brazilNow = toZonedTime(now, BRAZIL_TZ);
      
      const year = brazilNow.getFullYear();
      const month = brazilNow.getMonth(); // 0-indexed
      
      // Get month boundaries in Brazil timezone
      const monthStartInBrazil = startOfMonth(brazilNow);
      const nextMonthStartInBrazil = addMonths(monthStartInBrazil, 1);
      
      // Convert back to UTC for database queries (DST-safe)
      // Use start of next month as exclusive upper bound
      const monthStartUTC = fromZonedTime(monthStartInBrazil, BRAZIL_TZ);
      const monthEndUTC = fromZonedTime(nextMonthStartInBrazil, BRAZIL_TZ);

      // Base query: get all completed call records for this month with joins
      const baseQuery = await db
        .select({
          id: callRecords.id,
          projectId: callRecords.projectId,
          expertId: callRecords.expertId,
          pmId: callRecords.pmId,
          raId: callRecords.raId,
          durationMinutes: callRecords.durationMinutes,
          cuUsed: callRecords.cuUsed,
          completedAt: callRecords.completedAt,
          callDate: callRecords.callDate,
          status: callRecords.status,
          projectName: projects.name,
          clientName: projects.clientName,
          cuRatePerCU: projects.cuRatePerCU,
          expertName: experts.name,
          expertSourcedByRaId: experts.sourcedByRaId,
          expertSourcedAt: experts.sourcedAt,
        })
        .from(callRecords)
        .innerJoin(projects, eq(callRecords.projectId, projects.id))
        .innerJoin(experts, eq(callRecords.expertId, experts.id))
        .where(
          and(
            eq(callRecords.status, "completed"),
            sql`${callRecords.completedAt} IS NOT NULL`,
            gte(callRecords.completedAt, monthStartUTC),
            lt(callRecords.completedAt, monthEndUTC)
          )
        );

      let filteredCalls: typeof baseQuery = [];
      let totals = {
        totalCalls: 0,
        totalCU: 0,
        incentive: 0,
      };

      const role = user.role;
      const userId = user.id;

      if (role === "ra" || role === "Research Associate") {
        // RA: Only calls where expert was sourced by this RA AND call completed within 60 days of sourcing
        filteredCalls = baseQuery.filter((call) => {
          if (call.expertSourcedByRaId !== userId) return false;
          if (!call.expertSourcedAt || !call.completedAt) return false;
          
          const sourcedAt = new Date(call.expertSourcedAt);
          const completedAt = new Date(call.completedAt);
          const daysDiff = (completedAt.getTime() - sourcedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          return daysDiff <= 60;
        });

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        const rawIncentive = totals.totalCalls * 250;
        totals.incentive = Math.min(rawIncentive, 2500); // Cap at R$2,500

      } else if (role === "pm") {
        // PM: Calls where pmId = current user
        filteredCalls = baseQuery.filter((call) => call.pmId === userId);

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        totals.incentive = Math.round(totals.totalCU * 70 * 100) / 100; // R$70 per CU, no cap

      } else if (role === "admin" || role === "finance") {
        // Admin/Finance: See all calls (global totals) with company revenue
        filteredCalls = baseQuery;

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        // Admin/Finance do not have incentive calculations
        totals.incentive = 0;
      }

      // Calculate company revenue for admin/finance
      let totalCompanyRevenueUSD = 0;
      
      // Format calls for response
      const calls = filteredCalls.map((call) => {
        const callDate = call.completedAt || call.callDate;
        // Convert to Brazil timezone for display using date-fns-tz
        const brazilTime = toZonedTime(new Date(callDate), BRAZIL_TZ);
        
        const cuUsed = parseFloat(call.cuUsed || "0");
        const cuRate = parseFloat(call.cuRatePerCU || "1150");
        const revenueUSD = cuUsed * cuRate;
        
        // Only add to company total if admin/finance role
        if (role === "admin" || role === "finance") {
          totalCompanyRevenueUSD += revenueUSD;
        }
        
        return {
          id: call.id,
          interviewDate: format(brazilTime, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: BRAZIL_TZ }),
          expertName: call.expertName,
          projectName: call.projectName,
          clientName: call.clientName,
          cuUsed: cuUsed,
          cuRatePerCU: cuRate,
          revenueUSD: Math.round(revenueUSD * 100) / 100,
        };
      });

      // Round totals
      totals.totalCU = Math.round(totals.totalCU * 100) / 100;
      totalCompanyRevenueUSD = Math.round(totalCompanyRevenueUSD * 100) / 100;

      // Add company revenue to response for admin/finance
      const responseData: any = {
        role,
        period: {
          month: month + 1, // 1-indexed for display
          year,
          timezone: "America/Sao_Paulo",
        },
        totals,
        calls,
      };
      
      if (role === "admin" || role === "finance") {
        responseData.companyTotals = {
          totalCompanyCU: totals.totalCU,
          totalCompanyCalls: totals.totalCalls,
          totalCompanyRevenueUSD: totalCompanyRevenueUSD,
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("KPI endpoint error:", error);
      res.status(500).json({ error: "Failed to fetch KPI data" });
    }
  });

  /**
   * GET /api/employees/:id/overview
   * 
   * Returns detailed employee overview including KPIs and accounts.
   * Only accessible by admin and finance roles.
   */
  app.get("/api/employees/:id/overview", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      
      // Get employee basic info
      const employee = await storage.getUser(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get current month boundaries in Brazil timezone
      const BRAZIL_TZ = "America/Sao_Paulo";
      const now = new Date();
      const brazilNow = toZonedTime(now, BRAZIL_TZ);
      const year = brazilNow.getFullYear();
      const month = brazilNow.getMonth();
      const monthStartInBrazil = startOfMonth(brazilNow);
      const nextMonthStartInBrazil = addMonths(monthStartInBrazil, 1);
      const monthStartUTC = fromZonedTime(monthStartInBrazil, BRAZIL_TZ);
      const monthEndUTC = fromZonedTime(nextMonthStartInBrazil, BRAZIL_TZ);

      // Get all completed calls this month with full details
      const allCalls = await db
        .select({
          id: callRecords.id,
          projectId: callRecords.projectId,
          expertId: callRecords.expertId,
          pmId: callRecords.pmId,
          raId: callRecords.raId,
          durationMinutes: callRecords.durationMinutes,
          cuUsed: callRecords.cuUsed,
          completedAt: callRecords.completedAt,
          callDate: callRecords.callDate,
          status: callRecords.status,
          projectName: projects.name,
          clientName: projects.clientName,
          clientOrganizationId: projects.clientOrganizationId,
          cuRatePerCU: projects.cuRatePerCU,
          projectPmId: projects.createdByPmId,
          expertName: experts.name,
          expertSourcedByRaId: experts.sourcedByRaId,
          expertSourcedAt: experts.sourcedAt,
        })
        .from(callRecords)
        .innerJoin(projects, eq(callRecords.projectId, projects.id))
        .innerJoin(experts, eq(callRecords.expertId, experts.id))
        .where(
          and(
            eq(callRecords.status, "completed"),
            sql`${callRecords.completedAt} IS NOT NULL`,
            gte(callRecords.completedAt, monthStartUTC),
            lt(callRecords.completedAt, monthEndUTC)
          )
        );

      // Filter calls based on employee role
      let filteredCalls: typeof allCalls = [];
      let kpi = {
        totalCU: 0,
        completedCalls: 0,
        incentive: 0,
      };
      
      const role = employee.role;

      if (role === "ra" || role === "Research Associate") {
        // RA: Calls where expert was sourced by this RA AND within 60 days
        filteredCalls = allCalls.filter((call) => {
          if (call.expertSourcedByRaId !== employeeId) return false;
          if (!call.expertSourcedAt || !call.completedAt) return false;
          
          const sourcedAt = new Date(call.expertSourcedAt);
          const completedAt = new Date(call.completedAt);
          const daysDiff = (completedAt.getTime() - sourcedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          return daysDiff <= 60;
        });

        kpi.completedCalls = filteredCalls.length;
        kpi.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        const rawIncentive = kpi.completedCalls * 250;
        kpi.incentive = Math.min(rawIncentive, 2500); // Cap at R$2,500

      } else if (role === "pm") {
        // PM: Calls where pmId = this employee
        filteredCalls = allCalls.filter((call) => call.pmId === employeeId);

        kpi.completedCalls = filteredCalls.length;
        kpi.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        kpi.incentive = Math.round(kpi.totalCU * 70 * 100) / 100; // R$70 per CU

      } else if (role === "admin" || role === "finance") {
        // Admin/Finance: No personal calls, no incentive
        filteredCalls = [];
        kpi.completedCalls = 0;
        kpi.totalCU = 0;
        kpi.incentive = 0;
      }

      // Round totalCU
      kpi.totalCU = Math.round(kpi.totalCU * 100) / 100;

      // Build accounts list - only for PM employees
      let accounts: any[] = [];
      
      if (role === "pm") {
        const accountsMap = new Map<string, {
          clientId: number | null;
          clientName: string;
          totalCUThisMonth: number;
          completedCallsThisMonth: number;
          revenueThisMonthUSD: number;
          lastActivityAt: Date | null;
        }>();

        // Process calls to build accounts
        for (const call of filteredCalls) {
          const clientKey = call.clientName;
          const cuUsed = parseFloat(call.cuUsed || "0");
          const cuRate = parseFloat(call.cuRatePerCU || "1150");
          const revenueUSD = cuUsed * cuRate;
          const completedAt = call.completedAt ? new Date(call.completedAt) : null;

          if (!accountsMap.has(clientKey)) {
            accountsMap.set(clientKey, {
              clientId: call.clientOrganizationId,
              clientName: call.clientName,
              totalCUThisMonth: 0,
              completedCallsThisMonth: 0,
              revenueThisMonthUSD: 0,
              lastActivityAt: null,
            });
          }

          const account = accountsMap.get(clientKey)!;
          account.totalCUThisMonth += cuUsed;
          account.completedCallsThisMonth += 1;
          account.revenueThisMonthUSD += revenueUSD;
          
          if (completedAt && (!account.lastActivityAt || completedAt > account.lastActivityAt)) {
            account.lastActivityAt = completedAt;
          }
        }

        // Convert accounts map to array and format
        accounts = Array.from(accountsMap.values()).map((account) => ({
          clientId: account.clientId,
          clientName: account.clientName,
          totalCUThisMonth: Math.round(account.totalCUThisMonth * 100) / 100,
          completedCallsThisMonth: account.completedCallsThisMonth,
          revenueThisMonthUSD: Math.round(account.revenueThisMonthUSD * 100) / 100,
          contractedCU: null, // No contractedCU field exists yet
          usageRate: null, // Cannot calculate without contractedCU
          lastActivityAt: account.lastActivityAt 
            ? format(toZonedTime(account.lastActivityAt, BRAZIL_TZ), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: BRAZIL_TZ })
            : null,
        }));

        // Sort accounts by revenue descending
        accounts.sort((a, b) => b.revenueThisMonthUSD - a.revenueThisMonthUSD);
      }

      res.json({
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          email: employee.email,
          role: employee.role,
          status: employee.isActive ? "active" : "inactive",
          joinedAt: employee.createdAt,
        },
        kpi: {
          period: {
            month: month + 1,
            year,
            timezone: "America/Sao_Paulo",
          },
          totalCU: kpi.totalCU,
          completedCalls: kpi.completedCalls,
          incentive: kpi.incentive,
        },
        accounts,
      });
    } catch (error) {
      console.error("Employee overview error:", error);
      res.status(500).json({ error: "Failed to fetch employee overview" });
    }
  });

  // ==================== SOURCING INCENTIVE ENDPOINTS ====================
  
  // GET /api/ra-incentives - Get sourcing incentive summary.
  // Route name is preserved for backward compatibility.
  app.get("/api/ra-incentives", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const role = normalizeSourcingRole(user.role);
      
      if (!["admin", "ceo", "coo", "pm", "finance"].includes(role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fromDate, toDate } = req.query;
      
      const periodFromDate = fromDate ? new Date(fromDate as string) : undefined;
      const periodToDate = toDate ? new Date(toDate as string) : undefined;

      const summaries = await storage.getAllRaIncentiveSummary(periodFromDate, periodToDate);
      
      res.json({
        period: {
          fromDate: periodFromDate?.toISOString() || null,
          toDate: periodToDate?.toISOString() || null,
        },
        incentivePerCallBRL: 250,
        eligibilityWindowDays: 60,
        unpaidEligibleCalls: 4,
        monthlyCapBRL: 4000,
        summaries,
      });
    } catch (error) {
      console.error("Error fetching sourcing incentives:", error);
      res.status(500).json({ error: "Failed to fetch sourcing incentives" });
    }
  });

  // GET /api/ra-incentives/:raId - Get detailed incentive info for a specific sourcer.
  // Route name is preserved for backward compatibility.
  app.get("/api/ra-incentives/:raId", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const raId = parseInt(req.params.raId);
      const role = normalizeSourcingRole(user.role);

      if (role === "ra" && user.id !== raId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!["admin", "ceo", "coo", "pm", "finance", "ra"].includes(role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fromDate, toDate } = req.query;
      
      const periodFromDate = fromDate ? new Date(fromDate as string) : undefined;
      const periodToDate = toDate ? new Date(toDate as string) : undefined;

      const incentiveData = await storage.calculateRaIncentives(raId, periodFromDate, periodToDate);
      
      res.json({
        period: {
          fromDate: periodFromDate?.toISOString() || null,
          toDate: periodToDate?.toISOString() || null,
        },
        incentivePerCallBRL: 250,
        eligibilityWindowDays: 60,
        unpaidEligibleCalls: 4,
        monthlyCapBRL: 4000,
        ...incentiveData,
      });
    } catch (error) {
      console.error("Error fetching sourcing incentive details:", error);
      res.status(500).json({ error: "Failed to fetch sourcing incentive details" });
    }
  });

  // GET /api/experts-with-recruiter - Get experts with their recruiter info
  app.get("/api/experts-with-recruiter", authMiddleware, async (req, res) => {
    try {
      const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || "25"), 10) || 25, 1), 100);
      const search = String(req.query.search || "").trim();
      const availabilityStatus = String(req.query.availabilityStatus || "")
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean);
      const hourlyRateMin = req.query.hourlyRateMin !== undefined ? Number(req.query.hourlyRateMin) : undefined;
      const hourlyRateMax = req.query.hourlyRateMax !== undefined ? Number(req.query.hourlyRateMax) : undefined;
      const conditions = [];

      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(experts.name, pattern),
            ilike(experts.expertise, pattern),
            ilike(experts.industry, pattern),
            ilike(experts.company, pattern),
            ilike(experts.jobTitle, pattern)
          )
        );
      }
      if (availabilityStatus.length > 0) {
        conditions.push(inArray(experts.status, availabilityStatus));
      }
      if (Number.isFinite(hourlyRateMin)) {
        conditions.push(sql`${experts.hourlyRate} >= ${hourlyRateMin}`);
      }
      if (Number.isFinite(hourlyRateMax)) {
        conditions.push(sql`${experts.hourlyRate} <= ${hourlyRateMax}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ totalCount }] = await db
        .select({ totalCount: sql<number>`count(*)` })
        .from(experts)
        .leftJoin(users, eq(experts.sourcedByRaId, users.id))
        .where(whereClause);

      const expertsWithRecruiter = await db
        .select({
          id: experts.id,
          name: experts.name,
          email: experts.email,
          phone: experts.phone,
          linkedinUrl: experts.linkedinUrl,
          country: experts.country,
          city: experts.city,
          expertise: experts.expertise,
          sectorExpertise: experts.sectorExpertise,
          regionalExpertise: experts.regionalExpertise,
          industry: experts.industry,
          company: experts.company,
          jobTitle: experts.jobTitle,
          yearsOfExperience: experts.yearsOfExperience,
          hourlyRate: experts.hourlyRate,
          bio: experts.bio,
          workHistory: experts.workHistory,
          status: experts.status,
          createdAt: experts.createdAt,
          sourcedByRaId: experts.sourcedByRaId,
          sourcedAt: experts.sourcedAt,
          recruiterName: users.fullName,
          recruiterEmail: users.email,
        })
        .from(experts)
        .leftJoin(users, eq(experts.sourcedByRaId, users.id))
        .where(whereClause)
        .orderBy(desc(experts.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const resolveExpertRecruiter = async (expert: typeof expertsWithRecruiter[number]) => {
        const candidates: Array<{
          userId: number | null;
          email: string | null;
          recruitedAt: Date | null;
          source: string;
        }> = [];

        if (expert.sourcedByRaId) {
          candidates.push({
            userId: expert.sourcedByRaId,
            email: null,
            recruitedAt: expert.sourcedAt ? new Date(expert.sourcedAt) : expert.createdAt ? new Date(expert.createdAt) : null,
            source: "expert.sourcedByRaId",
          });
        }

        const expertAssignments = await db
          .select()
          .from(projectExperts)
          .where(eq(projectExperts.expertId, expert.id));
        for (const assignment of expertAssignments) {
          if (assignment.sourcedByRaId) {
            candidates.push({
              userId: assignment.sourcedByRaId,
              email: null,
              recruitedAt: assignment.assignedAt ? new Date(assignment.assignedAt) : assignment.respondedAt ? new Date(assignment.respondedAt) : null,
              source: "projectExperts.sourcedByRaId",
            });
          }
          if (assignment.invitationToken) {
            const [link] = await db
              .select()
              .from(expertInvitationLinks)
              .where(eq(expertInvitationLinks.token, assignment.invitationToken));
            if (link) {
              candidates.push({
                userId: link.raId || null,
                email: link.recruitedBy || null,
                recruitedAt: link.usedAt ? new Date(link.usedAt) : link.createdAt ? new Date(link.createdAt) : null,
                source: "projectExperts.invitationToken",
              });
            }
          }
        }

        const normalizedExpertEmail = String(expert.email || "").trim().toLowerCase();
        const inviteLinks = await db
          .select()
          .from(expertInvitationLinks)
          .where(
            or(
              eq(expertInvitationLinks.expertId, expert.id),
              normalizedExpertEmail
                ? sql`lower(trim(${expertInvitationLinks.candidateEmail})) = ${normalizedExpertEmail}`
                : sql`false`
            )
          );
        for (const link of inviteLinks) {
          candidates.push({
            userId: link.raId || null,
            email: link.recruitedBy || null,
            recruitedAt: link.usedAt ? new Date(link.usedAt) : link.createdAt ? new Date(link.createdAt) : null,
            source: link.expertId === expert.id ? "expertInvitationLinks.expertId" : "expertInvitationLinks.candidateEmail",
          });
        }

        const resolvedCandidates = await Promise.all(
          candidates.map(async (candidate) => {
            const user = candidate.userId
              ? await storage.getUser(candidate.userId)
              : candidate.email
              ? await storage.getUserByEmail(candidate.email.trim().toLowerCase())
              : null;
            return { ...candidate, user };
          })
        );

        const resolved = resolvedCandidates
          .filter((candidate) => candidate.user)
          .sort((a, b) => (a.recruitedAt?.getTime() || 0) - (b.recruitedAt?.getTime() || 0))[0];

        if (!resolved?.user) {
          return {
            ...expert,
            recruitedAt: expert.sourcedAt || null,
            recruiterName: expert.recruiterName || null,
            recruiterEmail: expert.recruiterEmail || null,
          };
        }

        return {
          ...expert,
          recruitedAt: resolved.recruitedAt || expert.sourcedAt || expert.createdAt || null,
          recruiterName: resolved.user.fullName,
          recruiterEmail: resolved.user.email,
        };
      };

      const enrichedExpertsWithRecruiter = await Promise.all(
        expertsWithRecruiter.map((expert) => resolveExpertRecruiter(expert))
      );

      const total = Number(totalCount || 0);
      res.json({
        data: enrichedExpertsWithRecruiter,
        totalCount: total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (error) {
      console.error("Error fetching experts with recruiter:", error);
      res.status(500).json({ error: "Failed to fetch experts" });
    }
  });

  // =====================================================
  // SHORTLIST EXPORT ENDPOINT
  // Export experts with pipelineStatus = "interested" as CSV
  // Location: server/routes.ts - GET /api/projects/:projectId/export-shortlist
  // =====================================================
  app.get("/api/projects/:projectId/export-shortlist", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const projectId = parseInt(req.params.projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      // Authorization: admin and PM can export any project, RA only assigned projects
      if (!["admin", "pm"].includes(user.role)) {
        if (user.role === "ra") {
          // Check if RA is assigned to this project
          const project = await storage.getProject(projectId);
          const isAssigned = project?.assignedRaIds?.includes(user.id);
          if (!isAssigned) {
            return res.status(403).json({ error: "Access denied - not assigned to this project" });
          }
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Fetch all project experts with pipelineStatus = "interested" (shortlisted experts)
      const shortlistedExperts = await db
        .select({
          projectExpertId: projectExperts.id,
          expertId: projectExperts.expertId,
          angleIds: projectExperts.angleIds,
          pipelineStatus: projectExperts.pipelineStatus,
          respondedAt: projectExperts.respondedAt,
          lastActivityAt: projectExperts.lastActivityAt,
          assignedAt: projectExperts.assignedAt,
          sourcedByRaId: projectExperts.sourcedByRaId,
          expertName: experts.name,
          expertEmail: experts.email,
          expertJobTitle: experts.jobTitle,
          expertSourcedByRaId: experts.sourcedByRaId,
          expertSourcedAt: experts.sourcedAt,
        })
        .from(projectExperts)
        .innerJoin(experts, eq(projectExperts.expertId, experts.id))
        .where(
          and(
            eq(projectExperts.projectId, projectId),
            eq(projectExperts.pipelineStatus, "interested")
          )
        )
        .orderBy(experts.name);

      if (shortlistedExperts.length === 0) {
        return res.status(404).json({ error: "No shortlisted experts to export" });
      }

      // Fetch angles for the project to map IDs to names
      const angles = await db
        .select()
        .from(projectAngles)
        .where(eq(projectAngles.projectId, projectId));
      
      const angleMap = new Map(angles.map(a => [a.id, a.title]));

      // Fetch RA names for recruiting info
      const raIdSet = new Set(
        shortlistedExperts
          .map(e => e.expertSourcedByRaId || e.sourcedByRaId)
          .filter((id): id is number => id !== null)
      );
      const raIds = Array.from(raIdSet);
      
      let raMap = new Map<number, string>();
      if (raIds.length > 0) {
        const ras = await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, raIds));
        raMap = new Map(ras.map(r => [r.id, r.fullName]));
      }

      // Helper function to escape CSV fields
      const escapeCSV = (value: string | null | undefined): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // CSV headers
      const headers = [
        "Expert Name",
        "Email",
        "Title / Position",
        "Angles",
        "Status",
        "Last Activity / Onboarding Date",
        "Recruited By",
        "Recruited At",
        "Expert ID"
      ];

      // Build CSV rows
      const rows = shortlistedExperts.map(expert => {
        // Get angle names from IDs
        const angleNames = expert.angleIds
          ? expert.angleIds.map(id => angleMap.get(id) || `Angle ${id}`).join("; ")
          : "";
        
        // Determine last activity date
        const lastActivityDate = expert.lastActivityAt || expert.respondedAt || expert.assignedAt;
        const formattedDate = lastActivityDate 
          ? new Date(lastActivityDate).toISOString().split("T")[0]
          : "";

        // Get recruiter info (prefer expert-level, fallback to project-expert level)
        const recruiterId = expert.expertSourcedByRaId || expert.sourcedByRaId;
        const recruiterName = recruiterId ? raMap.get(recruiterId) || "" : "";
        
        const recruitedAt = expert.expertSourcedAt 
          ? new Date(expert.expertSourcedAt).toISOString().split("T")[0]
          : "";

        return [
          escapeCSV(expert.expertName),
          escapeCSV(expert.expertEmail),
          escapeCSV(expert.expertJobTitle),
          escapeCSV(angleNames),
          "Interested", // Status is always "Interested" for shortlisted
          escapeCSV(formattedDate),
          escapeCSV(recruiterName),
          escapeCSV(recruitedAt),
          String(expert.expertId)
        ].join(",");
      });

      // Combine headers and rows
      const csvContent = [headers.join(","), ...rows].join("\n");

      // Set response headers for CSV download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition", 
        `attachment; filename="shortlist_project_${projectId}.csv"`
      );
      res.send(csvContent);

    } catch (error) {
      console.error("Error exporting shortlist:", error);
      res.status(500).json({ error: "Failed to export shortlist" });
    }
  });

  // =====================================================
  // CLIENT SHORTLIST ENDPOINTS
  // Feature: Client-facing shortlist of accepted experts with employment history, VQ answers, and availability
  // Accepted status values: "interested", "shortlisted", "accepted" (excludes "declined", "completed")
  // Location: server/routes.ts
  // =====================================================

  // GET /api/projects/:projectId/client-shortlist
  // Returns accepted experts with full profile, employment history, VQ answers, and availability
  app.get("/api/projects/:projectId/client-shortlist", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const projectId = parseInt(req.params.projectId);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      // Authorization: admin and PM can access any project, RA only assigned projects
      if (!["admin", "pm"].includes(user.role)) {
        if (user.role === "ra") {
          const project = await storage.getProject(projectId);
          const isAssigned = project?.assignedRaIds?.includes(user.id);
          if (!isAssigned) {
            return res.status(403).json({ error: "Access denied - not assigned to this project" });
          }
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Get project details including vetting questions
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get project angles
      const projectAnglesList = await storage.getProjectAngles(projectId);
      const angleMap = new Map(projectAnglesList.map(a => [a.id, a.title]));

      // Get vetting questions for this project
      const vettingQuestionsList = await storage.getVettingQuestionsByProject(projectId);

      // Accepted status values (experts who accepted the consultation)
      const acceptedStatuses = ["interested", "shortlisted", "accepted", "scheduled"];

      // Fetch accepted experts with full details
      const acceptedExperts = await db
        .select({
          projectExpertId: projectExperts.id,
          expertId: projectExperts.expertId,
          pipelineStatus: projectExperts.pipelineStatus,
          angleIds: projectExperts.angleIds,
          vqAnswers: projectExperts.vqAnswers,
          availabilityNote: projectExperts.availabilityNote,
          availabilitySlots: projectExperts.availabilitySlots,
          respondedAt: projectExperts.respondedAt,
          // Expert details
          expertName: experts.name,
          expertEmail: experts.email,
          expertJobTitle: experts.jobTitle,
          expertCompany: experts.company,
          expertCountry: experts.country,
          expertCity: experts.city,
          expertTimezone: experts.timezone,
          expertYearsOfExperience: experts.yearsOfExperience,
          expertIndustry: experts.industry,
          expertExpertise: experts.expertise,
          expertWorkHistory: experts.workHistory,
          expertBiography: experts.biography,
        })
        .from(projectExperts)
        .innerJoin(experts, eq(projectExperts.expertId, experts.id))
        .where(
          and(
            eq(projectExperts.projectId, projectId),
            inArray(projectExperts.pipelineStatus, acceptedStatuses)
          )
        )
        .orderBy(desc(projectExperts.respondedAt));

      // Format the response data
      const clientShortlist = acceptedExperts.map(expert => {
        // Get angle names
        const angleNames = expert.angleIds
          ? expert.angleIds.map(id => angleMap.get(id) || `Angle ${id}`)
          : [];

        // Format employment history (most recent first)
        const workHistory = (expert.expertWorkHistory as Array<{ company: string; jobTitle: string; fromYear: number; toYear: number }>) || [];
        const sortedWorkHistory = [...workHistory].sort((a, b) => (b.toYear || 9999) - (a.toYear || 9999));

        // Format VQ answers - map question IDs to full questions
        const vqAnswersFormatted = vettingQuestionsList.map(vq => {
          const answer = expert.vqAnswers?.find(a => a.questionId === vq.id);
          return {
            questionId: vq.id,
            questionText: vq.question,
            answerText: answer?.answerText || null,
            angleName: vq.angleId ? angleMap.get(vq.angleId) : null,
          };
        });

        // Format availability slots
        const availabilitySlots = (expert.availabilitySlots as Array<{ date: string; startTime: string; endTime: string; timezone: string }>) || [];

        return {
          projectExpertId: expert.projectExpertId,
          expertId: expert.expertId,
          pipelineStatus: expert.pipelineStatus,
          angles: angleNames,
          respondedAt: expert.respondedAt,
          // Basic profile
          profile: {
            name: expert.expertName,
            email: expert.expertEmail,
            jobTitle: expert.expertJobTitle,
            company: expert.expertCompany,
            location: [expert.expertCity, expert.expertCountry].filter(Boolean).join(", ") || null,
            timezone: expert.expertTimezone,
            yearsOfExperience: expert.expertYearsOfExperience,
            industry: expert.expertIndustry,
            expertise: expert.expertExpertise,
            biography: expert.expertBiography,
          },
          // Employment history
          employmentHistory: sortedWorkHistory.slice(0, 5), // Show up to 5 most recent roles
          // VQ answers
          vettingAnswers: vqAnswersFormatted,
          // Availability
          availability: {
            note: expert.availabilityNote,
            slots: availabilitySlots,
          },
        };
      });

      res.json({
        projectId,
        projectTitle: project.title,
        totalExperts: clientShortlist.length,
        experts: clientShortlist,
      });

    } catch (error) {
      console.error("Error fetching client shortlist:", error);
      res.status(500).json({ error: "Failed to fetch client shortlist" });
    }
  });

  // GET /api/projects/:projectId/client-shortlist-export
  // Generates PDF export of client shortlist
  app.get("/api/projects/:projectId/client-shortlist-export", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const projectId = parseInt(req.params.projectId);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      // Authorization: admin and PM can access any project, RA only assigned projects
      if (!["admin", "pm"].includes(user.role)) {
        if (user.role === "ra") {
          const project = await storage.getProject(projectId);
          const isAssigned = project?.assignedRaIds?.includes(user.id);
          if (!isAssigned) {
            return res.status(403).json({ error: "Access denied - not assigned to this project" });
          }
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get project angles
      const projectAnglesList = await storage.getProjectAngles(projectId);
      const angleMap = new Map(projectAnglesList.map(a => [a.id, a.title]));

      // Get vetting questions for this project
      const vettingQuestionsList = await storage.getVettingQuestionsByProject(projectId);

      // Accepted status values
      const acceptedStatuses = ["interested", "shortlisted", "accepted", "scheduled"];

      // Fetch accepted experts
      const acceptedExperts = await db
        .select({
          projectExpertId: projectExperts.id,
          expertId: projectExperts.expertId,
          pipelineStatus: projectExperts.pipelineStatus,
          angleIds: projectExperts.angleIds,
          vqAnswers: projectExperts.vqAnswers,
          availabilityNote: projectExperts.availabilityNote,
          availabilitySlots: projectExperts.availabilitySlots,
          expertName: experts.name,
          expertEmail: experts.email,
          expertJobTitle: experts.jobTitle,
          expertCompany: experts.company,
          expertCountry: experts.country,
          expertCity: experts.city,
          expertTimezone: experts.timezone,
          expertYearsOfExperience: experts.yearsOfExperience,
          expertIndustry: experts.industry,
          expertWorkHistory: experts.workHistory,
        })
        .from(projectExperts)
        .innerJoin(experts, eq(projectExperts.expertId, experts.id))
        .where(
          and(
            eq(projectExperts.projectId, projectId),
            inArray(projectExperts.pipelineStatus, acceptedStatuses)
          )
        )
        .orderBy(desc(projectExperts.respondedAt));

      if (acceptedExperts.length === 0) {
        return res.status(404).json({ error: "No accepted experts to export" });
      }

      // Generate PDF using PDFKit
      const doc = new PDFDocument({ 
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="client_shortlist_project_${projectId}.pdf"`
      );

      // Pipe PDF to response
      doc.pipe(res);

      // Title page
      doc.fontSize(24).font("Helvetica-Bold").text("Client Shortlist", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font("Helvetica").text(project.title, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor("#666666").text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
      doc.fillColor("#000000");
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Total Experts: ${acceptedExperts.length}`, { align: "center" });
      doc.moveDown(2);

      // Add each expert
      acceptedExperts.forEach((expert, index) => {
        // Add new page for each expert after the first
        if (index > 0) {
          doc.addPage();
        }

        // Expert header
        doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a1a1a");
        doc.text(expert.expertName || "Unknown Expert");
        doc.moveDown(0.3);
        
        // Title and company
        if (expert.expertJobTitle || expert.expertCompany) {
          doc.fontSize(12).font("Helvetica").fillColor("#333333");
          const titleCompany = [expert.expertJobTitle, expert.expertCompany].filter(Boolean).join(" at ");
          doc.text(titleCompany);
        }

        // Location and experience
        const location = [expert.expertCity, expert.expertCountry].filter(Boolean).join(", ");
        if (location || expert.expertYearsOfExperience) {
          doc.fontSize(11).fillColor("#666666");
          const details = [];
          if (location) details.push(location);
          if (expert.expertYearsOfExperience) details.push(`${expert.expertYearsOfExperience} years experience`);
          if (expert.expertTimezone) details.push(expert.expertTimezone);
          doc.text(details.join(" | "));
        }

        // Angles
        if (expert.angleIds && expert.angleIds.length > 0) {
          const angleNames = expert.angleIds.map(id => angleMap.get(id) || `Angle ${id}`).join(", ");
          doc.fontSize(10).fillColor("#0066cc").text(`Angles: ${angleNames}`);
        }

        doc.moveDown(1);
        doc.fillColor("#000000");

        // Section 1: Employment History
        doc.fontSize(14).font("Helvetica-Bold").text("Employment History");
        doc.moveDown(0.3);

        const workHistory = (expert.expertWorkHistory as Array<{ company: string; jobTitle: string; fromYear: number; toYear: number }>) || [];
        const sortedHistory = [...workHistory].sort((a, b) => (b.toYear || 9999) - (a.toYear || 9999));

        if (sortedHistory.length > 0) {
          doc.fontSize(11).font("Helvetica");
          sortedHistory.slice(0, 5).forEach((job, i) => {
            const years = job.toYear 
              ? `${job.fromYear} - ${job.toYear}`
              : `${job.fromYear} - Present`;
            doc.fillColor("#333333").text(`${job.jobTitle}`, { continued: true });
            doc.fillColor("#666666").text(` at ${job.company} (${years})`);
          });
        } else {
          doc.fontSize(11).font("Helvetica-Oblique").fillColor("#999999").text("No employment history available");
        }

        doc.moveDown(1);
        doc.fillColor("#000000");

        // Section 2: Vetting Questions & Answers
        doc.fontSize(14).font("Helvetica-Bold").text("Vetting Questions & Answers");
        doc.moveDown(0.3);

        if (vettingQuestionsList.length > 0) {
          doc.fontSize(11).font("Helvetica");
          vettingQuestionsList.forEach((vq, i) => {
            const answer = expert.vqAnswers?.find((a: any) => a.questionId === vq.id);
            const angleName = vq.angleId ? angleMap.get(vq.angleId) : null;
            
            // Question
            doc.font("Helvetica-Bold").fillColor("#333333");
            const questionPrefix = angleName ? `[${angleName}] ` : "";
            doc.text(`Q${i + 1}: ${questionPrefix}${vq.question}`);
            
            // Answer
            doc.font("Helvetica").fillColor("#444444");
            const answerText = answer?.answerText || "No answer provided";
            doc.text(`A${i + 1}: ${answerText}`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(11).font("Helvetica-Oblique").fillColor("#999999").text("No vetting questions for this project");
        }

        doc.moveDown(0.5);
        doc.fillColor("#000000");

        // Section 3: Availability
        doc.fontSize(14).font("Helvetica-Bold").text("Availability");
        doc.moveDown(0.3);

        const availabilitySlots = (expert.availabilitySlots as Array<{ date: string; startTime: string; endTime: string; timezone: string }>) || [];

        if (availabilitySlots.length > 0) {
          doc.fontSize(11).font("Helvetica");
          availabilitySlots.forEach(slot => {
            doc.fillColor("#333333").text(`${slot.date}, ${slot.startTime} - ${slot.endTime} (${slot.timezone})`);
          });
        } else if (expert.availabilityNote) {
          doc.fontSize(11).font("Helvetica").fillColor("#333333").text(expert.availabilityNote);
        } else {
          doc.fontSize(11).font("Helvetica-Oblique").fillColor("#999999").text("No availability submitted yet");
        }

        // Add horizontal line separator if not last expert
        if (index < acceptedExperts.length - 1) {
          doc.moveDown(2);
        }
      });

      // Finalize PDF
      doc.end();

    } catch (error) {
      console.error("Error exporting client shortlist:", error);
      res.status(500).json({ error: "Failed to export client shortlist" });
    }
  });

  return httpServer;
}
