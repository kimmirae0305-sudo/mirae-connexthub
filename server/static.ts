import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM 환경에서 __filename / __dirname 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Application) {
  // dist 폴더 위치 (나중에 SPA 빌드하면 여기에 들어가게 만들면 됨)
  const distRoot = path.resolve(__dirname, "..", "dist");
  const indexPath = path.join(distRoot, "index.html");

  console.log("Static root:", distRoot);

  // dist 폴더가 존재하는 경우에만 정적 파일 서빙
  if (fs.existsSync(distRoot)) {
    app.use(express.static(distRoot));
  }

  // 모든 나머지 경로 처리
  app.get("*", (_req, res) => {
    // 1) SPA가 실제로 빌드되어 있으면 index.html 서빙
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // 2) 아직 SPA 빌드가 없으면, 간단한 텍스트 응답
    return res
      .status(200)
      .type("text/plain")
      .send("Mirae ConnextHub backend is live (no SPA build yet).");
  });
}


