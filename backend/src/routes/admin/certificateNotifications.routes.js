import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isUuidParam } from "../../middleware/auth.js";

const router = Router();

const formatRow = (row, { roleCode } = {}) => {
  const base = {
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submitterName: [row.submitter_first_name, row.submitter_last_name].filter(Boolean).join(" ").trim() || "—",
    superadminApprovedAt: row.superadmin_approved_at || null,
    yetkiliAcceptedAt: row.yetkili_accepted_at || null,
  };

  if (roleCode === "superadmin" || roleCode === "admin") {
    base.pricedExcelPath = row.priced_excel_path || "";
    base.pricedExcelName = row.priced_excel_name || "";
    base.receiptPdfPath = row.receipt_pdf_path || "";
    base.receiptPdfName = row.receipt_pdf_name || "";
  }
  if (roleCode === "yetkili" || roleCode === "superadmin") {
    base.unpaidExcelPath = row.unpaid_excel_path || "";
    base.unpaidExcelName = row.unpaid_excel_name || "";
  }
  // Submitter/admin creating: include all names for the create flow echo
  if (roleCode === "admin" || roleCode === "superadmin") {
    base.unpaidExcelPath = row.unpaid_excel_path || "";
    base.unpaidExcelName = row.unpaid_excel_name || "";
  }

  return base;
};

