import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";
import { EXAM_PORTAL_MAX_STARTS } from "../../db/migrations/index.js";
import { parseDateRangePeriod, buildIstanbulDateFilterSql } from "../../utils/dateRange.js";
import { normalizeEducationCodeValue, isValidEducationCode } from "../../services/education/payload.js";
import { signExamPortalLink } from "../../examPortalLinkToken.js";
import { fetchCertificateRowContext, fetchCertificateListRows, normalizeCompletionFilter } from "../../services/exam/adminQueries.js";
import { fetchExamSuccessPaymentRows } from "../../services/exam/successPayments.js";
import { allocateCertificateDocumentNumber } from "../../services/certificate/serial.js";
import { prepareEdevletExcelExport } from "../../services/certificate/edevletExcel.js";
import { buildCertificateBulkZip } from "../../services/certificate/bulkPdf.js";
import { resolveCertificateEducationLanguage } from "../../utils/nationalId.js";

const router = Router();

router.get("/api/admin/exam-portal/visits", auth, checkPermission("examPortalAccess", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim().toLowerCase();
    const searchParam = search ? `%${search}%` : "";
    const period = parseDateRangePeriod(req.query.period);
    const dateFilter = buildIstanbulDateFilterSql("created_at", period);
    const countSql = `SELECT COUNT(*)::int AS total FROM exam_portal_visits
      WHERE ($1::text = '' OR LOWER(CONCAT(COALESCE(portal_url,''), ' ', COALESCE(education_code,''), ' ', COALESCE(national_id,''), ' ', COALESCE(participant_name,''))) LIKE $1)${dateFilter}`;
    const listSql = `SELECT * FROM exam_portal_visits
      WHERE ($1::text = '' OR LOWER(CONCAT(COALESCE(portal_url,''), ' ', COALESCE(education_code,''), ' ', COALESCE(national_id,''), ' ', COALESCE(participant_name,''))) LIKE $1)${dateFilter}
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, [searchParam]),
      pool.query(listSql, [searchParam, pageSize, offset]),
    ]);
    return res.json({
      data: listResult.rows.map(toApiObject),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/admin/exam-portal/visits/:id", auth, checkPermission("examPortalAccess", "can_delete"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const previous = await pool.query(`SELECT * FROM exam_portal_visits WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    await pool.query(`DELETE FROM exam_portal_visits WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName: "examPortalAccess", entityId: id, oldData: previous.rows[0] });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/api/admin/exam-portal/test-token", auth, checkPermission("examQuestions", "can_view"), async (req, res, next) => {
  try {
    let educationCode;
    try {
      educationCode = normalizeEducationCodeValue(req.body?.educationCode);
    } catch (e) {
      return res.status(400).json({ message: e.message || "Geçersiz eğitim kodu." });
    }
    const token = signExamPortalLink({
      educationCode,
      nationalId: "34949322398",
      participantName: "Kadir Danışan",
    });
    const path = `/sinavportali/${encodeURIComponent(token)}`;
    return res.json({ portalToken: token, path });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/exam-portal/limit-exceeded", auth, checkPermission("examPortalAccess", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim().toLowerCase();
    const searchParam = search ? `%${search}%` : "";
    const period = parseDateRangePeriod(req.query.period);
    const attemptDateFilter = buildIstanbulDateFilterSql("started_at", period);
    const groupedSql = `
        SELECT
          UPPER(TRIM(ea.education_code)) AS education_code,
          ea.national_id,
          COUNT(*)::int AS start_count
        FROM exam_attempts ea
        WHERE 1=1${attemptDateFilter}
        GROUP BY UPPER(TRIM(ea.education_code)), ea.national_id
        HAVING COUNT(*)::int >= $1`;
    const withParticipantSql = `
        SELECT
          grouped.education_code,
          grouped.national_id,
          grouped.start_count,
          (
            SELECT TRIM(ea2.participant_name)
            FROM exam_attempts ea2
            WHERE UPPER(TRIM(ea2.education_code)) = grouped.education_code
              AND ea2.national_id = grouped.national_id
              AND ea2.participant_name IS NOT NULL
              AND TRIM(ea2.participant_name) <> ''
            ORDER BY ea2.started_at DESC
            LIMIT 1
          ) AS participant_name
        FROM (${groupedSql}) grouped`;
    const countSql = `SELECT COUNT(*)::int AS total FROM (
        SELECT *
        FROM (${withParticipantSql}) rows_with_name
        WHERE ($2::text = '' OR LOWER(CONCAT(
          COALESCE(rows_with_name.education_code,''), ' ',
          COALESCE(rows_with_name.national_id,''), ' ',
          COALESCE(rows_with_name.participant_name,''), ' ',
          rows_with_name.start_count::text
        )) LIKE $2)
      ) t`;
    const listSql = `SELECT education_code, national_id, start_count, participant_name FROM (
        SELECT *
        FROM (${withParticipantSql}) rows_with_name
        WHERE ($2::text = '' OR LOWER(CONCAT(
          COALESCE(rows_with_name.education_code,''), ' ',
          COALESCE(rows_with_name.national_id,''), ' ',
          COALESCE(rows_with_name.participant_name,''), ' ',
          rows_with_name.start_count::text
        )) LIKE $2)
      ) filtered
      ORDER BY education_code ASC, national_id ASC
      LIMIT $3 OFFSET $4`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, [EXAM_PORTAL_MAX_STARTS, searchParam]),
      pool.query(listSql, [EXAM_PORTAL_MAX_STARTS, searchParam, pageSize, offset]),
    ]);
    return res.json({
      data: listResult.rows.map((row) => ({
        educationCode: row.education_code,
        nationalId: row.national_id,
        startCount: row.start_count,
        participantName: String(row.participant_name || "").trim(),
      })),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/admin/exam-portal/limit-exceeded", auth, checkPermission("examPortalAccess", "can_delete"), async (req, res, next) => {
  try {
    const educationCode = String(req.body?.educationCode || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const nationalId = String(req.body?.nationalId || "").trim();
    if (!isValidEducationCode(educationCode)) {
      return res.status(400).json({ message: "Geçerli eğitim kodu gerekli (ör. GZM-1-32-03)." });
    }
    if (!/^\d{11}$/.test(nationalId)) {
      return res.status(400).json({ message: "T.C. kimlik no 11 haneli olmalıdır." });
    }
    const del = await pool.query(
      `DELETE FROM exam_attempts WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2`,
      [educationCode, nationalId],
    );
    await writeActivityLog({
      req,
      action: "delete",
      moduleName: "examPortalAccess",
      entityId: `${educationCode}-${nationalId}`,
      oldData: { educationCode, nationalId, deletedAttempts: del.rowCount },
    });
    return res.json({ deletedAttempts: del.rowCount });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/admin/exam-success-payments/:id/payment-received", auth, checkPermission("examSuccessPayments", "can_update"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const markPaid = req.body?.paymentReceived === true || req.body?.paymentReceived === "true";
    if (!markPaid) {
      return res.status(400).json({ message: "Yalnızca ödeme alındı olarak işaretlenebilir (paymentReceived: true)." });
    }
    const previousResult = await pool.query(`SELECT * FROM exam_portal_best_scores WHERE id = $1 LIMIT 1`, [id]);
    const previous = previousResult.rows[0];
    if (!previous) return res.status(404).json({ message: "Kayıt bulunamadı." });
    if (Number(previous.best_score) < 60) {
      return res.status(400).json({ message: "Ödeme yalnızca sınavdan ≥60 alan kayıtlar için işaretlenebilir." });
    }
    if (previous.payment_received === true) {
      const api = toApiObject(previous);
      return res.json({
        ...api,
        certificateEligible: true,
      });
    }
    const result = await pool.query(
      `UPDATE exam_portal_best_scores SET payment_received = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    await writeActivityLog({
      req,
      action: "update",
      moduleName: "examSuccessPayments",
      entityId: id,
      oldData: previous,
      newData: row,
    });
    const api = toApiObject(row);
    return res.json({
      ...api,
      certificateEligible: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/exam-success-payments", auth, checkPermission("examSuccessPayments", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const searchRaw = String(req.query.search || "").trim();
    const period = parseDateRangePeriod(req.query.period);
    const { total, rows } = await fetchExamSuccessPaymentRows({ search: searchRaw, period, page, pageSize });
    return res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/admin/exam-results/:id/payment-received", auth, checkPermission("examResults", "can_update"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const markPaid = req.body?.paymentReceived === true || req.body?.paymentReceived === "true";
    if (!markPaid) {
      return res.status(400).json({ message: "Yalnizca odeme alindi olarak isaretlenebilir (paymentReceived: true)." });
    }
    const previousResult = await pool.query(`SELECT * FROM exam_portal_best_scores WHERE id = $1 LIMIT 1`, [id]);
    const previous = previousResult.rows[0];
    if (!previous) return res.status(404).json({ message: "Kayıt bulunamadı." });
    if (previous.payment_received === true) {
      const api = toApiObject(previous);
      return res.json({
        ...api,
        certificateEligible: Number(previous.best_score) >= 60,
      });
    }
    const result = await pool.query(
      `UPDATE exam_portal_best_scores SET payment_received = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    await writeActivityLog({
      req,
      action: "update",
      moduleName: "examResults",
      entityId: id,
      oldData: previous,
      newData: row,
    });
    const api = toApiObject(row);
    return res.json({
      ...api,
      certificateEligible: Number(row.best_score) >= 60,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/exam-results", auth, checkPermission("examResults", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const searchRaw = String(req.query.search || "").trim();
    const educationCodeRaw = String(req.query.educationCode || "").trim().toUpperCase();
    const nationalIdRaw = String(req.query.nationalId || "").trim();
    const certificateOnly = ["1", "true", "yes"].includes(String(req.query.certificateOnly || "").toLowerCase());
    const period = parseDateRangePeriod(req.query.period);

    const params = [];
    const conditions = [];

    if (educationCodeRaw) {
      params.push(`%${educationCodeRaw.toLowerCase()}%`);
      conditions.push(`LOWER(b.education_code) LIKE $${params.length}`);
    }
    if (nationalIdRaw) {
      const digits = nationalIdRaw.replace(/\D/g, "");
      if (digits.length) {
        params.push(`%${digits}%`);
        conditions.push(`b.national_id LIKE $${params.length}`);
      }
    }
    if (searchRaw) {
      params.push(`%${searchRaw.toLowerCase()}%`);
      conditions.push(
        `LOWER(CONCAT(COALESCE(b.education_code,''), ' ', COALESCE(b.national_id,''), ' ', COALESCE(b.participant_name,''), ' ', COALESCE(latest_attempt.participant_name,''))) LIKE $${params.length}`,
      );
    }
    if (certificateOnly) {
      conditions.push(`b.best_score >= 60`);
    }

    const dateFilter = buildIstanbulDateFilterSql("COALESCE(b.best_recorded_at, b.updated_at)", period);
    const joinSql = `
      FROM exam_portal_best_scores b
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
    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}${dateFilter}` : dateFilter ? `WHERE 1=1${dateFilter}` : "";
    const countSql = `SELECT COUNT(*)::int AS total ${joinSql} ${whereSql}`;
    const listSql = `SELECT b.*,
            COALESCE(NULLIF(TRIM(b.participant_name), ''), NULLIF(TRIM(latest_attempt.participant_name), ''), '') AS participant_name
     ${joinSql}
     ${whereSql}
     ORDER BY b.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
    ]);
    return res.json({
      data: listResult.rows.map((row) => {
        const api = toApiObject(row);
        return {
          ...api,
          participantName: String(row.participant_name || api.participantName || "").trim(),
          certificateEligible: Number(row.best_score) >= 60,
        };
      }),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/certificate-list/edevlet-export", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const searchRaw = String(req.query.search || "").trim();
    const period = parseDateRangePeriod(req.query.period);
    const completion = normalizeCompletionFilter(req.query.completion);
    const { total, rows } = await fetchCertificateListRows({ search: searchRaw, period, completion });
    return res.json({ data: rows, total });
  } catch (error) {
    next(error);
  }
});

router.post("/api/admin/certificate-list/edevlet-export/prepare", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const result = await prepareEdevletExcelExport(ids);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/api/admin/certificate-list/bulk-pdf", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const result = await buildCertificateBulkZip(ids);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.setHeader("X-Bulk-Success-Count", String(result.successCount));
    res.setHeader("X-Bulk-Failed-Count", String(result.failures.length));
    res.setHeader("X-Bulk-Skipped-Count", String(result.skipped.length));
    if (result.failures.length || result.skipped.length) {
      const summary = {
        failures: result.failures.slice(0, 20),
        skipped: result.skipped.slice(0, 20),
      };
      res.setHeader("X-Bulk-Summary", encodeURIComponent(JSON.stringify(summary)));
    }
    return res.send(result.zipBytes);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message || "Toplu sertifika oluşturulamadı.",
        failures: error.failures || [],
        skipped: error.skipped || [],
      });
    }
    next(error);
  }
});

