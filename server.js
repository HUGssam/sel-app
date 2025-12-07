// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

// ----- 기본 설정 -----
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ----- PostgreSQL 연결 -----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// 간단한 헬퍼 함수
async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ----- 라우팅 -----
// 기본 주소는 학생 화면으로
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

// ===== 1) 결과 저장 API =====
app.post("/api/sel/results", async (req, res) => {
  const {
    studentCode,
    gradeGroup,   // "34" 또는 "56"
    answers,      // [1,2,3,...]
    resultType,   // "overall" / "byDomain"
    overallLevel, // "red" / "yellow" / "green"
    domainLevels  // { "자기 인식": "green", ... } 또는 null
  } = req.body || {};

  if (!studentCode || !gradeGroup || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "잘못된 요청입니다." });
  }

  try {
    const sql = `
      INSERT INTO sel_results
        (student_code, grade_group, answers, result_type, overall_level, domain_levels, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *;
    `;

    const result = await query(sql, [
      studentCode,
      gradeGroup,
      JSON.stringify(answers),
      resultType || null,
      overallLevel || null,
      domainLevels ? JSON.stringify(domainLevels) : null,
    ]);

    res.json({ ok: true, result: result.rows[0] });
  } catch (err) {
    console.error("INSERT ERROR:", err);
    res.status(500).json({ error: "서버 또는 DB 오류(저장)" });
  }
});

// ===== 2) 결과 조회 API =====
app.get("/api/sel/results", async (req, res) => {
  const { gradeGroup, studentCode } = req.query;

  let sql = "SELECT * FROM sel_results WHERE 1=1";
  const params = [];

  if (gradeGroup) {
    params.push(gradeGroup);
    sql += ` AND grade_group = $${params.length}`;
  }
  if (studentCode) {
    params.push(`%${studentCode}%`);
    sql += ` AND student_code ILIKE $${params.length}`;
  }

  sql += " ORDER BY id DESC";

  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("SELECT ERROR:", err);
    res.status(500).json({ error: "서버 또는 DB 오류(조회)" });
  }
});

// ===== 3) 세부 지도 포인트 저장 API =====
app.post("/api/sel/updateDetail", async (req, res) => {
  const { id, detail } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "id가 필요합니다." });
  }

  try {
    const result = await query(
      "UPDATE sel_results SET detail = $1 WHERE id = $2 RETURNING *;",
      [detail || null, id]
    );
    res.json({ ok: true, result: result.rows[0] });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: "서버 또는 DB 오류(업데이트)" });
  }
});

// ----- 서버 실행 -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEL app server running on http://localhost:${PORT}`);
});
