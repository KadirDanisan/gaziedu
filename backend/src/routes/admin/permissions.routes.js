import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { toApiObject, toDbObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";
import { ensurePermissionRows } from "../../services/permissions.js";

const router = Router();

const TURKISH_CHAR_MAP = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u" };

const slugifyRoleCode = (value) =>
  String(value || "")
    .replace(/[çğıİöşü]/gi, (ch) => TURKISH_CHAR_MAP[ch] || TURKISH_CHAR_MAP[ch.toLowerCase()] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

router.post("/api/admin-roles", auth, checkPermission("roles", "can_create"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const name = String(req.body?.name || "").trim();
    const copyFromRoleId = String(req.body?.copyFromRoleId || "").trim() || null;
    if (!name) return res.status(400).json({ message: "Rol adı zorunludur." });

    const baseCode = slugifyRoleCode(req.body?.code || name);
    if (!baseCode) return res.status(400).json({ message: "Rol adından geçerli bir kod üretilemedi." });

    const nameTaken = await client.query(`SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]);
    if (nameTaken.rows[0]) return res.status(409).json({ message: "Bu isimde bir rol zaten var." });

    let code = baseCode;
    for (let i = 2; ; i += 1) {
      const exists = await client.query(`SELECT 1 FROM roles WHERE code = $1 LIMIT 1`, [code]);
      if (!exists.rows[0]) break;
      code = `${baseCode}_${i}`;
    }

    await client.query("BEGIN");
    const inserted = await client.query(`INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING *`, [code, name]);
    const role = inserted.rows[0];
    if (copyFromRoleId) {
      await client.query(
        `INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
         SELECT $1, module_name, can_view, can_create, can_update, can_delete
         FROM permissions WHERE role_id = $2
         ON CONFLICT (role_id, module_name) DO NOTHING`,
        [role.id, copyFromRoleId],
      );
    }
    await client.query("COMMIT");
    await ensurePermissionRows();

    await writeActivityLog({ req, action: "create", moduleName: "roles", entityId: role.id, newData: role });
    res.status(201).json(toApiObject(role));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

router.put("/api/admin-roles/:id", auth, checkPermission("roles", "can_update"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Rol adı zorunludur." });
    const previous = await pool.query(`SELECT * FROM roles WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Rol bulunamadı." });
    const nameTaken = await pool.query(`SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`, [name, id]);
    if (nameTaken.rows[0]) return res.status(409).json({ message: "Bu isimde bir rol zaten var." });
    const result = await pool.query(`UPDATE roles SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [name, id]);
    await writeActivityLog({ req, action: "update", moduleName: "roles", entityId: id, oldData: previous.rows[0], newData: result.rows[0] });
    res.json(toApiObject(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/api/admin-roles/:id", auth, checkPermission("roles", "can_delete"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const previous = await pool.query(`SELECT * FROM roles WHERE id = $1 LIMIT 1`, [id]);
    const role = previous.rows[0];
    if (!role) return res.status(404).json({ message: "Rol bulunamadı." });
    if (role.code === "superadmin") {
      return res.status(400).json({ message: "Süper Admin rolü silinemez." });
    }
    const usage = await pool.query(`SELECT COUNT(*)::int AS count FROM admin_users WHERE role_id = $1`, [id]);
    if (usage.rows[0].count > 0) {
      return res.status(400).json({
        message: `Bu role atanmış ${usage.rows[0].count} yönetici var. Önce kullanıcıların rolünü değiştirin.`,
      });
    }
    await pool.query(`DELETE FROM roles WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName: "roles", entityId: id, oldData: role });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/api/admin-role-permissions/:id", auth, checkPermission("roles", "can_update"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = toDbObject(req.body);
    const allowed = ["can_view", "can_create", "can_update", "can_delete"];
    const keys = Object.keys(payload).filter((key) => allowed.includes(key));
    if (!keys.length) return res.status(400).json({ message: "Geçersiz payload." });
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = keys.map((k) => payload[k]);
    const result = await pool.query(`UPDATE permissions SET ${setSql}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
    if (!result.rows[0]) return res.status(404).json({ message: "Yetki bulunamadı." });
    await writeActivityLog({ req, action: "permission_update", moduleName: "roles", entityId: id, newData: result.rows[0] });
    res.json(toApiObject(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

export default router;
