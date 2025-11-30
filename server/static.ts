import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM 환경에서 __filename / __dirname 다시 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Application) {
  // 후보 경로들:
  // 1) 프로젝트 루트의 dist
  // 2) client/dist (빌드가 client 쪽으로 나오는 경우 대비)
  const candidates = [
    path.resolve(__dirname, "..", "dist"),
    path.resolve(__dirname, "..", "client", "dist"),
  ];

  // 실제로 index.html 이 존재하는 dist 폴더 찾기
  const distRoot =
    candidates.find((root) =>
      fs.existsSync(path.join(root, "index.html")),
    ) ?? candidates[0];

  console.log("Serving static files from:", distRoot);

  // 정적 파일 서빙
  app.use(express.static(distRoot));

  // 어떤 경로로 들어와도 SPA index.html 반환
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distRoot, "index.html"));
  });
}

