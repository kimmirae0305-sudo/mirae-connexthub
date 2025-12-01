import express from "express";
import path from "path";

const app = express();

// 정적 파일 제공: client 폴더
app.use(express.static(path.join(__dirname, "../client")));

// SPA fallback: 어떤 경로든 index.html로
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client", "index.html"));
});

// 포트 설정
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
