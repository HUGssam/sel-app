// server.js
const express = require("express");
const path = require("path");
const app = express();

// ===== 기본 설정 =====
app.use(express.json());

// public 폴더를 정적 파일로 제공
app.use(express.static(path.join(__dirname, "public")));

// 기본 주소(/)로 들어오면 학생용 화면으로 이동
app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// 학생용 화면
app.get("/student.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

// 교사용 화면
app.get("/teacher.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "teacher.html"));
});

// ===== 간단한 메모리 저장소 (실전에서는 DB 사용 권장) =====
let results = [];
let idCounter = 1;

// ===== API: 결과 저장 =====
app.post("/api/sel/results", (req, res) => {
  const body = req.body || {};
  const {
    studentCode,
    gradeGroup,   // "34" or "56"
    answers,      // [1,2,3,4,...]
    resultType,   // "overall" or "byDomain"
    overallLevel, // "red"/"yellow"/"green" (3·4)
    domainLevels  // { "자기 인식": "green", ... } (5·6)
  } = body;

  // 간단한 검증
  if (!studentCode || !gradeGroup || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "잘못된 요청입니다." });
  }

  const newResult = {
    id: idCounter++,
    studentCode,
    gradeGroup,
    answers,
    resultType,
    overallLevel: overallLevel || null,
    domainLevels: domainLevels || null,
    createdAt: new Date().toISOString(),
  };

  results.push(newResult);
  res.json({ ok: true, result: newResult });
});

// ===== API: 결과 조회 (교사용) =====
app.get("/api/sel/results", (req, res) => {
  const { gradeGroup, studentCode } = req.query;

  let filtered = results.slice();

  if (gradeGroup) {
    filtered = filtered.filter((r) => r.gradeGroup === gradeGroup);
  }
  if (studentCode) {
    filtered = filtered.filter((r) =>
      String(r.studentCode).toLowerCase().includes(String(studentCode).toLowerCase())
    );
  }

  res.json(filtered);
});

// ===== 서버 실행 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEL app server running on http://localhost:${PORT}`);
});
