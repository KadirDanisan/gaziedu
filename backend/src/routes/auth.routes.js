import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";
import { auth } from "../middleware/auth.js";
import { writeActivityLog } from "../services/activityLog.js";

const router = Router();

router.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash, a.role_id, r.code AS role_code, r.name AS role_name
       FROM admin_users a
       INNER JOIN roles r ON r.id = a.role_id
       WHERE a.email = $1 AND a.is_active = TRUE
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    const token = jwt.sign({ id: user.id, roleId: user.role_id, roleCode: user.role_code }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        roleId: user.role_id,
        roleCode: user.role_code,
        roleName: user.role_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Oturumdaki yöneticinin kendi ad, soyad, e-posta ve isteğe bağlı şifre güncellemesi */
router.patch("/api/auth/admin/me", auth, async (req, res, next) => {
  try {
    if (req.user.userType === "normalUser" || !req.user.id || !req.user.roleId) {
      return res.status(403).json({ message: "Bu islem yonetici oturumu gerektirir." });
    }
    const { firstName, lastName, email, currentPassword, newPassword } = req.body || {};
    const fn = String(firstName ?? "").trim();
    const ln = String(lastName ?? "").trim();
    const em = String(email ?? "").trim().toLowerCase();
    if (!fn || !ln || !em) {
      return res.status(400).json({ message: "Ad, soyad ve e-posta zorunludur." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ message: "Gecerli bir e-posta giriniz." });
    }
    const existing = await pool.query(
      `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash, a.role_id
       FROM admin_users a
       WHERE a.id = $1 AND a.is_active = TRUE
       LIMIT 1`,
      [req.user.id],
    );
    const u = existing.rows[0];
    if (!u) return res.status(404).json({ message: "Hesap bulunamadi." });

    const emailChanged = em !== String(u.email || "").trim().toLowerCase();
    const np = newPassword != null ? String(newPassword) : "";
    const passwordChanging = np.length > 0;
    if (passwordChanging && np.length < 6) {
      return res.status(400).json({ message: "Yeni sifre en az 6 karakter olmalidir." });
    }

    if (emailChanged || passwordChanging) {
      const curPw = String(currentPassword || "");
      if (!curPw || !(await bcrypt.compare(curPw, u.password_hash))) {
        return res.status(400).json({ message: "E-posta veya sifre degisikligi icin mevcut sifrenizi dogru giriniz." });
      }
    }

    if (emailChanged) {
      const clash = await pool.query(
        `SELECT id FROM admin_users WHERE LOWER(TRIM(email)) = LOWER($1) AND id <> $2 LIMIT 1`,
        [em, req.user.id],
      );
      if (clash.rows[0]) return res.status(400).json({ message: "Bu e-posta adresi baska bir hesapta kullaniliyor." });
    }

    const newHash = passwordChanging ? await bcrypt.hash(np, 10) : u.password_hash;
    const upd = await pool.query(
      `UPDATE admin_users SET first_name = $1, last_name = $2, email = $3, password_hash = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, first_name, last_name, email, role_id`,
      [fn, ln, em, newHash, req.user.id],
    );
    const row = upd.rows[0];
    const roleRow = await pool.query(`SELECT code, name FROM roles WHERE id = $1 LIMIT 1`, [row.role_id]);
    const rc = roleRow.rows[0]?.code || req.user.roleCode;
    const rn = roleRow.rows[0]?.name || "";

    await writeActivityLog({
      req,
      action: "update",
      moduleName: "adminUsers",
      entityId: row.id,
      oldData: {
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        emailChanged,
        passwordChanged: passwordChanging,
      },
      newData: { email: row.email, firstName: row.first_name, lastName: row.last_name },
    });

    const newToken = jwt.sign({ id: row.id, roleId: row.role_id, roleCode: rc }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token: newToken,
      user: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        roleId: row.role_id,
        roleCode: rc,
        roleName: rn,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
