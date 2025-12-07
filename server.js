// server.js
const express = require("express");
const path = require("path");
const { Pool } = require("pg");   // PostgreSQL
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// 학생 화면
app.get("/student.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

// 교사 화면
app.get("/teacher.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "teacher.html"));
});


// ========= 결과 저장 =========
app.post("/api/sel/results", async (req, res) => {
  const {
    studentCode,
    gradeGroup,
    answers,
    resultType,
    overallLevel,
    domainLevels
  } = req.body;

  try {
    const query = `
      INSERT INTO sel_results(student_code, grade_group, answers, result_type, overall_level, domain_levels, created_at)
      VALUES($1,$2,$3,$4,$5,$6, NOW())
      RETURNING *;
    `;

    const result = await pool.query(query, [
      studentCode,
      gradeGroup,
      JSON.stringify(answers),
      resultType,
      overallLevel,
      JSON.stringify(domainLevels)
    ]);

    res.json({ ok: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB INSERT ERROR" });
  }
});

// ========= 결과 조회 =========
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
    sql += ` AND student_code LIKE $${params.length}`;
  }

  sql += " ORDER BY id DESC";

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB SELECT ERROR" });
  }
});


// ========= ★ 세부지도코멘트 저장 API 추가 =========
app.post("/api/sel/updateDetail", async (req, res) => {
  const { id, detail } = req.body;

  try {
    const result = await pool.query(
      `UPDATE sel_results SET detail=$1 WHERE id=$2 RETURNING *`,
      [detail, id]
    );
    res.json({ ok: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB UPDATE ERROR" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEL app server running on http://localhost:${PORT}`);
});
