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

// ---------- PostgreSQL 연결 ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render Postgres용
});

// ---------- 테이블 생성 함수 ----------
async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS sel_results (
      id SERIAL PRIMARY KEY,
      student_code TEXT NOT NULL,
      grade_group TEXT NOT NULL,
      answers JSON NOT NULL,
      result_type TEXT,
      overall_level TEXT,
      domain_levels JSON,
      guidance TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await pool.query(sql);
  console.log("✅ sel_results 테이블 확인/생성 완료");
}

// ---------- INSERT 재시도 도우미 ----------
async function safeInsert(sql, params) {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (err) {
    // 테이블 없음 에러면 → 테이블 만들고 한 번 더 시도
    if (err.code === "42P01") {
      console.log("⚠️ 테이블 없음 → 생성 후 재시도");
      await createTable();
      const result = await pool.query(sql, params);
      return result;
    }
    throw err;
  }
}

// ---------- SELECT 재시도 도우미 ----------
async function safeSelect(sql, params) {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (err) {
    if (err.code === "42P01") {
      console.log("⚠️ 테이블 없음 → 생성 후 빈 목록 반환");
      await createTable();
      return { rows: [] };
    }
    throw err;
  }
}

// =====================================================
// 1) 학생 결과 저장 API
// =====================================================
app.post("/api/sel/results", async (req, res) => {
  try {
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

    const result = await safeInsert(insertSql, params);
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

    const result = await safeSelect(sql, params);
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
