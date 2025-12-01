import express from "express";
import path from "path";

const app = express();

// (기존에 있던 미들웨어, 라우트들 있으면 여기 그대로 두기)
// app.use(....);
// app.get("/api/...", ...);

// ✅ dist/public 정적 파일 서빙
const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ✅ 포트 설정
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});