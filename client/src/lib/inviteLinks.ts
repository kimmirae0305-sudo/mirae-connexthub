function getInviteBaseUrl() {
  return (import.meta.env.VITE_PUBLIC_INVITE_BASE_URL || window.location.origin).replace(/\/+$/, "");
}

function isPublicInvitePath(inviteUrl: string) {
  return (
    inviteUrl.startsWith("/r/") ||
    inviteUrl.startsWith("/register/") ||
    inviteUrl.startsWith("/expert-invite/") ||
    inviteUrl.startsWith("/expert/project-invite/") ||
    inviteUrl.startsWith("/invite/") ||
    inviteUrl.startsWith("/public/advisor-project-review/") ||
    inviteUrl.startsWith("/public/expert-payment-details/")
  );
}

export function resolveInviteUrl(inviteUrl?: string | null) {
  if (!inviteUrl) return "";
  if (/^https?:\/\//i.test(inviteUrl)) return inviteUrl;
  if (isPublicInvitePath(inviteUrl)) return `${getInviteBaseUrl()}${inviteUrl}`;
  return `${window.location.origin}${inviteUrl}`;
}

export function buildPublicRecruitmentUrl(token: string) {
  return `${getInviteBaseUrl()}/r/${token}`;
}
