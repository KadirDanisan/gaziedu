import { Router } from "express";
import pool from "../../db/pool.js";
import { verifyExamPortalLink } from "../../examPortalLinkToken.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { EXAM_PORTAL_MAX_STARTS } from "../../db/migrations/index.js";
import {
  normalizeExamQuestionPool,
  pickExamQuestions,
  publicExamQuestion,
  gradeExamAttempt,
} from "../../services/exam/engine.js";
import { EXAM_SECONDS_PER_QUESTION } from "../../services/exam/constants.js";
import { upsertExamPortalBestScore } from "../../services/exam/portal.js";

const router = Router();

router.post("/api/public/exam-portal/validate-token", async (req, res, next) => {
  try {
    const portalToken = String(req.body?.portalToken || "").trim();
    const out = verifyExamPortalLink(portalToken);
    return res.json({
      educationCode: out.educationCode,
      nationalId: out.nationalId,
      participantName: out.participantName,
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ message: error.message || "Geçersiz bağlantı." });
  }
});

router.post("/api/public/exam-portal/visit", async (req, res, next) => {
  try {
    const portalToken = String(req.body?.portalToken || "").trim();
    if (!portalToken) {
      return res.status(400).json({ message: "Geçerli sınav bağlantısı (portalToken) gerekli." });
    }
    let educationCode;
    let nationalId;
    let participantName = "";
    try {
      const v = verifyExamPortalLink(portalToken);
      educationCode = v.educationCode;
      nationalId = v.nationalId;
      participantName = v.participantName;
    } catch (e) {
      const status = e.statusCode || 401;
      return res.status(status).json({ message: e.message || "Geçersiz bağlantı." });
    }

    const portalUrl = String(req.body?.portalUrl || "").trim().slice(0, 2048);
    const safeUrl = portalUrl.length ? portalUrl : `/sinavportali/${encodeURIComponent(portalToken)}`;
    const insert = await pool.query(
      `INSERT INTO exam_portal_visits (portal_url, education_code, national_id, participant_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, portal_url, education_code, national_id, participant_name, created_at`,
      [safeUrl, educationCode, nationalId, String(participantName || "").trim().slice(0, 200) || null],
    );
    return res.status(201).json(toApiObject(insert.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/api/public/exam-portal/start", async (req, res, next) => {
  try {
    const portalToken = String(req.body?.portalToken || "").trim();
    if (!portalToken) {
      return res.status(400).json({ message: "Geçerli sınav bağlantısı (portalToken) gerekli." });
    }
    let educationCode;

    let nationalId;
    let participantName = "";
    try {
      const v = verifyExamPortalLink(portalToken);
      educationCode = v.educationCode;

      nationalId = v.nationalId;
      participantName = v.participantName;
    } catch (e) {
      const status = e.statusCode || 401;
      return res.status(status).json({ message: e.message || "Geçersiz bağlantı." });
    }

    const attemptsCheck = await pool.query(
      `SELECT COUNT(*)::int AS c FROM exam_attempts WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2`,
      [educationCode, nationalId],
    );

    if (Number(attemptsCheck.rows[0]?.c || 0) >= EXAM_PORTAL_MAX_STARTS) {
      return res.status(403).json({
        message: `Bu eğitim (${educationCode}) için sınav başlatma hakkınız doldu (en fazla ${EXAM_PORTAL_MAX_STARTS} oturum).`,
      });
    }

    const educationResult = await pool.query(
      `SELECT id, name, code, duration
       FROM educations
       WHERE UPPER(code) = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [educationCode],
    );
    const education = educationResult.rows[0];
    if (!education) {
      return res.status(404).json({ message: "Bu eğitim kodu ile eğitim bulunamadı." });
    }

    const questionResult = await pool.query(
      `SELECT eq.id, eq.generated_questions, eq.exam_target_difficulty, eq.exam_question_count, eq.pool_question_count,
              eq.updated_at, e.id AS education_id, e.name AS education_name, e.code AS education_code, e.duration AS education_duration
       FROM exam_questions eq
       INNER JOIN educations e ON e.id = eq.education_id
       WHERE UPPER(e.code) = $1
         AND eq.generated_questions IS NOT NULL
       ORDER BY eq.updated_at DESC, e.updated_at DESC
       LIMIT 1`,
      [educationCode],
    );
    const questionSet = questionResult.rows[0];
    if (!questionSet?.generated_questions) {
      return res.status(404).json({ message: "Bu eğitim için sınav soruları henüz hazırlanmamış." });
    }
    const effectiveEducation = {
      id: questionSet.education_id || education.id,
      name: questionSet.education_name || education.name,
      code: questionSet.education_code || education.code,
      duration: questionSet.education_duration || education.duration,
    };

    const poolQuestions = normalizeExamQuestionPool(questionSet.generated_questions);
    const targetDifficulty = String(questionSet.exam_target_difficulty || "medium").toLowerCase();
    const difficultyKey = ["easy", "medium", "hard"].includes(targetDifficulty) ? targetDifficulty : "medium";
    const examQuestionCount = Math.min(200, Math.max(1, parseInt(questionSet.exam_question_count, 10) || 20));
    const bucket = poolQuestions[difficultyKey] || [];
    if (bucket.length < examQuestionCount) {
      return res.status(400).json({
        message: `Bu zorluk seviyesi (${difficultyKey}) için havuzda yeterli soru yok (${bucket.length}/${examQuestionCount}).`,
      });
    }

    const selectedQuestions = pickExamQuestions(poolQuestions, difficultyKey, examQuestionCount);
    const durationSeconds = selectedQuestions.length * EXAM_SECONDS_PER_QUESTION;
    const attemptResult = await pool.query(
      `INSERT INTO exam_attempts
        (education_id, exam_question_id, education_code, national_id, participant_name, selected_questions)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, started_at`,
      [
        effectiveEducation.id,
        questionSet.id,
        educationCode,
        nationalId,
        String(participantName || "").trim().slice(0, 200) || null,
        JSON.stringify(selectedQuestions),
      ],
    );
    const attempt = attemptResult.rows[0];

    return res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      durationSeconds,
      education: {
        id: effectiveEducation.id,
        code: effectiveEducation.code,
        title: effectiveEducation.name,
        duration: effectiveEducation.duration || "",
      },
      questionCount: selectedQuestions.length,
      questions: selectedQuestions.map(publicExamQuestion),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/public/exam-portal/:attemptId/submit", async (req, res, next) => {
  try {
    const attemptId = String(req.params.attemptId || "").trim();
    const reason = String(req.body?.reason || "manual").trim().slice(0, 64) || "manual";
    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    const previousResult = await pool.query(
      `SELECT id, education_code, national_id, participant_name, selected_questions, started_at, status, correct_count, wrong_count, blank_count, score, duration_seconds
       FROM exam_attempts
       WHERE id = $1
       LIMIT 1`,
      [attemptId],
    );
    const previous = previousResult.rows[0];
    if (!previous) return res.status(404).json({ message: "Sınav oturumu bulunamadı." });
    if (previous.status === "completed") {
      return res.json({
        attemptId: previous.id,
        status: previous.status,
        correctCount: previous.correct_count,
        wrongCount: previous.wrong_count,
        blankCount: previous.blank_count,
        score: Number(previous.score),
        durationSeconds: previous.duration_seconds,
      });
    }

    const selectedQuestions = typeof previous.selected_questions === "string"
      ? JSON.parse(previous.selected_questions)
      : previous.selected_questions;
    const graded = gradeExamAttempt(Array.isArray(selectedQuestions) ? selectedQuestions : [], answers);
    const startedAt = new Date(previous.started_at).getTime();
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    const qCount = Array.isArray(selectedQuestions) ? selectedQuestions.length : 0;
    const maxAllowedSeconds = Math.max(EXAM_SECONDS_PER_QUESTION, qCount * EXAM_SECONDS_PER_QUESTION);
    const durationSeconds = Math.min(maxAllowedSeconds, elapsed);
    const result = await pool.query(
      `UPDATE exam_attempts
       SET answers = $2::jsonb,
           correct_count = $3,
           wrong_count = $4,
           blank_count = $5,
           score = $6,
           duration_seconds = $7,
           status = 'completed',
           submit_reason = $8,
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, correct_count, wrong_count, blank_count, score, duration_seconds, submitted_at`,
      [
        attemptId,
        JSON.stringify(graded.normalizedAnswers),
        graded.correctCount,
        graded.wrongCount,
        graded.blankCount,
        graded.score,
        durationSeconds,
        reason,
      ],
    );
    const row = result.rows[0];
    await upsertExamPortalBestScore({
      educationCode: previous.education_code,
      nationalId: previous.national_id,
      attemptScore: graded.score,
      participantName: previous.participant_name,
    });
    return res.json({
      attemptId: row.id,
      status: row.status,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      blankCount: row.blank_count,
      score: Number(row.score),
      durationSeconds: row.duration_seconds,
      submittedAt: row.submitted_at,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
