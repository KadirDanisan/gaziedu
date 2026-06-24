import pool from "../../db/pool.js";

const fetchCertificateRowContext = async (id) => {
  const result = await pool.query(
    `SELECT b.*,
            COALESCE(
              NULLIF(TRIM(b.participant_name), ''),
              NULLIF(TRIM(latest_attempt.participant_name), ''),
              ''
            ) AS participant_name,
            COALESCE(ae.name, ed.name, ec.education_name, '') AS education_name,
            COALESCE(cat_ed.category_name, cat_ec.category_name, cat_ae.category_name, '') AS education_category,
            COALESCE(exam_cfg.exam_target_difficulty, 'medium') AS exam_target_difficulty,
            COALESCE(ed.duration, ec.duration, '') AS education_duration,
            COALESCE(ed.created_at, ae.created_at, ec.created_at) AS education_created_at,
            d.country_code AS participant_country
     FROM exam_portal_best_scores b
     LEFT JOIN normal_user_details d ON d.national_id = b.national_id
     LEFT JOIN approved_educations ae ON UPPER(TRIM(ae.code)) = UPPER(TRIM(b.education_code))
     LEFT JOIN educations ed ON UPPER(TRIM(ed.code)) = UPPER(TRIM(b.education_code))
     LEFT JOIN education_calendar ec ON UPPER(TRIM(ec.code)) = UPPER(TRIM(b.education_code))
     LEFT JOIN education_categories cat_ed ON cat_ed.id = ed.category_id
     LEFT JOIN education_categories cat_ec ON cat_ec.id = ec.category_id
     LEFT JOIN education_categories cat_ae ON cat_ae.id = ae.category_id
     LEFT JOIN LATERAL (
       SELECT TRIM(participant_name) AS participant_name
       FROM exam_attempts ea
       WHERE UPPER(TRIM(ea.education_code)) = UPPER(TRIM(b.education_code))
         AND ea.national_id = b.national_id
         AND ea.status = 'completed'
         AND ea.participant_name IS NOT NULL
         AND TRIM(ea.participant_name) <> ''
       ORDER BY ea.submitted_at DESC NULLS LAST, ea.started_at DESC
       LIMIT 1
     ) latest_attempt ON TRUE
     LEFT JOIN LATERAL (
       SELECT eq.exam_target_difficulty
       FROM exam_questions eq
       INNER JOIN educations e ON e.id = eq.education_id
       WHERE UPPER(TRIM(e.code)) = UPPER(TRIM(b.education_code))
         AND eq.generated_questions IS NOT NULL
       ORDER BY eq.updated_at DESC
       LIMIT 1
     ) exam_cfg ON TRUE
     WHERE b.id = $1
       AND b.payment_received = TRUE
       AND b.best_score >= 60
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
};

export { fetchCertificateRowContext };
