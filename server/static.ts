import type { Express } from "express";
import express from "express";
import fs from "fs";
import path from "path";

const PUBLIC_INVITE_TITLE = "Mirae Connext | Expert Consultation Invitation";
const PUBLIC_INVITE_DESCRIPTION =
  "You have been invited to review a confidential expert consultation opportunity and complete your advisor profile securely.";

function isPublicInviteRoute(pathname: string) {
  return /^\/r\/[^/]+\/?$/.test(pathname) || /^\/public\/advisor-project-review\/[^/]+\/?$/.test(pathname);
}

function replaceOrInsertMeta(html: string, pattern: RegExp, replacement: string) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function injectPublicInviteMetadata(html: string) {
  let updatedHtml = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${PUBLIC_INVITE_TITLE}</title>`,
  );

  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${PUBLIC_INVITE_DESCRIPTION}" />`,
  );
  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${PUBLIC_INVITE_TITLE}" />`,
  );
  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${PUBLIC_INVITE_DESCRIPTION}" />`,
  );
  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="website" />`,
  );
  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${PUBLIC_INVITE_TITLE}" />`,
  );
  updatedHtml = replaceOrInsertMeta(
    updatedHtml,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${PUBLIC_INVITE_DESCRIPTION}" />`,
  );

  return updatedHtml;
}

export function serveStatic(app: Express) {
  const clientPath = path.join(__dirname, "../client");
  const indexPath = path.join(clientPath, "index.html");

  app.use(express.static(clientPath));

  app.get("*", (req, res) => {
    if (isPublicInviteRoute(req.path)) {
      const html = fs.readFileSync(indexPath, "utf-8");
      res.type("html").send(injectPublicInviteMetadata(html));
      return;
    }

    res.sendFile(indexPath);
  });
}
