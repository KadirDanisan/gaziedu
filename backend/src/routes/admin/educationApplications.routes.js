import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isUuidParam } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { buildIstanbulDateFilterSql, parseDateRangePeriod } from "../../utils/dateRange.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";

const router = Router();

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