const loadRowById = async (id) => {
  const result = await pool.query(
    `SELECT n.*,
            u.first_name AS submitter_first_name,
            u.last_name AS submitter_last_name
     FROM certificate_notifications n
     LEFT JOIN admin_users u ON u.id = n.submitted_by
     WHERE n.id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
};

const pendingStatusForRole = (roleCode) => {
  if (roleCode === "superadmin") return "pending_superadmin";
  if (roleCode === "yetkili") return "pending_yetkili";
  return null;
};

router.get("/api/admin/certificate-notifications/count", auth, checkPermission("certificateNotifications", "can_view"), async (req, res, next) => {
  try {
    const roleCode = String(req.user.roleCode || "").toLowerCase();
    const status = pendingStatusForRole(roleCode);
    if (!status) {
      return res.json({ count: 0, roleCode });
    }
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total FROM certificate_notifications WHERE status = $1`,
      [status],
    );
    return res.json({ count: result.rows[0]?.total || 0, roleCode });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/certificate-notifications", auth, checkPermission("certificateNotifications", "can_view"), async (req, res, next) => {
  try {
    const roleCode = String(req.user.roleCode || "").toLowerCase();
    const conditions = [];
    const params = [];

    if (roleCode === "superadmin") {
      conditions.push(`n.status = 'pending_superadmin'`);
    } else if (roleCode === "yetkili") {
      conditions.push(`n.status = 'pending_yetkili'`);
    } else if (roleCode === "admin") {
      // Admin submitting side: own submissions still awaiting superadmin, or recent completed own
      params.push(req.user.id);
      conditions.push(`n.submitted_by = $${params.length}`);
      conditions.push(`n.status IN ('pending_superadmin', 'pending_yetkili', 'completed')`);
    } else {
      return res.json({ data: [], roleCode });
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "WHERE TRUE";
    const result = await pool.query(
      `SELECT n.*,
              u.first_name AS submitter_first_name,
              u.last_name AS submitter_last_name
       FROM certificate_notifications n
       LEFT JOIN admin_users u ON u.id = n.submitted_by
       ${whereSql}
       ORDER BY n.created_at DESC
       LIMIT 100`,
      params,
    );

    return res.json({
      data: result.rows.map((row) => formatRow(row, { roleCode })),
      roleCode,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/certificate-notifications", auth, checkPermission("certificateNotifications", "can_create"), async (req, res, next) => {
  try {
    const roleCode = String(req.user.roleCode || "").toLowerCase();
    if (!["superadmin", "admin"].includes(roleCode)) {
      return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
    }

    const pricedExcelPath = String(req.body?.pricedExcelPath || "").trim();
    const pricedExcelName = String(req.body?.pricedExcelName || "").trim();
    const unpaidExcelPath = String(req.body?.unpaidExcelPath || "").trim();
    const unpaidExcelName = String(req.body?.unpaidExcelName || "").trim();
    const receiptPdfPath = String(req.body?.receiptPdfPath || "").trim();
    const receiptPdfName = String(req.body?.receiptPdfName || "").trim();

    if (!pricedExcelPath || !unpaidExcelPath || !receiptPdfPath) {
      return res.status(400).json({ message: "Fiyatlı Excel, fiyatsız Excel ve dekont PDF zorunludur." });
    }
    if (!pricedExcelPath.startsWith("/uploads/") || !unpaidExcelPath.startsWith("/uploads/") || !receiptPdfPath.startsWith("/uploads/")) {
      return res.status(400).json({ message: "Geçersiz dosya yolu." });
    }

    const inserted = await pool.query(
      `INSERT INTO certificate_notifications (
         status, priced_excel_path, priced_excel_name, unpaid_excel_path, unpaid_excel_name,
         receipt_pdf_path, receipt_pdf_name, submitted_by, submitted_at
       ) VALUES (
         'pending_superadmin', $1, $2, $3, $4, $5, $6, $7, NOW()
       ) RETURNING id`,
      [
        pricedExcelPath,
        pricedExcelName || "fiyatli.xlsx",
        unpaidExcelPath,
        unpaidExcelName || "fiyatsiz.xlsx",
        receiptPdfPath,
        receiptPdfName || "dekont.pdf",
        req.user.id,
      ],
    );

    const row = await loadRowById(inserted.rows[0].id);
    return res.status(201).json({ ok: true, notification: formatRow(row, { roleCode }) });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/api/admin/certificate-notifications/:id/superadmin-approve",
  auth,
  checkPermission("certificateNotifications", "can_update"),
  async (req, res, next) => {
    try {
      if (String(req.user.roleCode || "").toLowerCase() !== "superadmin") {
        return res.status(403).json({ message: "Yalnızca süper admin onaylayabilir." });
      }
      const id = String(req.params.id || "").trim();
      if (!isUuidParam(id)) return res.status(400).json({ message: "Geçersiz kayıt." });

      const existing = await pool.query(`SELECT * FROM certificate_notifications WHERE id = $1 LIMIT 1`, [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
      if (existing.rows[0].status !== "pending_superadmin") {
        return res.status(400).json({ message: "Bu kayıt süper admin onayında değil." });
      }

      await pool.query(
        `UPDATE certificate_notifications
         SET status = 'pending_yetkili',
             superadmin_approved_by = $2,
             superadmin_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [id, req.user.id],
      );

      const row = await loadRowById(id);
      return res.json({ ok: true, notification: formatRow(row, { roleCode: "superadmin" }) });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/api/admin/certificate-notifications/:id/yetkili-accept",
  auth,
  checkPermission("certificateNotifications", "can_update"),
  async (req, res, next) => {
    try {
      if (String(req.user.roleCode || "").toLowerCase() !== "yetkili") {
        return res.status(403).json({ message: "Yalnızca sertifika yetkilisi kabul edebilir." });
      }
      const id = String(req.params.id || "").trim();
      if (!isUuidParam(id)) return res.status(400).json({ message: "Geçersiz kayıt." });

      const existing = await pool.query(`SELECT * FROM certificate_notifications WHERE id = $1 LIMIT 1`, [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
      if (existing.rows[0].status !== "pending_yetkili") {
        return res.status(400).json({ message: "Bu kayıt yetkili kabulünde değil." });
      }

      await pool.query(
        `UPDATE certificate_notifications
         SET status = 'completed',
             yetkili_accepted_by = $2,
             yetkili_accepted_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [id, req.user.id],
      );

      const row = await loadRowById(id);
      return res.json({ ok: true, notification: formatRow(row, { roleCode: "yetkili" }) });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
