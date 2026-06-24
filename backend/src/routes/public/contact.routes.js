import { Router } from "express";
import pool from "../../db/pool.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { verifyRecaptchaV2IfConfigured } from "../../utils/recaptcha.js";

const router = Router();

router.post("/api/contact-forms", async (req, res, next) => {
  try {
    const { fullName, email, phone, subject, message, recaptchaToken } = req.body || {};
    if (!fullName || !email || !message) {
      return res.status(400).json({ message: "Ad soyad, e-posta ve mesaj alanları zorunludur." });
    }

    const remoteip =
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() || req.socket?.remoteAddress || "";
    const captcha = await verifyRecaptchaV2IfConfigured(recaptchaToken, remoteip);
    if (!captcha.ok) {
      return res.status(400).json({ message: captcha.message });
    }

    const result = await pool.query(
      `INSERT INTO contact_forms (full_name, email, phone, subject, message, is_read)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [fullName, email, phone || null, subject || null, message, false],
    );

    return res.status(201).json(toApiObject(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/api/newsletter", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "E-posta alanı zorunludur." });
    }

    const result = await pool.query(
      `INSERT INTO newsletter (email)
       VALUES ($1)
       RETURNING *`,
      [email],
    );

    return res.status(201).json(toApiObject(result.rows[0]));
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Bu e-posta zaten bültene kayıtlı." });
    }
    return next(error);
  }
});

export default router;
