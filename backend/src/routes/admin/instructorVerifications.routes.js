import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isUuidParam } from "../../middleware/auth.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { writeActivityLog } from "../../services/activityLog.js";

const router = Router();

const STATUS_FILTERS = ["pending", "verified", "rejected"];

const SELECT_SQL = `SELECT v.id, v.user_id, v.verification_email, v.education_id, v.status,
                           v.verified_at, v.created_at, v.updated_at,
                           u.first_name, u.last_name, u.email AS account_email,
                           d.national_id,
                           e.name AS education_name, e.code AS education_code
                    FROM instructor_verifications v
                    INNER JOIN normal_users u ON u.id = v.user_id
                    LEFT JOIN normal_user_details d ON d.user_id = v.user_id
                    LEFT JOIN educations e ON e.id = v.education_id`;

const formatRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  firstName: row.first_name || "",
  lastName: row.last_name || "",
  accountEmail: row.account_email || "",
  verificationEmail: row.verification_email || "",
  nationalId: row.national_id || "",
  educationId: row.education_id || null,
  educationName: row.education_name || "",
  educationCode: row.education_code || "",
  status: row.status,
  verifiedAt: row.verified_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get(
  "/api/admin/instructor-verifications",
  auth,
  checkPermission("instructorVerifications", "can_view"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
      const status = String(req.query.status || "").trim().toLowerCase();
      const search = String(req.query.search || "").trim().toLowerCase();

      const params = [];
      const conditions = [];
      if (STATUS_FILTERS.includes(status)) {
        params.push(status);
        conditions.push(`v.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${escapeIlikePattern(search)}%`);
        conditions.push(
          `LOWER(CONCAT_WS(' ', u.first_name, u.last_name, u.email, v.verification_email, d.national_id)) LIKE $${params.length}`,
        );
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM instructor_verifications v
         INNER JOIN normal_users u ON u.id = v.user_id
         LEFT JOIN normal_user_details d ON d.user_id = v.user_id
         ${whereSql}`,
        params,
      );
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const result = await pool.query(
        `${SELECT_SQL}
         ${whereSql}
         ORDER BY (v.status = 'pending') DESC, v.updated_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );
      const pendingResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM instructor_verifications WHERE status = 'pending'`,
      );

      const total = countResult.rows[0]?.total || 0;
      return res.json({
        data: result.rows.map(formatRow),
        pendingCount: pendingResult.rows[0]?.total || 0,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    } catch (error) {
      return next(error);
    }
  },
);

const updateStatus = (nextStatus) => async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isUuidParam(id)) return res.status(400).json({ message: "Geçersiz kayıt." });
    const previous = await pool.query(`SELECT * FROM instructor_verifications WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Doğrulama talebi bulunamadı." });

    const verified = nextStatus === "verified";
    await pool.query(
      `UPDATE instructor_verifications
       SET status = $2,
           verified_at = CASE WHEN $3::boolean THEN NOW() ELSE NULL END,
           verified_by = CASE WHEN $3::boolean THEN $4::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1`,
      [id, nextStatus, verified, req.user.id || null],
    );
    const updated = await pool.query(`${SELECT_SQL} WHERE v.id = $1 LIMIT 1`, [id]);
    await writeActivityLog({
      req,
      action: "update",
      moduleName: "instructorVerifications",
      entityId: id,
      oldData: previous.rows[0],
      newData: { status: nextStatus },
    });
    return res.json({ ok: true, verification: formatRow(updated.rows[0]) });
  } catch (error) {
    return next(error);
  }
};

router.patch(
  "/api/admin/instructor-verifications/:id/verify",
  auth,
  checkPermission("instructorVerifications", "can_update"),
  updateStatus("verified"),
);

router.patch(
  "/api/admin/instructor-verifications/:id/reject",
  auth,
  checkPermission("instructorVerifications", "can_update"),
  updateStatus("rejected"),
);

export default router;
