import pool from "../../db/pool.js";
import { parseDateRangePeriod, buildIstanbulDateFilterSql } from "../../utils/dateRange.js";
import { toApiObject } from "../../utils/apiTransform.js";

const certificateListJoinSql = `
  FROM exam_portal_best_scores b
  LEFT JOIN normal_user_details d ON d.national_id = b.national_id
  LEFT JOIN approved_educations ae ON UPPER(TRIM(ae.code)) = UPPER(TRIM(b.education_code))
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
`;

const normalizeCompletionFilter = (value) => {
  const raw = String(value || "all").trim().toLowerCase();
  if (raw === "completed" || raw === "done" || raw === "tamamlanan") return "completed";
  if (raw === "incomplete" || raw === "pending" || raw === "tamamlanmamis" || raw === "tamamlanmamış") {
    return "incomplete";
  }
  return "all";
};

const buildCertificateListFilters = (searchRaw, period, completion = "all") => {
  const params = [];
  const conditions = ["b.payment_received = TRUE", "b.best_score >= 60"];
  const completionKey = normalizeCompletionFilter(completion);

  if (completionKey === "completed") {
    conditions.push("b.edevlet_processed = TRUE");
  } else if (completionKey === "incomplete") {
    conditions.push("b.edevlet_processed = FALSE");
  }

  if (searchRaw) {
    params.push(`%${searchRaw.toLowerCase()}%`);
    conditions.push(
      `LOWER(CONCAT(COALESCE(b.education_code,''), ' ', COALESCE(b.national_id,''), ' ', COALESCE(b.participant_name,''), ' ', COALESCE(latest_attempt.participant_name,''), ' ', COALESCE(ae.name,''))) LIKE $${params.length}`,
    );
  }

  const dateFilter = buildIstanbulDateFilterSql("b.best_recorded_at", parseDateRangePeriod(period));
  return {
    params,
    whereSql: `WHERE ${conditions.join(" AND ")}${dateFilter}`,
  };
};

const mapCertificateListRow = (row) => {
  const api = toApiObject(row);
  return {
    ...api,
    participantName: String(row.participant_name || "").trim(),
    educationName: String(row.education_name || "").trim(),
    documentNumber: String(row.document_number || api.documentNumber || "").trim() || null,
    edevletProcessed: Boolean(row.edevlet_processed ?? api.edevletProcessed),
    edevletExcelExported: Boolean(row.edevlet_excel_exported ?? api.edevletExcelExported),
    edevletExcelRowId: row.edevlet_excel_row_id != null ? Number(row.edevlet_excel_row_id) : api.edevletExcelRowId ?? null,
    edevletExcelUuid: String(row.edevlet_excel_uuid || api.edevletExcelUuid || "").trim() || null,
    certificateEligible: true,
  };
};

const fetchCertificateListRows = async ({ search = "", period = "all", completion = "all", page, pageSize } = {}) => {
  const searchRaw = String(search || "").trim();
  const { params, whereSql } = buildCertificateListFilters(searchRaw, period, completion);

  const countSql = `SELECT COUNT(*)::int AS total ${certificateListJoinSql} ${whereSql}`;
  const countResult = await pool.query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  let listSql = `SELECT b.*,
            COALESCE(NULLIF(TRIM(b.participant_name), ''), NULLIF(TRIM(latest_attempt.participant_name), ''), '') AS participant_name,
            COALESCE(ae.name, '') AS education_name
     ${certificateListJoinSql}
     ${whereSql}
     ORDER BY b.best_recorded_at DESC, b.education_code ASC, b.national_id ASC`;

  const listParams = [...params];
  if (page != null && pageSize != null) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Number(pageSize) || 20);
    const offset = (safePage - 1) * safePageSize;
    listSql += ` LIMIT $${listParams.length + 1} OFFSET $${listParams.length + 2}`;
    listParams.push(safePageSize, offset);
  }

  const listResult = await pool.query(listSql, listParams);
  return {
    total,
    rows: listResult.rows.map(mapCertificateListRow),
  };
};

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

export { fetchCertificateRowContext, fetchCertificateListRows, normalizeCompletionFilter };
