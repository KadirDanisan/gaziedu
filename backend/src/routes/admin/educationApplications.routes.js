import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isUuidParam } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { buildIstanbulDateFilterSql, parseDateRangePeriod } from "../../utils/dateRange.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { writeActivityLog } from "../../services/activityLog.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BULK_TEMPLATE_PATH = path.resolve(__dirname, "../../../assets/certificates/TopluBasvuruFormu.xlsx");
const BULK_MAX_ROWS_PER_REQUEST = 200;
const BULK_PAYMENT_METHOD = "toplu";

const computePayable = (price, hasDiscount, discountRate) => {
  const p = price != null && price !== "" ? Number(price) : null;
  if (p == null || Number.isNaN(p)) return null;
  if (!hasDiscount) return p;
  const rate = discountRate != null && discountRate !== "" ? Number(discountRate) : 0;
  if (!Number.isFinite(rate) || rate <= 0) return p;
  return Math.round(p * (1 - Math.min(100, rate) / 100) * 100) / 100;
};

const formatApplicationRow = (row) => {
  const price = row.price_snapshot != null ? Number(row.price_snapshot) : row.education_price != null ? Number(row.education_price) : null;
  const hasDiscount = row.has_discount_snapshot != null ? Boolean(row.has_discount_snapshot) : Boolean(row.education_has_discount);
  const discountRate =
    row.discount_rate_snapshot != null
      ? Number(row.discount_rate_snapshot)
      : row.education_discount_rate != null
        ? Number(row.education_discount_rate)
        : null;
  const payable =
    row.payable_amount != null
      ? Number(row.payable_amount)
      : computePayable(price, hasDiscount, discountRate);

  return {
    ...toApiObject(row),
    educationName: row.education_name || "",
    educationCode: row.education_code || "",
    price,
    hasDiscount,
    discountRate,
    payableAmount: payable,
    graduationDocPath: row.graduation_doc_path || "",
    kvkkDocPath: row.kvkk_doc_path || "",
    institutionDocPath: row.institution_doc_path || "",
    birthDate: row.birth_date || null,
    approvedAt: row.approved_at || null,
  };
};