router.get("/api/admin/certificate-list", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const searchRaw = String(req.query.search || "").trim();
    const period = parseDateRangePeriod(req.query.period);
    const completion = normalizeCompletionFilter(req.query.completion);
    const { total, rows } = await fetchCertificateListRows({ search: searchRaw, period, completion, page, pageSize });
    return res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/admin/certificate-list/:id/edevlet-processed", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const markProcessed = req.body?.edevletProcessed === true || req.body?.edevletProcessed === "true";
    if (!markProcessed) {
      return res.status(400).json({ message: "Yalnızca E-devlete işlendi olarak işaretlenebilir (edevletProcessed: true)." });
    }
    const previousResult = await pool.query(
      `SELECT * FROM exam_portal_best_scores
       WHERE id = $1 AND payment_received = TRUE AND best_score >= 60
       LIMIT 1`,
      [id],
    );
    const previous = previousResult.rows[0];
    if (!previous) {
      return res.status(404).json({ message: "Kayıt bulunamadı veya sertifika için uygun değil." });
    }
    if (previous.edevlet_processed === true) {
      return res.json(toApiObject(previous));
    }
    const result = await pool.query(
      `UPDATE exam_portal_best_scores
       SET edevlet_processed = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    await writeActivityLog({
      req,
      action: "update",
      moduleName: "certificateList",
      entityId: id,
      oldData: previous,
      newData: row,
    });
    return res.json(toApiObject(row));
  } catch (error) {
    next(error);
  }
});

router.post("/api/admin/certificate-list/:id/generate-pdf", auth, checkPermission("certificateList", "can_view"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const row = await fetchCertificateRowContext(id);
    if (!row) {
      return res.status(404).json({
        message: "Kayıt bulunamadı veya sertifika için uygun değil (ödeme alınmış ve ≥60 puan gerekir).",
      });
    }
    if (row.edevlet_processed === true) {
      return res.status(400).json({
        message: "Bu sertifika E-devlete işlenmiş. Tekrar hazırlanamaz.",
      });
    }

    const { buildCertificatePdf } = await import("../../certificatePdf.js");
    const { buildCertificateBilingualFields } = await import("../../certificateTranslation.js");
    const participantName = String(row.participant_name || "").trim();
    const birthInfo = resolveCertificateEducationLanguage(row.participant_country);
    const educationCategory = String(row.education_category || "").trim() || "—";
    const bilingual = await buildCertificateBilingualFields({
      educationName: row.education_name || row.education_code,
      educationCategory,
      examTargetDifficulty: row.exam_target_difficulty,
    });

    const documentNumber = await allocateCertificateDocumentNumber(row.id);

    const { pdfBytes, fileName } = await buildCertificatePdf({
      id: row.id,
      nationalId: row.national_id,
      fullName: participantName || "—",
      birthInfo,
      educationCode: row.education_code,
      educationName: bilingual.educationNameLine,
      educationCategory: bilingual.educationCategoryLine,
      level: bilingual.levelLine,
      issuePlace: "Gazi Üniversitesi\nUzaktan Eğitim Uyg.\nve Arş. Merkezi",
      controlDate: row.best_recorded_at,
      programStartDate: row.education_created_at,
      programEndDate: row.last_attempt_at,
      duration: row.education_duration,
      documentNumber,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    next(error);
  }
});

router.delete("/api/admin/exam-results/:id", auth, checkPermission("examResults", "can_delete"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const previous = await pool.query(`SELECT * FROM exam_portal_best_scores WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    await pool.query(`DELETE FROM exam_portal_best_scores WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName: "examResults", entityId: id, oldData: previous.rows[0] });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
