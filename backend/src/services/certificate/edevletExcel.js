import crypto from "crypto";
import pool from "../../db/pool.js";
import { toApiObject } from "../../utils/apiTransform.js";

/** Manuel çıkarılan son satır ID'si; bir sonraki export 4000004 ile başlar. */
export const EDEVLET_EXCEL_SERIAL_SEED = 4000003;

const mapExportRow = (row) => {
  const api = toApiObject(row);
  return {
    ...api,
    participantName: String(row.participant_name || api.participantName || "").trim(),
    educationName: String(row.education_name || api.educationName || "").trim(),
    educationCode: String(row.education_code || api.educationCode || "").trim(),
    nationalId: String(row.national_id || api.nationalId || "").replace(/\D/g, ""),
    documentNumber: String(row.document_number || api.documentNumber || "").trim() || null,
    edevletExcelRowId: row.edevlet_excel_row_id != null ? Number(row.edevlet_excel_row_id) : null,
    edevletExcelUuid: String(row.edevlet_excel_uuid || "").trim() || null,
    edevletExcelExported: Boolean(row.edevlet_excel_exported),
  };
};

/**
 * Seçilen kayıtlardan daha önce Excel'e alınmamış olanlara sıralı A kolonu ID'si + C kolonu UUID atar.
 * Zaten export edilenler atlanır (yeni ID verilmez).
 */
export async function prepareEdevletExcelExport(ids = []) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    return { rows: [], skippedCount: 0, exportedCount: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const selected = await client.query(
      `SELECT b.id,
              b.education_code,
              b.national_id,
              b.best_score,
              b.best_recorded_at,
              b.document_number,
              b.edevlet_excel_exported,
              b.edevlet_excel_row_id,
              b.edevlet_excel_uuid,
              COALESCE(NULLIF(TRIM(b.participant_name), ''), '') AS participant_name,
              COALESCE(ae.name, '') AS education_name
       FROM exam_portal_best_scores b
       LEFT JOIN approved_educations ae ON UPPER(TRIM(ae.code)) = UPPER(TRIM(b.education_code))
       WHERE b.id = ANY($1::uuid[])
         AND b.payment_received = TRUE
         AND b.best_score >= 60
       ORDER BY b.best_recorded_at DESC, b.education_code ASC, b.national_id ASC
       FOR UPDATE OF b`,
      [uniqueIds],
    );

    const byId = new Map(selected.rows.map((row) => [String(row.id), row]));
    const ordered = uniqueIds.map((id) => byId.get(id)).filter(Boolean);

    const alreadyExported = ordered.filter((row) => row.edevlet_excel_exported === true);
    const pending = ordered.filter((row) => row.edevlet_excel_exported !== true);

    const prepared = [];
    for (const row of pending) {
      const next = await client.query(
        `UPDATE edevlet_excel_serial_state
         SET last_serial = last_serial + 1,
             updated_at = NOW()
         WHERE id = 1
         RETURNING last_serial`,
      );
      const serial = Number(next.rows[0]?.last_serial);
      if (!Number.isFinite(serial)) {
        throw new Error("E-devlet Excel sıra sayacı başlatılamadı.");
      }
      const uuid = crypto.randomUUID().toUpperCase();
      const updated = await client.query(
        `UPDATE exam_portal_best_scores
         SET edevlet_excel_exported = TRUE,
             edevlet_excel_row_id = $2,
             edevlet_excel_uuid = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, education_code, national_id, best_score, best_recorded_at, document_number,
                   edevlet_excel_exported, edevlet_excel_row_id, edevlet_excel_uuid, participant_name`,
        [row.id, serial, uuid],
      );
      const saved = updated.rows[0];
      prepared.push(
        mapExportRow({
          ...saved,
          education_name: row.education_name,
          participant_name: row.participant_name || saved.participant_name,
        }),
      );
    }

    await client.query("COMMIT");
    return {
      rows: prepared,
      skippedCount: alreadyExported.length,
      exportedCount: prepared.length,
      skippedIds: alreadyExported.map((row) => String(row.id)),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
