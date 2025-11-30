import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM 환경에서 __filename, __dirname 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Application) {
  // 실제 index.html 이 있을만한 후보 경로들
  const candidates = [
    // 1) dist/public (지금 구조와 가장 잘 맞는 후보)
    path.resolve(__dirname, "..", "dist", "public"),
    // 2) dist 루트
    path.resolve(__dirname, "..", "dist"),
    // 3) client/dist (혹시 향후 구조 바뀔 경우 대비)
    path.resolve(__dirname, "..", "client", "dist"),
  ];

  // index.html 이 실제로 존재하는 폴더 찾기
  const spaRoot =
    candidates.find((root) =>
      fs.existsSync(path.join(root, "index.html")),
    ) ?? candidates[0];

  console.log("Serving SPA from:", spaRoot);

  // 정적 파일 서빙
  app.use(express.static(spaRoot));

  // 나머지 모든 경로는 SPA index.html 로 처리
  app.get("*", (_req, res) => {
    res.sendFile(path.join(spaRoot, "index.html"));
  });
}



