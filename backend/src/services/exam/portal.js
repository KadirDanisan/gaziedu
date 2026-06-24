import pool from "../../db/pool.js";
import { isValidEducationCode } from "../education/payload.js";

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

export { upsertExamPortalBestScore };
