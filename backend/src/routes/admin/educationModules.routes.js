import { Router } from "express";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { loadEducationModules } from "../../services/education/modules.js";

const router = Router();

router.get("/api/admin/education-modules", auth, async (req, res, next) => {
  try {
    const educationId = String(req.query.educationId || "").trim();
    if (!educationId) {
      return res.status(400).json({ message: "educationId gerekli." });
    }
    const permissionResult = await pool.query(
      `SELECT can_view FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`,
      [req.user.roleId, "educations"],
    );
    if (!permissionResult.rows[0]?.can_view) {
      return res.status(403).json({ message: "Yetkiniz yok." });
    }
    const data = await loadEducationModules(educationId);
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
});

export default router;
