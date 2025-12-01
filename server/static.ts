import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  // 빌드된 프론트가 들어있는 client 폴더 기준 경로
  const clientPath = path.join(__dirname, "../client");

  // 정적 파일 서빙 (CSS, JS, 이미지 등)
  app.use(express.static(clientPath));

  // SPA 라우트 처리: 어떤 경로로 들어와도 client/index.html 반환
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}





