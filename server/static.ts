import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ESM 환경에서 __filename / __dirname 직접 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Application) {
  const distPath = path.resolve(__dirname, "public");

  app.use(express.static(distPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
