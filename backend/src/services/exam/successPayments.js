import pool from "../../db/pool.js";
import { parseDateRangePeriod, buildIstanbulDateFilterSql } from "../../utils/dateRange.js";
import { toApiObject } from "../../utils/apiTransform.js";

const successPaymentsJoinSql = `
  FROM exam_portal_best_scores b
  LEFT JOIN approved_educations ae ON UPPER(TRIM(ae.code)) = UPPER(TRIM(b.education_code))
  LEFT JOIN LATERAL (
    SELECT TRIM(participant_name) AS participant_name
    FROM exam_attempts ea
    WHERE UPPER(TRIM(ea.education_code)) = UPPER(TRIM(b.education_code))
      AND ea.national_id = b.national_id
      AND ea.participant_name IS NOT NULL
      AND TRIM(ea.participant_name) <> ''
    ORDER BY ea.submitted_at DESC NULLS LAST, ea.started_at DESC
    LIMIT 1
  ) latest_attempt ON TRUE
`;

const buildSuccessPaymentsFilters = (searchRaw, period) => {
  const params = [];
  const conditions = ["b.best_score >= 60"];

  if (searchRaw) {
    params.push(`%${String(searchRaw).toLowerCase()}%`);
    conditions.push(
      `LOWER(CONCAT(COALESCE(b.education_code,''), ' ', COALESCE(b.national_id,''), ' ', COALESCE(b.participant_name,''), ' ', COALESCE(latest_attempt.participant_name,''), ' ', COALESCE(ae.name,''))) LIKE $${params.length}`,
    );
  }

  const dateFilter = buildIstanbulDateFilterSql("COALESCE(b.best_recorded_at, b.updated_at)", parseDateRangePeriod(period));
  return {
    params,
    whereSql: `WHERE ${conditions.join(" AND ")}${dateFilter}`,
  };
};

const mapSuccessPaymentRow = (row) => {
  const api = toApiObject(row);
  return {
    ...api,
    participantName: String(row.participant_name || "").trim(),
    educationName: String(row.education_name || "").trim(),
    certificateEligible: true,
  };
};

/**
 * Sınavda ≥60 alan kayıtlar (ödeme durumu fark etmeksizin).
 * Sertifika listesinden farkı: payment_received zorunlu değil.
 */
const fetchExamSuccessPaymentRows = async ({ search = "", period = "all", page, pageSize } = {}) => {
  const searchRaw = String(search || "").trim();
  const { params, whereSql } = buildSuccessPaymentsFilters(searchRaw, period);

  const countSql = `SELECT COUNT(*)::int AS total ${successPaymentsJoinSql} ${whereSql}`;
  const countResult = await pool.query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  let listSql = `SELECT b.*,
            COALESCE(NULLIF(TRIM(b.participant_name), ''), NULLIF(TRIM(latest_attempt.participant_name), ''), '') AS participant_name,
            COALESCE(ae.name, '') AS education_name
     ${successPaymentsJoinSql}
     ${whereSql}
     ORDER BY b.last_attempt_at DESC NULLS LAST, b.updated_at DESC, b.education_code ASC, b.national_id ASC`;

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
    rows: listResult.rows.map(mapSuccessPaymentRow),
  };
};

/**
 * Sınav özet kaydını siler ve silme kaydı bırakır; açılıştaki backfill
 * silme anından önceki denemelerden kaydı yeniden oluşturmaz.
 */
const deleteExamBestScore = async (id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deleted = await client.query(`DELETE FROM exam_portal_best_scores WHERE id = $1 RETURNING *`, [id]);
    const row = deleted.rows[0];
    if (row) {
      await client.query(
        `INSERT INTO exam_portal_best_score_deletions (education_code, national_id, deleted_at)
         VALUES (UPPER(TRIM($1)), TRIM($2), NOW())
         ON CONFLICT (education_code, national_id) DO UPDATE SET deleted_at = NOW()`,
        [row.education_code, row.national_id],
      );
    }
    await client.query("COMMIT");
    return row || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export { fetchExamSuccessPaymentRows, deleteExamBestScore };
