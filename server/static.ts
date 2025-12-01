import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  const clientPath = path.join(__dirname, "../client");

  // 정적 파일 제공
  app.use(express.static(clientPath));

  // 모든 경로 → client/index.html 반환
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}





