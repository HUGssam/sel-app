// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const app = express();

// ===== 기본 설정 =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ===== PostgreSQL 연결 =====
// Render 환경변수에서 DATABASE_URL 불러오기
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// DB 테이블 자동 생성
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        student_code VARCHAR(20),
        grade_group VARCHAR(10),
        answers TEXT,
        result_type VARCHAR(20),
        overall_level VARCHAR(20),
        domain_levels TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("DB 테이블 준비 완료");
  } catch (error) {
    console.error("DB 초기화 오류:", error);
  }
}
initDatabase();


// ===== 기본 URL → 학생 화면 =====
app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// ===== 학생/교사 페이지 라우트 =====
app.get("/student.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

app.get("/teacher.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "teacher.html"));
});


// ===========================================
// =============== API 영역 ==================
// ===========================================

// ===== API: 결과 저장 =====
app.post("/api/sel/results", async (req, res) => {
  const {
    studentCode,
    gradeGroup,
    answers,
    resultType,
    overallLevel,
    domainLevels
  } = req.body;

  if (!studentCode || !gradeGroup || !answers) {
    return res.status(400).json({ error: "필수 항목 누락" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO results (student_code, grade_group, answers, result_type, overall_level, domain_levels)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        studentCode,
        gradeGroup,
        JSON.stringify(answers),
        resultType,
        overallLevel,
        JSON.stringify(domainLevels)
      ]
    );

    res.json({ ok: true, result: result.rows[0] });
  } catch (error) {
    console.error("DB 저장 오류:", error);
    res.status(500).json({ error: "DB 저장 중 오류" });
  }
});

// ===== API: 결과 조회 (교사용) =====
app.get("/api/sel/results", async (req, res) => {
  const { gradeGroup, studentCode } = req.query;

  let query = "SELECT * FROM results WHERE 1=1";
  let params = [];

  if (gradeGroup) {
    params.push(gradeGroup);
    query += ` AND grade_group = $${params.length}`;
  }

  if (studentCode) {
    params.push(`%${studentCode.toLowerCase()}%`);
    query += ` AND LOWER(student_code) LIKE $${params.length}`;
  }

  query += " ORDER BY id DESC";

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("DB 조회 오류:", error);
    res.status(500).json({ error: "DB 조회 중 오류" });
  }
});


// ===========================================
// =============== 서버 실행 =================
// ===========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEL app server running on http://localhost:${PORT}`);
});