router.get("/api/admin/education-applications", auth, checkPermission("educationApplications", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const educationId = String(req.query.educationId || "").trim();
    const nationalId = String(req.query.nationalId || "").replace(/\D/g, "");
    const status = String(req.query.status || "").trim().toLowerCase();
    const period = parseDateRangePeriod(req.query.period);
    const dateFilter = buildIstanbulDateFilterSql("a.created_at", period);

    const params = [];
    const conditions = [];

    if (isUuidParam(educationId)) {
      params.push(educationId);
      conditions.push(`a.education_id = $${params.length}`);
    }
    if (nationalId) {
      params.push(`%${escapeIlikePattern(nationalId)}%`);
      conditions.push(`a.national_id LIKE $${params.length}`);
    }
    if (status === "pending" || status === "approved") {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "WHERE TRUE";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM education_applications a
       ${whereSql}${dateFilter}`,
      params,
    );

    const listParams = [...params, pageSize, offset];
    const result = await pool.query(
      `SELECT a.*,
              e.name AS education_name,
              e.code AS education_code,
              e.price AS education_price,
              e.has_discount AS education_has_discount,
              e.discount_rate AS education_discount_rate
       FROM education_applications a
       LEFT JOIN educations e ON e.id = a.education_id
       ${whereSql}${dateFilter}
       ORDER BY a.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const total = countResult.rows[0]?.total || 0;
    return res.json({
      data: result.rows.map(formatApplicationRow),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/education-applications/educations", auth, checkPermission("educationApplications", "can_view"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT e.id, e.name, e.code
       FROM educations e
       INNER JOIN education_applications a ON a.education_id = e.id
       ORDER BY e.name ASC`,
    );
    return res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/api/admin/education-applications/bulk-educations",
  auth,
  checkPermission("educationApplications", "can_update"),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, name, code
         FROM educations
         WHERE LOWER(COALESCE(sales_filter, '')) = 'guzem-ucretli'
         ORDER BY name ASC`,
      );
      return res.json({ data: result.rows.map((row) => ({ id: row.id, name: row.name, code: row.code })) });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/api/admin/education-applications/bulk-template",
  auth,
  checkPermission("educationApplications", "can_update"),
  (req, res) => {
    if (!fs.existsSync(BULK_TEMPLATE_PATH)) {
      return res.status(404).json({ message: "Toplu başvuru şablonu sunucuda bulunamadı." });
    }
    return res.download(BULK_TEMPLATE_PATH, "TopluBasvuruFormu.xlsx");
  },
);

router.post(
  "/api/admin/education-applications/bulk-import",
  auth,
  checkPermission("educationApplications", "can_update"),
  async (req, res, next) => {
    const educationId = String(req.body?.educationId || "").trim();
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!isUuidParam(educationId)) return res.status(400).json({ message: "Lütfen bir eğitim seçin." });
    if (!rows || !rows.length) return res.status(400).json({ message: "İçe aktarılacak satır bulunamadı." });
    if (rows.length > BULK_MAX_ROWS_PER_REQUEST) {
      return res.status(400).json({ message: `Tek istekte en fazla ${BULK_MAX_ROWS_PER_REQUEST} satır gönderilebilir.` });
    }

    try {
      const educationResult = await pool.query(
        `SELECT id, name, code, price, has_discount, discount_rate, sales_filter FROM educations WHERE id = $1 LIMIT 1`,
        [educationId],
      );
      const edu = educationResult.rows[0];
      if (!edu) return res.status(404).json({ message: "Eğitim bulunamadı." });
      if (String(edu.sales_filter || "").toLowerCase() !== "guzem-ucretli") {
        return res.status(400).json({ message: "Toplu başvuru yalnızca ücretli eğitimler için yapılabilir." });
      }

      const priceSnap = edu.price != null ? Number(edu.price) : null;
      const hasDiscSnap = Boolean(edu.has_discount);
      const discRateSnap = edu.discount_rate != null ? Number(edu.discount_rate) : null;
      const payableSnap = computePayable(priceSnap, hasDiscSnap, discRateSnap);

      const results = [];
      const touchedIds = [];

      for (const raw of rows) {
        const sheetRow = Number(raw?.sheetRow) || null;
        const nationalId = String(raw?.nationalId ?? "").replace(/\D/g, "");
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const push = (status, reason, extra = {}) => results.push({ sheetRow, nationalId, email, status, reason, ...extra });

        if (!nationalId || !email) {
          push("notFound", "T.C. Kimlik No ve E-Posta birlikte dolu olmalıdır.");
          continue;
        }

        const userResult = await pool.query(
          `SELECT u.id, u.first_name, u.last_name, u.email, d.national_id
           FROM normal_users u
           INNER JOIN normal_user_details d ON d.user_id = u.id
           WHERE LOWER(u.email) = $1 AND d.national_id = $2
           LIMIT 1`,
          [email, nationalId],
        );
        const user = userResult.rows[0];
        if (!user) {
          push("notFound", "T.C. kimlik numarası ve e-posta ile eşleşen kayıtlı kullanıcı yok.");
          continue;
        }
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

        const existing = await pool.query(
          `SELECT id, status FROM education_applications WHERE user_id = $1 AND education_id = $2 LIMIT 1`,
          [user.id, educationId],
        );
        if (existing.rows[0]?.status === "approved") {
          push("skipped", "Bu kullanıcının bu eğitim için onaylı başvurusu zaten var.", { fullName });
          continue;
        }
        if (existing.rows[0]) {
          await pool.query(
            `UPDATE education_applications
             SET status = 'approved', approved_at = NOW(), approved_by = $2, updated_at = NOW()
             WHERE id = $1`,
            [existing.rows[0].id, req.user.id || null],
          );
          touchedIds.push(existing.rows[0].id);
          push("approved", "Bekleyen başvurusu onaylandı.", { fullName });
          continue;
        }

        const inserted = await pool.query(
          `INSERT INTO education_applications (
             user_id, education_id, first_name, last_name, email, national_id, phone,
             info_confirmed, payment_method, payment_note, status, approved_at, approved_by,
             price_snapshot, has_discount_snapshot, discount_rate_snapshot, payable_amount
           ) VALUES ($1,$2,$3,$4,$5,$6,'',TRUE,$7,$8,'approved',NOW(),$9,$10,$11,$12,$13)
           ON CONFLICT (user_id, education_id) DO NOTHING
           RETURNING id`,
          [
            user.id,
            educationId,
            user.first_name || "",
            user.last_name || "",
            String(user.email || email).toLowerCase(),
            nationalId,
            BULK_PAYMENT_METHOD,
            "Toplu başvuru (yönetim paneli)",
            req.user.id || null,
            priceSnap,
            hasDiscSnap,
            discRateSnap,
            payableSnap,
          ],
        );
        if (!inserted.rows[0]) {
          push("skipped", "Bu kullanıcının bu eğitim için başvurusu zaten var.", { fullName });
          continue;
        }
        touchedIds.push(inserted.rows[0].id);
        push("created", "", { fullName });
      }

      if (touchedIds.length) {
        await writeActivityLog({
          req,
          action: "create",
          moduleName: "educationApplications",
          newData: { bulkImport: true, educationId, educationCode: edu.code, count: touchedIds.length, applicationIds: touchedIds },
        }).catch(() => {});
      }

      return res.json({ results });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/api/admin/education-applications/:id/approve",
  auth,
  checkPermission("educationApplications", "can_update"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!isUuidParam(id)) return res.status(400).json({ message: "Geçersiz başvuru." });

      const existing = await pool.query(`SELECT * FROM education_applications WHERE id = $1 LIMIT 1`, [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Başvuru bulunamadı." });
      if (existing.rows[0].status === "approved") {
        const joined = await pool.query(
          `SELECT a.*, e.name AS education_name, e.code AS education_code,
                  e.price AS education_price, e.has_discount AS education_has_discount, e.discount_rate AS education_discount_rate
           FROM education_applications a
           LEFT JOIN educations e ON e.id = a.education_id
           WHERE a.id = $1 LIMIT 1`,
          [id],
        );
        return res.json({ ok: true, application: formatApplicationRow(joined.rows[0] || existing.rows[0]) });
      }

      await pool.query(
        `UPDATE education_applications
         SET status = 'approved', approved_at = NOW(), approved_by = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, req.user.id || null],
      );

      const joined = await pool.query(
        `SELECT a.*,
                e.name AS education_name,
                e.code AS education_code,
                e.price AS education_price,
                e.has_discount AS education_has_discount,
                e.discount_rate AS education_discount_rate
         FROM education_applications a
         LEFT JOIN educations e ON e.id = a.education_id
         WHERE a.id = $1
         LIMIT 1`,
        [id],
      );

      return res.json({ ok: true, application: formatApplicationRow(joined.rows[0]) });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
