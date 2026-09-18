import { Router } from "express";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { checkPermission } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { ensurePermissionRows } from "../../services/permissions.js";

const router = Router();

async function queryFormOptions() {
  const [roles, institutions, educationCategories, approvedEducations, instructors, educationInstructors, educations] =
    await Promise.all([
      pool.query(`SELECT * FROM roles ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM institutions ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM education_categories ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM approved_educations ORDER BY code ASC`),
      pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email
         FROM admin_users a
         INNER JOIN roles r ON r.id = a.role_id
         WHERE r.code = 'egitmen'
         ORDER BY a.first_name ASC, a.last_name ASC`,
      ),
      pool.query(
        `SELECT i.id, i.admin_user_id, a.first_name, a.last_name, a.email
         FROM instructors i
         INNER JOIN admin_users a ON a.id = i.admin_user_id
         INNER JOIN roles r ON r.id = a.role_id
         WHERE r.code = 'egitmen'
         ORDER BY a.first_name ASC, a.last_name ASC`,
      ),
      pool.query(`SELECT id, name, code FROM educations ORDER BY created_at DESC`),
    ]);
  return {
    roles: roles.rows.map(toApiObject),
    institutions: institutions.rows.map(toApiObject),
    educationCategories: educationCategories.rows.map(toApiObject),
    approvedEducations: approvedEducations.rows.map(toApiObject),
    instructors: instructors.rows.map(toApiObject),
    educationInstructors: educationInstructors.rows.map(toApiObject),
    educations: educations.rows.map(toApiObject),
    pageSize: 20,
  };
}

/** Oturumdaki yöneticinin menü yetkileri (hafif). */
router.get("/api/admin/my-permissions", auth, async (req, res, next) => {
  try {
    await ensurePermissionRows();
    const result = await pool.query(`SELECT * FROM permissions WHERE role_id = $1`, [req.user.roleId]);
    res.json({ permissions: result.rows.map(toApiObject) });
  } catch (error) {
    next(error);
  }
});

/** Rol/yetki sayfası için tüm izin kayıtları. */
router.get("/api/admin/permissions", auth, checkPermission("roles", "can_view"), async (req, res, next) => {
  try {
    await ensurePermissionRows();
    const result = await pool.query(`SELECT * FROM permissions ORDER BY role_id, module_name`);
    res.json({ permissions: result.rows.map(toApiObject) });
  } catch (error) {
    next(error);
  }
});

/** Form select alanları için referans veriler (bootstrap'ın ağır kısmı, izinler hariç). */
router.get("/api/admin/form-options", auth, async (req, res, next) => {
  try {
    res.json(await queryFormOptions());
  } catch (error) {
    next(error);
  }
});

/** @deprecated — form-options + permissions kullanın */
router.get("/api/admin/bootstrap", auth, async (req, res, next) => {
  try {
    await ensurePermissionRows();
    const [permissions, formOptions] = await Promise.all([
      pool.query(`SELECT * FROM permissions`),
      queryFormOptions(),
    ]);
    res.json({
      permissions: permissions.rows.map(toApiObject),
      ...formOptions,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/dashboard", auth, checkPermission("dashboard", "can_view"), async (req, res, next) => {
  try {
    const countQueries = [
      "SELECT COUNT(*)::int AS count FROM normal_users",
      "SELECT COUNT(*)::int AS count FROM admin_users",
      "SELECT COUNT(*)::int AS count FROM institutions",
      "SELECT COUNT(*)::int AS count FROM educations",
      "SELECT COUNT(*)::int AS count FROM instructors",
      "SELECT COUNT(*)::int AS count FROM newsletter",
      "SELECT COUNT(*)::int AS count FROM contact_forms",
      "SELECT COUNT(*)::int AS count FROM education_calendar",
      "SELECT COUNT(*)::int AS count FROM contact_forms WHERE is_read = FALSE",
      "SELECT COUNT(*)::int AS count FROM education_applications WHERE status = 'pending'",
      "SELECT COUNT(*)::int AS count FROM education_applications WHERE status = 'approved'",
      "SELECT COUNT(*)::int AS count FROM certificate_notifications WHERE status = 'pending_superadmin'",
      "SELECT COUNT(*)::int AS count FROM certificate_notifications WHERE status = 'pending_yetkili'",
      `SELECT COUNT(*)::int AS count FROM exam_portal_best_scores
        WHERE best_score >= 60 AND payment_received = FALSE`,
      `SELECT COUNT(*)::int AS count FROM exam_portal_best_scores
        WHERE best_score >= 60 AND payment_received = TRUE AND edevlet_processed = FALSE`,
      `SELECT COUNT(*)::int AS count FROM exam_portal_best_scores
        WHERE best_score >= 60 AND payment_received = TRUE AND edevlet_processed = TRUE`,
      `SELECT COUNT(*)::int AS count FROM exam_portal_visits
        WHERE created_at >= ((NOW() AT TIME ZONE 'Europe/Istanbul')::date) AT TIME ZONE 'Europe/Istanbul'`,
      `SELECT COUNT(*)::int AS count FROM normal_users
        WHERE created_at >= ((NOW() AT TIME ZONE 'Europe/Istanbul')::date) AT TIME ZONE 'Europe/Istanbul'`,
      `SELECT COUNT(*)::int AS count FROM educations WHERE sales_filter = 'guzem-ucretli'`,
    ];

    const [
      normalUsers,
      adminUsers,
      institutions,
      educations,
      instructors,
      newsletter,
      contactForms,
      educationCalendar,
      unreadContacts,
      pendingApplications,
      approvedApplications,
      certNotifySuperadmin,
      certNotifyYetkili,
      awaitingPayment,
      awaitingEdevlet,
      edevletDone,
      portalVisitsToday,
      usersToday,
      paidEducations,
    ] = await Promise.all(countQueries.map((q) => pool.query(q).catch(() => ({ rows: [{ count: 0 }] }))));

    const [latestUsers, latestContacts, latestLogs, monthlyRegs, salesBreakdown] = await Promise.all([
      pool.query(
        `SELECT id, first_name, last_name, email, created_at
         FROM normal_users
         ORDER BY created_at DESC
         LIMIT 8`,
      ),
      pool.query(
        `SELECT id, full_name, subject, email, is_read, created_at
         FROM contact_forms
         ORDER BY created_at DESC
         LIMIT 8`,
      ),
      pool.query(
        `SELECT l.id, l.action, l.module_name, l.created_at,
                a.first_name AS admin_first_name, a.last_name AS admin_last_name
         FROM activity_logs l
         LEFT JOIN admin_users a ON a.id = l.admin_user_id
         ORDER BY l.created_at DESC
         LIMIT 10`,
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM') AS month_key,
                to_char(date_trunc('month', created_at AT TIME ZONE 'Europe/Istanbul'), 'Mon') AS month_label,
                COUNT(*)::int AS count
         FROM normal_users
         WHERE created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Europe/Istanbul') - INTERVAL '5 months')
               AT TIME ZONE 'Europe/Istanbul'
         GROUP BY 1, 2
         ORDER BY 1 ASC`,
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(sales_filter), ''), 'diger') AS sales_filter,
                COUNT(*)::int AS count
         FROM educations
         GROUP BY 1
         ORDER BY count DESC`,
      ).catch(() => ({ rows: [] })),
    ]);

    const monthMap = new Map(monthlyRegs.rows.map((row) => [row.month_key, row]));
    const monthlyRegistrations = [];
    const nowIstanbul = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(nowIstanbul.getFullYear(), nowIstanbul.getMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const hit = monthMap.get(key);
      const label = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(d);
      monthlyRegistrations.push({
        monthKey: key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count: hit ? Number(hit.count) || 0 : 0,
      });
    }

    res.json({
      stats: {
        normalUsers: normalUsers.rows[0].count,
        adminUsers: adminUsers.rows[0].count,
        institutions: institutions.rows[0].count,
        educations: educations.rows[0].count,
        instructors: instructors.rows[0].count,
        newsletter: newsletter.rows[0].count,
        contactForms: contactForms.rows[0].count,
        educationCalendar: educationCalendar.rows[0].count,
        unreadContacts: unreadContacts.rows[0].count,
        pendingApplications: pendingApplications.rows[0].count,
        approvedApplications: approvedApplications.rows[0].count,
        certNotifySuperadmin: certNotifySuperadmin.rows[0].count,
        certNotifyYetkili: certNotifyYetkili.rows[0].count,
        awaitingPayment: awaitingPayment.rows[0].count,
        awaitingEdevlet: awaitingEdevlet.rows[0].count,
        edevletDone: edevletDone.rows[0].count,
        portalVisitsToday: portalVisitsToday.rows[0].count,
        usersToday: usersToday.rows[0].count,
        paidEducations: paidEducations.rows[0].count,
      },
      monthlyRegistrations,
      salesBreakdown: salesBreakdown.rows.map((row) => ({
        key: row.sales_filter,
        count: Number(row.count) || 0,
      })),
      latestUsers: latestUsers.rows.map(toApiObject),
      latestContacts: latestContacts.rows.map(toApiObject),
      latestLogs: latestLogs.rows.map((row) => ({
        ...toApiObject(row),
        adminName: [row.admin_first_name, row.admin_last_name].filter(Boolean).join(" ").trim() || "Sistem",
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/activity-logs", auth, checkPermission("activityLogs", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 100));
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM activity_logs`);
    const result = await pool.query(
      `SELECT l.*, a.first_name AS admin_first_name, a.last_name AS admin_last_name, a.email AS admin_email
       FROM activity_logs l
       LEFT JOIN admin_users a ON a.id = l.admin_user_id
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    res.json({
      data: result.rows.map(toApiObject),
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

export default router;
