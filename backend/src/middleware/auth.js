import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Yetkisiz erişim." });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Oturum geçersiz." });
  }
};

const userAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Yetkisiz erişim." });
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload.userType !== "normalUser") {
      return res.status(401).json({ message: "Geçersiz kullanıcı oturumu." });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Oturum geçersiz." });
  }
};

const checkPermission = (moduleName, action) => async (req, res, next) => {
  const result = await pool.query(
    `SELECT can_view, can_create, can_update, can_delete FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`,
    [req.user.roleId, moduleName],
  );
  const permission = result.rows[0];
  if (!permission) return res.status(403).json({ message: "Yetkiniz yok." });
  if (!permission[action]) return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
  next();
};

/** Duyuru ve grup oluşturma: yalnızca Süper Admin ve Admin rolleri */
const isAdminMessagingLead = (req) => ["superadmin", "admin"].includes(req.user?.roleCode);

const isUuidParam = (value) => {
  const s = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
};

export { auth, userAuth, checkPermission, isAdminMessagingLead, isUuidParam };
