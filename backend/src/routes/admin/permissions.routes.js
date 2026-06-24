import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { toApiObject, toDbObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";

const router = Router();

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
