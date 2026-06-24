import { Router } from "express";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { checkPermission } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { ensurePermissionRows } from "../../services/permissions.js";

const router = Router();

router.get("/api/admin/bootstrap", auth, async (req, res, next) => {
  try {
    await ensurePermissionRows();
    const [permissions, roles, institutions, educationCategories, approvedEducations, instructors, educationInstructors, educations] =
      await Promise.all([
        pool.query(`SELECT * FROM permissions`),
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
    res.json({
      permissions: permissions.rows.map(toApiObject),
      roles: roles.rows.map(toApiObject),
      institutions: institutions.rows.map(toApiObject),
      educationCategories: educationCategories.rows.map(toApiObject),
      approvedEducations: approvedEducations.rows.map(toApiObject),
      instructors: instructors.rows.map(toApiObject),
      educationInstructors: educationInstructors.rows.map(toApiObject),
      educations: educations.rows.map(toApiObject),
      pageSize: 20,
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
    ] = await Promise.all(countQueries.map((q) => pool.query(q)));

    const [latestUsers, latestContacts, latestLogs] = await Promise.all([
      pool.query(`SELECT id, first_name, last_name, email, created_at FROM normal_users ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT id, full_name, subject, created_at FROM contact_forms ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT id, action, module_name, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10`),
    ]);

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
      },
      latestUsers: latestUsers.rows.map(toApiObject),
      latestContacts: latestContacts.rows.map(toApiObject),
      latestLogs: latestLogs.rows.map(toApiObject),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/activity-logs", auth, async (req, res, next) => {
  try {
    const permissionResult = await pool.query(
      `SELECT can_view FROM permissions WHERE role_id = $1 AND module_name = 'dashboard' LIMIT 1`,
      [req.user.roleId],
    );
    if (!permissionResult.rows[0]?.can_view) return res.status(403).json({ message: "Yetkiniz yok." });

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
