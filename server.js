// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 기본 진입: 학생용으로 리다이렉트
app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// ---------- PostgreSQL 연결 설정 ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render의 Postgres(External URL) 사용 시 필요
  ssl: { rejectUnauthorized: false },
});

// ---------- 항상 먼저 테이블 만들어 주는 함수 ----------
async function ensureTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS sel_results (
      id SERIAL PRIMARY KEY,
      student_code TEXT NOT NULL,      -- 코드(반-번호)
      grade_group TEXT NOT NULL,       -- "34" / "56"
      answers JSON NOT NULL,           -- 학생 응답(JSON 배열)
      result_type TEXT,                -- "overall" / "byDomain"
      overall_level TEXT,              -- red / yellow / green
      domain_levels JSON,              -- 역량별 신호등 JSON
      guidance TEXT,                   -- 교사용 세부 지도 포인트
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await pool.query(createSql);
}

// =====================================================
// 1) 학생 결과 저장 API
// =====================================================
app.post("/api/sel/results", async (req, res) => {
  try {
    await ensureTable(); // 🔥 저장하기 전에 테이블부터 만든다

    const {
      studentCode,
      gradeGroup,
      answers,
      resultType,
      overallLevel,
      domainLevels,
      guidance,
    } = req.body;

    const insertSql = `
      INSERT INTO sel_results
        (student_code, grade_group, answers, result_type, overall_level, domain_levels, guidance)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const params = [
      studentCode,
      gradeGroup,
      JSON.stringify(answers || []),
      resultType || null,
      overallLevel || null,
      domainLevels ? JSON.stringify(domainLevels) : null,
      guidance || null,
    ];

    const result = await pool.query(insertSql, params);
    res.json({ ok: true, result: result.rows[0] });
  } catch (err) {
    console.error("INSERT ERROR:", err);
    res.status(500).json({ error: "db_insert_error" });
  }
});

// =====================================================
// 2) 교사용 조회 API
// =====================================================
app.get("/api/sel/results", async (req, res) => {
  try {
    await ensureTable(); // 🔥 조회하기 전에 테이블부터 만든다

    const { gradeGroup, studentCode } = req.query;

    let sql = `SELECT * FROM sel_results WHERE 1=1`;
    const params = [];

    if (gradeGroup) {
      params.push(gradeGroup);
      sql += ` AND grade_group = $${params.length}`;
    }

    if (studentCode) {
      params.push(`%${studentCode}%`);
      sql += ` AND student_code ILIKE $${params.length}`;
    }

    sql += ` ORDER BY id DESC`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("SELECT ERROR:", err);
    res.status(500).json({ error: "db_select_error" });
  }
});

// -----------------------------------------------------
// 서버 실행
// -----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEL app server running on http://localhost:${PORT}`);
});
