type AdvisorEmailRenderOptions = {
  body: string;
  senderName?: string | null;
  senderEmail?: string | null;
  logoUrl?: string | null;
};

const BRAND_NAME = "Mirae Connext";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getSenderFirstName(senderName?: string | null, senderEmail?: string | null) {
  const name = String(senderName || "").trim();
  if (name) return name.split(/\s+/)[0] || name;

  const emailLocalPart = String(senderEmail || "").split("@")[0]?.trim();
  if (emailLocalPart) return emailLocalPart.split(/[._-]/)[0] || emailLocalPart;

  return "";
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

function renderFooterHtml(options: AdvisorEmailRenderOptions) {
  const senderFirstName = getSenderFirstName(options.senderName, options.senderEmail);
  const closingName = senderFirstName || BRAND_NAME;
  const logoHtml = options.logoUrl
    ? `<img src="${escapeHtml(options.logoUrl)}" alt="${BRAND_NAME}" width="148" style="display:block;border:0;outline:none;text-decoration:none;max-width:148px;height:auto;margin:0 0 8px 0;" />`
    : `<div style="font-size:18px;line-height:22px;font-weight:700;color:#111827;margin:0 0 8px 0;">${BRAND_NAME}</div>`;

  return `
    <div style="margin-top:24px;color:#111827;">
      <div style="margin:0 0 4px 0;">Best regards,</div>
      <div style="margin:0 0 20px 0;">${escapeHtml(closingName)}</div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;">
      ${logoHtml}
      <div style="font-size:13px;line-height:18px;color:#374151;font-weight:600;">${BRAND_NAME}</div>
      <div style="font-size:12px;line-height:18px;color:#6b7280;margin-top:2px;">Global expert consultations</div>
      ${options.senderEmail ? `<div style="font-size:12px;line-height:18px;color:#6b7280;margin-top:8px;">${escapeHtml(options.senderEmail)}</div>` : ""}
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
      ${renderFooterHtml(options)}
    </div>
  </body>
</html>`;
}
