import pool from "../../db/pool.js";
import { isValidEducationCode } from "../education/payload.js";
import { EXAM_PORTAL_MAX_STARTS } from "../../db/migrations/index.js";

const upsertExamPortalBestScore = async ({ educationCode, nationalId, attemptScore, participantName }) => {
  const code = String(educationCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const tc = String(nationalId || "").trim();
  const newScore = Number(attemptScore);
  const name = String(participantName || "").trim().slice(0, 200);
  if (!isValidEducationCode(code) || !/^\d{11}$/.test(tc) || !Number.isFinite(newScore)) return;
  await pool.query(
    `INSERT INTO exam_portal_best_scores (education_code, national_id, best_score, best_recorded_at, last_attempt_at, last_score, participant_name)
     VALUES ($1, $2, $3, NOW(), NOW(), $3, NULLIF($4, ''))
     ON CONFLICT (education_code, national_id) DO UPDATE SET
       best_score = GREATEST(exam_portal_best_scores.best_score, EXCLUDED.last_score),
       best_recorded_at = CASE
         WHEN EXCLUDED.last_score > exam_portal_best_scores.best_score THEN NOW()
         ELSE exam_portal_best_scores.best_recorded_at
       END,
       last_attempt_at = NOW(),
       last_score = EXCLUDED.last_score,
       participant_name = COALESCE(NULLIF(EXCLUDED.participant_name, ''), exam_portal_best_scores.participant_name),
       updated_at = NOW()`,
    [code, tc, newScore, name],
  );
};

const getExamPortalAccessState = async (educationCode, nationalId) => {
  const code = String(educationCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const tc = String(nationalId || "").trim();
  const maxAttempts = EXAM_PORTAL_MAX_STARTS;

  if (!code || !tc) {
    return {
      attemptsUsed: 0,
      attemptsRemaining: maxAttempts,
      maxAttempts,
      bestScore: null,
      alreadyPassed: false,
      limitExceeded: false,
    };
  }

  const [attemptsResult, bestResult, maxAttemptScoreResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS c
       FROM exam_attempts
       WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2`,
      [code, tc],
    ),
    pool.query(
      `SELECT best_score
       FROM exam_portal_best_scores
       WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2
       LIMIT 1`,
      [code, tc],
    ),
    pool.query(
      `SELECT MAX(score)::float AS max_score
       FROM exam_attempts
       WHERE UPPER(TRIM(education_code)) = $1
         AND national_id = $2
         AND status = 'completed'
         AND score IS NOT NULL`,
      [code, tc],
    ),
  ]);

  const attemptsUsed = Number(attemptsResult.rows[0]?.c || 0);
  const bestFromTable = bestResult.rows[0]?.best_score == null ? null : Number(bestResult.rows[0].best_score);
  const bestFromAttempts =
    maxAttemptScoreResult.rows[0]?.max_score == null ? null : Number(maxAttemptScoreResult.rows[0].max_score);
  const bestScore =
    bestFromTable == null && bestFromAttempts == null
      ? null
      : Math.max(bestFromTable ?? Number.NEGATIVE_INFINITY, bestFromAttempts ?? Number.NEGATIVE_INFINITY);
  const alreadyPassed = Number.isFinite(bestScore) && bestScore >= 60;
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);
  const limitExceeded = !alreadyPassed && attemptsUsed >= maxAttempts;

  return {
    attemptsUsed,
    attemptsRemaining,
    maxAttempts,
    bestScore,
    alreadyPassed,
    limitExceeded,
  };
};

export { upsertExamPortalBestScore, getExamPortalAccessState };
