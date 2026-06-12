function getInviteBaseUrl() {
  return (import.meta.env.VITE_PUBLIC_INVITE_BASE_URL || window.location.origin).replace(/\/+$/, "");
}

export function resolveInviteUrl(inviteUrl?: string | null) {
  if (!inviteUrl) return "";
  if (/^https?:\/\//i.test(inviteUrl)) return inviteUrl;
  if (inviteUrl.startsWith("/r/")) return `${getInviteBaseUrl()}${inviteUrl}`;
  return `${window.location.origin}${inviteUrl}`;
}

export function buildPublicRecruitmentUrl(token: string) {
  return `${getInviteBaseUrl()}/r/${token}`;
}
