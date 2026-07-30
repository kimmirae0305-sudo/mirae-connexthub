export const EXPERT_TERMS_VERSION = "2026-07-30";
export const PRIVACY_POLICY_VERSION = "2026-07-30";
export const POLICY_EFFECTIVE_DATE = "2026-07-30";

export const QUICK_INVITE_SUPPORTED_LANGUAGES = ["en", "pt-BR", "es"] as const;
export type QuickInviteSupportedLanguage = (typeof QUICK_INVITE_SUPPORTED_LANGUAGES)[number];

export const QUICK_INVITE_ORGANIZATION_CONFIG = {
  brandName: "Mirae Connext",
  legalContactEmail: "info@miraeconnext.com",
} as const;

export function isQuickInviteSupportedLanguage(
  value: unknown
): value is QuickInviteSupportedLanguage {
  return (
    typeof value === "string" &&
    QUICK_INVITE_SUPPORTED_LANGUAGES.includes(value as QuickInviteSupportedLanguage)
  );
}
