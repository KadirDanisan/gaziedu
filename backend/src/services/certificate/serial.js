import pool from "../../db/pool.js";

/** e-Devlet uyumlu belge doğrulama kodu öneki (UN_041243C00001, …) */
export const CERTIFICATE_NUMBER_PREFIX = "UN_041243C";

const SERIAL_PAD_LENGTH = 5;

export function formatCertificateDocumentNumber(serial) {
  const value = Number(serial);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Geçersiz sertifika sıra numarası.");
  }
  return `${CERTIFICATE_NUMBER_PREFIX}${String(value).padStart(SERIAL_PAD_LENGTH, "0")}`;
}

/**
 * Sertifika hakedişi için sıralı belge numarası ayırır.
 * Aynı kayıt için tekrar çağrılırsa mevcut numarayı döndürür.
 */
export async function allocateCertificateDocumentNumber(bestScoreId) {
  const id = String(bestScoreId || "").trim();
  if (!id) {
    throw new Error("Sertifika kaydı bulunamadı.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT document_number
       FROM exam_portal_best_scores
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error("Sertifika kaydı bulunamadı.");
    }
    if (row.document_number) {
      await client.query("COMMIT");
      return String(row.document_number).trim();
    }

    const next = await client.query(
      `UPDATE certificate_serial_state
       SET last_serial = last_serial + 1,
           updated_at = NOW()
       WHERE id = 1
       RETURNING last_serial`,
    );
    const serial = next.rows[0]?.last_serial;
    if (!serial) {
      throw new Error("Sertifika sıra sayacı başlatılamadı.");
    }

    const documentNumber = formatCertificateDocumentNumber(serial);
    await client.query(
      `UPDATE exam_portal_best_scores
       SET document_number = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, documentNumber],
    );

    await client.query("COMMIT");
    return documentNumber;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
