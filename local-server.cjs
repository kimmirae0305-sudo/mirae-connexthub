// local-server.cjs
const path = require("path");
const express = require("express");

const app = express();

// 포트: 기본 3000
const PORT = process.env.PORT || 3000;

// 프로젝트 루트 경로
const ROOT_DIR = __dirname;

// ✅ 빌드된 프론트가 있는 폴더 (dist/public)
const PUBLIC_DIR = path.join(ROOT_DIR, "dist", "public");

// 정적 파일 서빙
app.use(express.static(PUBLIC_DIR));

// 어떤 경로로 들어와도 dist/public/index.html 반환
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Local dev server running at http://localhost:${PORT}`);
});
