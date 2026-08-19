import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { moduleConfig } from "../../config/adminModules.js";
import { toApiObject, toDbObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";
import { getRoleCodeById, upsertInstructorByAdminUser, removeInstructorByAdminUserId } from "../../services/instructors.js";
import { prepareEducationPayload, prepareExamQuestionPayload } from "../../services/education/payload.js";
import { syncEducationModules, loadEducationModules, stripNonTableFields } from "../../services/education/modules.js";
import { buildInsertSql, buildUpdateSql } from "../../utils/jsonbBind.js";
import { normalizeSalesFilter } from "../../config/salesFilters.js";

const router = Router();

router.get("/api/admin/:moduleName", auth, async (req, res, next) => {
  const { moduleName } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  try {
    const permissionResult = await pool.query(`SELECT can_view FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!permissionResult.rows[0]?.can_view) return res.status(403).json({ message: "Yetkiniz yok." });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const search = String(req.query.search || "").trim().toLowerCase();
    const readStatus = String(req.query.readStatus || "all").trim().toLowerCase();
    const salesFilter = normalizeSalesFilter(req.query.salesFilter);
    const offset = (page - 1) * pageSize;

    if (moduleName === "instructors") {
      const params = ["egitmen"];
      const conditions = ["r.code = $1"];
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(`(
          LOWER(COALESCE(a.first_name::text, '')) LIKE $${idx}
          OR LOWER(COALESCE(a.last_name::text, '')) LIKE $${idx}
          OR LOWER(COALESCE(a.email::text, '')) LIKE $${idx}
        )`);
      }
      const whereSql = `WHERE ${conditions.join(" AND ")}`;
      const countSql = `SELECT COUNT(*)::int AS total
                        FROM admin_users a
                        INNER JOIN roles r ON r.id = a.role_id
                        ${whereSql}`;
      const listSql = `SELECT a.id, a.first_name, a.last_name, a.email, a.created_at, a.updated_at,
                              COALESCE(i.title, '') AS title, COALESCE(i.department, '') AS department, COALESCE(i.about, '') AS about
                       FROM admin_users a
                       INNER JOIN roles r ON r.id = a.role_id
                       LEFT JOIN instructors i ON i.admin_user_id = a.id
                       ${whereSql}
                       ORDER BY a.created_at DESC
                       LIMIT $${params.length + 1}
                       OFFSET $${params.length + 2}`;
      const [countResult, listResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(listSql, [...params, pageSize, offset]),
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
    }

    const params = [];
    const conditions = [];

    if (search) {
      const searchConditions = config.searchable.map((field) => {
        params.push(`%${search}%`);
        return `LOWER(COALESCE(${field}::text, '')) LIKE $${params.length}`;
      });
      conditions.push(`(${searchConditions.join(" OR ")})`);
    }

    if (config.table === "contact_forms" && (readStatus === "read" || readStatus === "unread")) {
      params.push(readStatus === "read");
      conditions.push(`is_read = $${params.length}`);
    }

    if (salesFilter && (config.table === "approved_educations" || config.table === "educations" || config.table === "education_calendar")) {
      params.push(salesFilter);
      conditions.push(`sales_filter = $${params.length}`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM ${config.table} ${whereSql}`;
    const listSql = `SELECT * FROM ${config.table} ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
    ]);
    const rows = listResult.rows;

    res.json({
      data: rows.map(toApiObject),
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

router.post("/api/admin/:moduleName", auth, async (req, res, next) => {
  const { moduleName } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });

  if (moduleName === "instructors") {
    try {
      const p = await pool.query(`SELECT can_create FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [
        req.user.roleId,
        moduleName,
      ]);
      if (!p.rows[0]?.can_create) return res.status(403).json({ message: "Yetkiniz yok." });
      const body = req.body || {};
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const title = String(body.title || "").trim();
      const department = String(body.department || "").trim();
      const about = String(body.about || "").trim();
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Ad, soyad, e-posta ve şifre zorunludur." });
      }
      const roleResult = await pool.query(`SELECT id FROM roles WHERE code = 'egitmen' LIMIT 1`);
      if (!roleResult.rows[0]) return res.status(500).json({ message: "Eğitmen rolü bulunamadı." });
      const roleId = roleResult.rows[0].id;
      const password_hash = await bcrypt.hash(password, 10);
      const insert = await pool.query(
        `INSERT INTO admin_users (first_name, last_name, email, password_hash, role_id, is_active)
         VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING *`,
        [firstName, lastName, email, password_hash, roleId],
      );
      const admin = insert.rows[0];
      await upsertInstructorByAdminUser(admin);
      if (title || department || about) {
        await pool.query(
          `UPDATE instructors SET title = $1, department = $2, about = $3, updated_at = NOW() WHERE admin_user_id = $4`,
          [title, department, about, admin.id],
        );
      }
      const instRow = await pool.query(`SELECT title, department, about FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [admin.id]);
      const i = instRow.rows[0] || {};
      await writeActivityLog({ req, action: "create", moduleName, entityId: admin.id, newData: { ...admin, ...i } });
      return res.status(201).json(
        toApiObject({
          ...admin,
          title: i.title ?? "",
          department: i.department ?? "",
          about: i.about ?? "",
        }),
      );
    } catch (error) {
      return next(error);
    }
  }

  try {
    const p = await pool.query(`SELECT can_create FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_create) return res.status(403).json({ message: "Yetkiniz yok." });
    const modulesPayload =
      moduleName === "educations" ? (Array.isArray(req.body?.modules) ? req.body.modules : []) : null;
    const payload = toDbObject(req.body);
    if (config.table === "educations" || config.table === "education_calendar" || config.table === "approved_educations") {
      try {
        prepareEducationPayload(payload);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }
    if (config.table === "exam_questions") {
      prepareExamQuestionPayload(payload);
    }
    if (config.table === "admin_users" || config.table === "instructors" || config.table === "normal_users") {
      if (payload.password) {
        payload.password_hash = await bcrypt.hash(payload.password, 10);
        delete payload.password;
      }
    }
    stripNonTableFields(payload);
    const { sql, values } = buildInsertSql(config.table, payload);
    const result = await pool.query(sql, values);
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(result.rows[0].role_id);
      if (roleCode === "egitmen") {
        await upsertInstructorByAdminUser(result.rows[0]);
      }
    }
    if (moduleName === "educations") {
      await syncEducationModules(result.rows[0].id, modulesPayload);
    }
    await writeActivityLog({ req, action: "create", moduleName, entityId: result.rows[0].id, newData: result.rows[0] });
    const created = toApiObject(result.rows[0]);
    if (moduleName === "educations") {
      created.modules = await loadEducationModules(result.rows[0].id);
    }
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/api/admin/:moduleName/:id", auth, async (req, res, next) => {
  const { moduleName, id } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  try {
    const p = await pool.query(`SELECT can_update FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_update) return res.status(403).json({ message: "Yetkiniz yok." });
    if (config.table === "instructors") {
      const allowed = ["title", "department", "about"];
      const payload = toDbObject(req.body);
      const adminPayload = {};
      if (payload.first_name !== undefined) adminPayload.first_name = String(payload.first_name || "").trim();
      if (payload.last_name !== undefined) adminPayload.last_name = String(payload.last_name || "").trim();
      if (payload.email !== undefined) adminPayload.email = String(payload.email || "").trim().toLowerCase();
      if (payload.password) {
        adminPayload.password_hash = await bcrypt.hash(String(payload.password), 10);
      }
      const adminKeys = Object.keys(adminPayload);
      if (adminKeys.length) {
        const adminVals = adminKeys.map((k) => adminPayload[k]);
        const setA = adminKeys.map((k, i) => `${k} = $${i + 1}`).join(", ");
        await pool.query(`UPDATE admin_users SET ${setA}, updated_at = NOW() WHERE id = $${adminKeys.length + 1}`, [...adminVals, id]);
      }
      const adminUser = await pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash
         FROM admin_users a
         INNER JOIN roles r ON r.id = a.role_id
         WHERE a.id = $1 AND r.code = 'egitmen'
         LIMIT 1`,
        [id],
      );
      if (!adminUser.rows[0]) return res.status(404).json({ message: "Eğitmen kaydı bulunamadı." });
      const previousInstructor = await pool.query(`SELECT * FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [id]);
      await upsertInstructorByAdminUser(adminUser.rows[0]);
      const updateKeys = Object.keys(payload).filter((key) => allowed.includes(key));
      if (updateKeys.length) {
        const values = updateKeys.map((key) => payload[key]);
        const setSql = updateKeys.map((key, i) => `${key} = $${i + 1}`).join(", ");
        const result = await pool.query(
          `UPDATE instructors SET ${setSql}, updated_at = NOW() WHERE admin_user_id = $${updateKeys.length + 1} RETURNING *`,
          [...values, id],
        );
        await writeActivityLog({ req, action: "update", moduleName, entityId: id, oldData: previousInstructor.rows[0], newData: result.rows[0] });
        return res.json(toApiObject({ ...adminUser.rows[0], ...result.rows[0], id: adminUser.rows[0].id }));
      }
      const instOnly = await pool.query(`SELECT * FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [id]);
      await writeActivityLog({
        req,
        action: "update",
        moduleName,
        entityId: id,
        oldData: previousInstructor.rows[0],
        newData: instOnly.rows[0],
      });
      return res.json(toApiObject({ ...adminUser.rows[0], ...instOnly.rows[0], id: adminUser.rows[0].id }));
    }
    const previous = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });

    const modulesPayload =
      moduleName === "educations" && Object.hasOwn(req.body || {}, "modules")
        ? Array.isArray(req.body.modules)
          ? req.body.modules
          : []
        : null;
    const payload = toDbObject(req.body);
    if (config.table === "educations" || config.table === "education_calendar" || config.table === "approved_educations") {
      try {
        prepareEducationPayload(payload);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }
    if (config.table === "exam_questions") {
      prepareExamQuestionPayload(payload);
    }
    if ((config.table === "admin_users" || config.table === "instructors" || config.table === "normal_users") && payload.password) {
      payload.password_hash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }

    stripNonTableFields(payload);
    const { sql, values } = buildUpdateSql(config.table, payload, id);
    const result = await pool.query(sql, values);
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(result.rows[0].role_id);
      if (roleCode === "egitmen") {
        await upsertInstructorByAdminUser(result.rows[0]);
      } else {
        await removeInstructorByAdminUserId(result.rows[0].id);
      }
    }
    if (moduleName === "educations" && modulesPayload !== null) {
      await syncEducationModules(result.rows[0].id, modulesPayload);
    }
    await writeActivityLog({ req, action: "update", moduleName, entityId: id, oldData: previous.rows[0], newData: result.rows[0] });
    const updated = toApiObject(result.rows[0]);
    if (moduleName === "educations") {
      updated.modules = await loadEducationModules(result.rows[0].id);
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/api/admin/:moduleName/:id", auth, async (req, res, next) => {
  const { moduleName, id } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  try {
    const p = await pool.query(`SELECT can_delete FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_delete) return res.status(403).json({ message: "Yetkiniz yok." });

    if (moduleName === "instructors") {
      const adminCheck = await pool.query(
        `SELECT a.id FROM admin_users a INNER JOIN roles r ON r.id = a.role_id WHERE a.id = $1 AND r.code = 'egitmen' LIMIT 1`,
        [id],
      );
      if (!adminCheck.rows[0]) return res.status(404).json({ message: "Eğitmen kaydı bulunamadı." });
      const previous = await pool.query(`SELECT * FROM admin_users WHERE id = $1 LIMIT 1`, [id]);
      await pool.query(`DELETE FROM admin_users WHERE id = $1`, [id]);
      await writeActivityLog({ req, action: "delete", moduleName, entityId: id, oldData: previous.rows[0] });
      return res.status(204).send();
    }

    const previous = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(previous.rows[0].role_id);
      if (roleCode === "egitmen") {
        await removeInstructorByAdminUserId(previous.rows[0].id);
      }
    }
    await pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName, entityId: id, oldData: previous.rows[0] });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
