import type { AuthUser } from "./auth";

export type EmailSenderIdentity = {
  senderUserId: number | null;
  fromName: string;
  fromEmail: string;
  isValid: boolean;
  reason?: string;
};

const MIRAE_CONNEXT_EMAIL_DOMAIN = "miraeconnext.com";

function getFallbackNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  return localPart || "Mirae Connext";
}

export function resolveEmailSenderIdentity(user?: AuthUser | null): EmailSenderIdentity {
  if (!user) {
    return {
      senderUserId: null,
      fromName: "",
      fromEmail: "",
      isValid: false,
      reason: "Authenticated CRM user is required.",
    };
  }

  const fromEmail = String(user.email || "").trim().toLowerCase();
  if (!fromEmail) {
    return {
      senderUserId: user.id,
      fromName: String(user.fullName || "").trim(),
      fromEmail: "",
      isValid: false,
      reason: "Authenticated CRM user does not have an email address.",
    };
  }

  if (!fromEmail.endsWith(`@${MIRAE_CONNEXT_EMAIL_DOMAIN}`)) {
    return {
      senderUserId: user.id,
      fromName: String(user.fullName || "").trim() || getFallbackNameFromEmail(fromEmail),
      fromEmail,
      isValid: false,
      reason: "Authenticated CRM user email is not configured for Mirae Connext email sending.",
    };
  }

  return {
    senderUserId: user.id,
    fromName: String(user.fullName || "").trim() || getFallbackNameFromEmail(fromEmail),
    fromEmail,
    isValid: true,
  };
}
