import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ESM 환경에서 __filename / __dirname 직접 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Application) {
  // ✅ 서버 폴더(server/) 기준으로 한 단계 올라가서 dist 사용
  const distPath = path.resolve(__dirname, "..", "dist");

  // dist 안의 정적 파일들 (assets, js 등)
  app.use(express.static(distPath));

  // ✅ 어떤 경로로 들어와도 SPA의 index.html 반환
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
