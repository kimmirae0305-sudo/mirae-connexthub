import path from "path";
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { ensureDatabaseCompatibility } from "./db";
import { serveStatic } from "./static";
import { createServer } from "http";
import { env } from 'process';

const app = express();

const allowedOrigins = [
  "https://miraeconnexthub.com",
  "https://www.miraeconnexthub.com",
  "https://miraeconnextconnexthub-frontend.onrender.com",
  "https://mirae-connexthub-server.onrender.com",
  "https://api.miraeconnexthub.com",
  "https://invite.miraeconnext.com",
  "https://www.invite.miraeconnext.com"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const publicInviteHosts = new Set(["invite.miraeconnext.com", "www.invite.miraeconnext.com"]);

function isAllowedPublicInvitePath(pathname: string) {
  return (
    /^\/r\/[^/]+\/?$/.test(pathname) ||
    /^\/public\/advisor-project-review\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith("/api/quick-invite/") ||
    pathname.startsWith("/api/public/advisor-project-review/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/attached_assets/") ||
    pathname === "/favicon.png" ||
    pathname === "/robots.txt" ||
    pathname === "/terms" ||
    pathname === "/privacy"
  );
}

app.use((req, res, next) => {
  const hostname = req.hostname.toLowerCase();

  if (publicInviteHosts.has(hostname) && !isAllowedPublicInvitePath(req.path)) {
    return res.status(404).send("Not found");
  }

  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function sanitizeResponseBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(sanitizeResponseBody);
  }

  if (body && typeof body === "object" && !(body instanceof Date) && !Buffer.isBuffer(body)) {
    return Object.fromEntries(
      Object.entries(body)
        .filter(([key]) => key !== "passwordHash")
        .map(([key, value]) => [key, sanitizeResponseBody(value)])
    );
  }

  return body;
}

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: unknown;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    const sanitizedBody = sanitizeResponseBody(bodyJson);
    capturedJsonResponse = sanitizedBody;
    return originalResJson.apply(res, [sanitizedBody, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;

      if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureDatabaseCompatibility();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
})();

const port = Number(process.env.PORT) || 5000;

httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
