import type { Express } from "express";
import express from "express";
import fs from "fs";
import path from "path";

function resolveBuiltClientPath() {
  const candidates = [
    path.join(__dirname, "public"),
    path.join(process.cwd(), "dist", "public"),
  ];

  const builtClientPath = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html")),
  );

  if (!builtClientPath) {
    throw new Error("Built client assets were not found. Run npm run build:client before starting production.");
  }

  return builtClientPath;
}

export function serveStatic(app: Express) {
  const clientPath = resolveBuiltClientPath();
  const indexPath = path.join(clientPath, "index.html");

  app.use(
    express.static(clientPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        }

        if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        }
      },
    }),
  );

  app.get("*", (_req, res) => {
    res.sendFile(indexPath);
  });
}
