const PUBLIC_INVITE_BASE_URL =
  (import.meta.env.VITE_PUBLIC_INVITE_BASE_URL || "https://invite.miraeconnext.com").replace(/\/+$/, "");

export function resolveInviteUrl(inviteUrl?: string | null) {
  if (!inviteUrl) return "";
  if (/^https?:\/\//i.test(inviteUrl)) return inviteUrl;
  if (inviteUrl.startsWith("/r/")) return `${PUBLIC_INVITE_BASE_URL}${inviteUrl}`;
  return `${window.location.origin}${inviteUrl}`;
}

export function buildPublicRecruitmentUrl(token: string) {
  return `${PUBLIC_INVITE_BASE_URL}/r/${token}`;
}
