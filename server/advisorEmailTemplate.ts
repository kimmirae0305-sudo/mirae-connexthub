type AdvisorEmailRenderOptions = {
  body: string;
  senderName?: string | null;
  senderEmail?: string | null;
  logoUrl?: string | null;
};

const BRAND_NAME = "Mirae Connext";
const MIRAE_EMAIL = "mirae@miraeconnext.com";
const WEBSITE_URL = "http://www.miraeconnext.com";
const WEBSITE_LABEL = "www.miraeconnext.com";

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

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getSenderSignatureProfile(senderName?: string | null, senderEmail?: string | null) {
  const email = normalizeEmail(senderEmail);
  const name = String(senderName || "").trim();
  const senderFirstName = getSenderFirstName(name, email);
  const isMirae = email === MIRAE_EMAIL || /^mirae\b/i.test(name);

  if (isMirae) {
    return {
      closingName: "Mirae",
      displayName: "Mirae K.",
      title: `Co Founder & COO | ${BRAND_NAME}`,
      mobile: "+55 11 95500 7861",
      email: MIRAE_EMAIL,
    };
  }

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

function renderFooterHtml(options: AdvisorEmailRenderOptions) {
  const profile = getSenderSignatureProfile(options.senderName, options.senderEmail);
  const logoHtml = options.logoUrl
    ? `<img src="${escapeHtml(options.logoUrl)}" alt="${BRAND_NAME}" width="132" style="display:block;border:0;outline:none;text-decoration:none;width:132px;max-width:132px;height:auto;" />`
    : `<div style="font-size:18px;line-height:20px;font-weight:700;color:#111827;margin:0;">${BRAND_NAME}</div>`;
  const emailHtml = profile.email
    ? `<div style="margin:0;">Email: <a href="mailto:${escapeHtml(profile.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(profile.email)}</a></div>`
    : "";
  const mobileHtml = profile.mobile
    ? `<div style="margin:0;">Mobile: ${escapeHtml(profile.mobile)}</div>`
    : "";
  const titleHtml = profile.title
    ? `<div style="margin:0;color:#374151;">${escapeHtml(profile.title)}</div>`
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
            <div style="margin:0 0 2px 0;font-size:13px;line-height:18px;font-weight:700;color:#111827;">${escapeHtml(profile.displayName)}</div>
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
      ${renderFooterHtml(options)}
    </div>
  </body>
</html>`;
}
