import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { isValidTurkishNationalId } from "../../utils/nationalId.js";
import { writeActivityLog } from "../../services/activityLog.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../../../assets/certificates/TopluKullaniciEkleme.xlsx");
const MAX_ROWS_PER_REQUEST = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const splitFullName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

router.get("/api/admin/normal-users/bulk-template", auth, checkPermission("normalUsers", "can_create"), (req, res) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    return res.status(404).json({ message: "Toplu kullanıcı ekleme şablonu sunucuda bulunamadı." });
  }
  return res.download(TEMPLATE_PATH, "TopluKullaniciEkleme.xlsx");
});

router.post("/api/admin/normal-users/bulk-import", auth, checkPermission("normalUsers", "can_create"), async (req, res, next) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows || !rows.length) return res.status(400).json({ message: "İçe aktarılacak satır bulunamadı." });
  if (rows.length > MAX_ROWS_PER_REQUEST) {
    return res.status(400).json({ message: `Tek istekte en fazla ${MAX_ROWS_PER_REQUEST} satır gönderilebilir.` });
  }

  const results = [];
  const createdIds = [];

  try {
    for (const raw of rows) {
      const sheetRow = Number(raw?.sheetRow) || null;
      const nationalId = String(raw?.nationalId ?? "").replace(/\D/g, "");
      const fullName = String(raw?.fullName ?? "").replace(/\s+/g, " ").trim();
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const fail = (reason) => results.push({ sheetRow, nationalId, fullName, email, status: "failed", reason });
      const skip = (reason) => results.push({ sheetRow, nationalId, fullName, email, status: "skipped", reason });

      if (!nationalId || !fullName || !email) {
        fail("T.C. Kimlik No, Ad Soyad ve E-Posta alanları zorunludur.");
        continue;
      }
      if (nationalId.length !== 11 || !isValidTurkishNationalId(nationalId)) {
        fail("Geçersiz T.C. kimlik numarası.");
        continue;
      }
      const names = splitFullName(fullName);
      if (!names) {
        fail("Ad ve soyad birlikte yazılmalıdır.");
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        fail("Geçersiz e-posta adresi.");
        continue;
      }

      const existing = await pool.query(
        `SELECT
           EXISTS (SELECT 1 FROM normal_users WHERE LOWER(email) = $1) AS email_taken,
           EXISTS (SELECT 1 FROM normal_user_details WHERE national_id = $2) AS tc_taken`,
        [email, nationalId],
      );
      if (existing.rows[0]?.email_taken) {
        skip("Bu e-posta ile kayıtlı bir kullanıcı zaten var.");
        continue;
      }
      if (existing.rows[0]?.tc_taken) {
        skip("Bu T.C. kimlik numarası ile kayıtlı bir kullanıcı zaten var.");
        continue;
      }

      const passwordHash = await bcrypt.hash(nationalId.slice(-6), 10);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query(
          `INSERT INTO normal_users (first_name, last_name, email, password_hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [names.firstName, names.lastName, email, passwordHash],
        );
        const userId = inserted.rows[0].id;
        await client.query(
          `INSERT INTO normal_user_details (user_id, national_id, updated_at) VALUES ($1, $2, NOW())`,
          [userId, nationalId],
        );
        await client.query("COMMIT");
        createdIds.push(userId);
        results.push({ sheetRow, nationalId, fullName, email, status: "created" });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error?.code === "23505") skip("E-posta veya T.C. kimlik numarası başka bir kayıtta kullanılıyor.");
        else fail("Kayıt oluşturulamadı.");
      } finally {
        client.release();
      }
    }

    if (createdIds.length) {
      await writeActivityLog({
        req,
        action: "create",
        moduleName: "normalUsers",
        newData: { bulkImport: true, createdCount: createdIds.length, userIds: createdIds },
      }).catch(() => {});
    }

    return res.json({
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
