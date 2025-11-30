import path from "path";
import fs from "fs";
import express from "express";

export function serveStatic(app: express.Application) {
  // 1) SPA 빌드가 있는 실제 경로
  // dist/public/index.html 구조를 정확히 타겟팅
  const distPath = path.join(process.cwd(), "dist", "public");

  // 2) 모든 나머지 경로 처리
  app.get("*", (req, res) => {
    const indexPath = path.join(distPath, "index.html");

    // dist/public/index.html이 존재하면 SPA 리턴
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // 존재하지 않으면 백엔드의 기본 응답
    return res.send("Mirae ConnextHub backend is live (no SPA build).");
  });
}




