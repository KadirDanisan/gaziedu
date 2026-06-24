import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";
import { userAuth } from "../middleware/auth.js";
import { isValidTurkishNationalId } from "../utils/nationalId.js";
import { formatNormalUserMeResponse } from "../services/users/format.js";
import { formatPublicCourse } from "../services/education/publicCourses.js";
import { formatEducationReviewRow, formatRatingAggregateFields } from "../services/education/publicCourses.js";
import { extractEducationContentHtml } from "../services/education/content.js";

const router = Router();

router.post("/api/users/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, nationalId } = req.body || {};
    const tcEmpty =
      nationalId === undefined || nationalId === null || String(nationalId).replace(/\D/g, "").length === 0;
    if (!firstName || !lastName || !email || !password || tcEmpty) {
      return res.status(400).json({ message: "Ad, soyad, e-posta, şifre ve T.C. kimlik numarası zorunludur." });
    }

    const digits = String(nationalId).replace(/\D/g, "");
    if (digits.length !== 11) {
      return res.status(400).json({ message: "T.C. kimlik numarası 11 haneli olmalıdır." });
    }
    if (!isValidTurkishNationalId(digits)) {
      return res.status(400).json({ message: "Geçerli bir T.C. kimlik numarası giriniz." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO normal_users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, first_name, last_name, email, created_at, updated_at`,
        [String(firstName).trim(), String(lastName).trim(), String(email).trim().toLowerCase(), passwordHash],
      );
      const user = result.rows[0];
      await client.query(
        `INSERT INTO normal_user_details (user_id, national_id, updated_at) VALUES ($1, $2, NOW())`,
        [user.id, digits],
      );
      await client.query("COMMIT");

      const token = jwt.sign({ id: user.id, userType: "normalUser" }, jwtSecret, { expiresIn: "12h" });
      return res.status(201).json({
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505") {
        const detail = String(err.detail || "").toLowerCase();
        const c = String(err.constraint || "").toLowerCase();
        const isNational =
          detail.includes("national_id") || c.includes("national_id") || c.includes("national");
        if (isNational) {
          return res.status(409).json({ message: "Bu T.C. kimlik numarası ile zaten kayıt bulunmaktadır." });
        }
        return res.status(409).json({ message: "Bu e-posta ile daha önce kayıt olunmuş." });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.post("/api/users/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
    }

    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash
       FROM normal_users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const token = jwt.sign({ id: user.id, userType: "normalUser" }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/users/me", userAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              d.national_id, d.gender, d.user_type,
              d.address_line1, d.address_line2, d.country_code, d.city, d.district, d.postal_code
       FROM normal_users u
       LEFT JOIN normal_user_details d ON d.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [req.user.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    const user = { id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email };
    const details = {
      national_id: row.national_id,
      gender: row.gender,
      user_type: row.user_type,
      address_line1: row.address_line1,
      address_line2: row.address_line2,
      country_code: row.country_code,
      city: row.city,
      district: row.district,
      postal_code: row.postal_code,
    };
    return res.json(formatNormalUserMeResponse(user, details));
  } catch (error) {
    return next(error);
  }
});

router.patch("/api/users/me", userAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      email,
      nationalId,
      gender,
      customerType,
      addressLine1,
      addressLine2,
      countryCode,
      city,
      district,
      postalCode,
    } = body;

    const curUserResult = await pool.query(
      `SELECT id, first_name, last_name, email FROM normal_users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const curUser = curUserResult.rows[0];
    if (!curUser) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!nextEmail) {
        return res.status(400).json({ message: "E-posta boş olamaz." });
      }
      if (nextEmail !== curUser.email) {
        const dup = await pool.query(`SELECT 1 FROM normal_users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`, [
          nextEmail,
          userId,
        ]);
        if (dup.rows[0]) {
          return res.status(409).json({ message: "Bu e-posta adresi başka bir hesapta kullanılıyor." });
        }
      }
    }

    if (firstName !== undefined && !String(firstName).trim()) {
      return res.status(400).json({ message: "Ad boş olamaz." });
    }
    if (lastName !== undefined && !String(lastName).trim()) {
      return res.status(400).json({ message: "Soyad boş olamaz." });
    }

    const userUpdates = [];
    const userVals = [];
    if (firstName !== undefined) {
      userVals.push(String(firstName).trim());
      userUpdates.push(`first_name = $${userVals.length}`);
    }
    if (lastName !== undefined) {
      userVals.push(String(lastName).trim());
      userUpdates.push(`last_name = $${userVals.length}`);
    }
    if (email !== undefined) {
      userVals.push(String(email).trim().toLowerCase());
      userUpdates.push(`email = $${userVals.length}`);
    }
    if (userUpdates.length) {
      userVals.push(userId);
      await pool.query(
        `UPDATE normal_users SET ${userUpdates.join(", ")}, updated_at = NOW() WHERE id = $${userVals.length}`,
        userVals,
      );
    }

    const detailKey = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const hasDetailPatch =
      detailKey("nationalId") ||
      detailKey("gender") ||
      detailKey("customerType") ||
      detailKey("addressLine1") ||
      detailKey("addressLine2") ||
      detailKey("countryCode") ||
      detailKey("city") ||
      detailKey("district") ||
      detailKey("postalCode");

    if (hasDetailPatch) {
      const detRes = await pool.query(
        `SELECT national_id, gender, user_type, address_line1, address_line2, country_code, city, district, postal_code
         FROM normal_user_details WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const curDet = detRes.rows[0];
      let nextNational = curDet?.national_id ?? null;
      let nextGender = curDet?.gender ?? null;
      let nextUserType = curDet?.user_type ?? null;
      let nextAddr1 = curDet?.address_line1 ?? null;
      let nextAddr2 = curDet?.address_line2 ?? null;
      let nextCountry = curDet?.country_code ?? null;
      let nextCity = curDet?.city ?? null;
      let nextDistrict = curDet?.district ?? null;
      let nextPostal = curDet?.postal_code ?? null;

      if (detailKey("nationalId")) {
        const raw = nationalId === null || nationalId === undefined ? "" : String(nationalId).replace(/\D/g, "");
        if (raw && raw.length !== 11) {
          return res.status(400).json({ message: "T.C. kimlik numarası 11 haneli olmalıdır." });
        }
        nextNational = raw || null;
      }

      if (detailKey("gender")) {
        const gv =
          gender === null || gender === undefined || gender === "" ? null : String(gender);
        if (gv && !["1", "2", "3"].includes(gv)) {
          return res.status(400).json({ message: "Geçersiz cinsiyet seçimi." });
        }
        nextGender = gv;
      }

      if (detailKey("customerType")) {
        const ct = String(customerType);
        if (!["1", "2"].includes(ct)) {
          return res.status(400).json({ message: "Geçersiz kullanıcı tipi." });
        }
        nextUserType = ct === "2" ? "kurumsal" : "bireysel";
      }

      const trimOrNull = (v, maxLen) => {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (!s) return null;
        return maxLen ? s.slice(0, maxLen) : s;
      };

      if (detailKey("addressLine1")) {
        const v = trimOrNull(addressLine1, 500);
        if (!v) {
          return res.status(400).json({ message: "Adres satırı zorunludur." });
        }
        nextAddr1 = v;
      }

      if (detailKey("addressLine2")) {
        nextAddr2 = trimOrNull(addressLine2, 500);
      }

      if (detailKey("countryCode")) {
        const raw = countryCode === null || countryCode === undefined ? "" : String(countryCode).trim();
        if (!raw) {
          return res.status(400).json({ message: "Ülke seçimi zorunludur." });
        }
        nextCountry = raw.slice(0, 16);
      }

      if (detailKey("city")) {
        const v = trimOrNull(city, 120);
        if (!v) {
          return res.status(400).json({ message: "Şehir zorunludur." });
        }
        nextCity = v;
      }

      if (detailKey("district")) {
        const v = trimOrNull(district, 120);
        if (!v) {
          return res.status(400).json({ message: "İlçe / bölge zorunludur." });
        }
        nextDistrict = v;
      }

      if (detailKey("postalCode")) {
        const v = trimOrNull(postalCode, 32);
        if (!v) {
          return res.status(400).json({ message: "Posta kodu zorunludur." });
        }
        nextPostal = v;
      }

      await pool.query(
        `INSERT INTO normal_user_details (
           user_id, national_id, gender, user_type,
           address_line1, address_line2, country_code, city, district, postal_code,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           national_id = EXCLUDED.national_id,
           gender = EXCLUDED.gender,
           user_type = EXCLUDED.user_type,
           address_line1 = EXCLUDED.address_line1,
           address_line2 = EXCLUDED.address_line2,
           country_code = EXCLUDED.country_code,
           city = EXCLUDED.city,
           district = EXCLUDED.district,
           postal_code = EXCLUDED.postal_code,
           updated_at = NOW()`,
        [
          userId,
          nextNational,
          nextGender,
          nextUserType,
          nextAddr1,
          nextAddr2,
          nextCountry,
          nextCity,
          nextDistrict,
          nextPostal,
        ],
      );
    }

    const fresh = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              d.national_id, d.gender, d.user_type,
              d.address_line1, d.address_line2, d.country_code, d.city, d.district, d.postal_code
       FROM normal_users u
       LEFT JOIN normal_user_details d ON d.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    );
    const r = fresh.rows[0];
    const userOut = { id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email };
    const detailsOut = {
      national_id: r.national_id,
      gender: r.gender,
      user_type: r.user_type,
      address_line1: r.address_line1,
      address_line2: r.address_line2,
      country_code: r.country_code,
      city: r.city,
      district: r.district,
      postal_code: r.postal_code,
    };
    return res.json(formatNormalUserMeResponse(userOut, detailsOut));
  } catch (error) {
    return next(error);
  }
});

router.get("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT f.created_at AS sort_date, e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.category_id, c.category_name, NULL::timestamptz AS calendar_date, f.target_type AS source_type, e.rating_average, e.rating_count, e.institution_id, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url
       FROM user_favorites f
       INNER JOIN educations e ON f.target_type = 'education' AND e.id = f.education_id
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       WHERE f.user_id = $1
       UNION ALL
       SELECT f.created_at, ec.id, ec.education_name AS name, ec.description, ec.image_url, ec.code, ec.duration, ec.content_doc_path, ec.category_id, c2.category_name, ec.calendar_date, f.target_type AS source_type, ec.rating_average, ec.rating_count, ec.institution_id, inst2.name AS institution_name, inst2.logo_url AS institution_logo_url, inst2.website_url AS institution_website_url
       FROM user_favorites f
       INNER JOIN education_calendar ec ON f.target_type = 'calendar' AND ec.id = f.calendar_id
       LEFT JOIN education_categories c2 ON c2.id = ec.category_id
       LEFT JOIN institutions inst2 ON inst2.id = ec.institution_id
       WHERE f.user_id = $1
       ORDER BY sort_date DESC`,
      [req.user.id],
    );
    const rowsWithContent = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        content_html: await extractEducationContentHtml(row.content_doc_path),
      })),
    );
    return res.json(rowsWithContent.map((row) => formatPublicCourse(row)));
  } catch (error) {
    return next(error);
  }
});

router.post("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const { educationId, calendarId } = req.body || {};
    const hasE = Boolean(educationId);
    const hasC = Boolean(calendarId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId gönderin." });
    }
    if (educationId) {
      const education = await pool.query(`SELECT id FROM educations WHERE id = $1 LIMIT 1`, [educationId]);
      if (!education.rows[0]) {
        return res.status(404).json({ message: "Eğitim bulunamadı." });
      }
      await pool.query(
        `INSERT INTO user_favorites (user_id, target_type, education_id, calendar_id)
         SELECT $1, 'education', $2, NULL
         WHERE NOT EXISTS (
           SELECT 1 FROM user_favorites WHERE user_id = $1 AND target_type = 'education' AND education_id = $2
         )`,
        [req.user.id, educationId],
      );
    } else {
      const cal = await pool.query(`SELECT id FROM education_calendar WHERE id = $1 LIMIT 1`, [calendarId]);
      if (!cal.rows[0]) {
        return res.status(404).json({ message: "Takvim kaydı bulunamadı." });
      }
      await pool.query(
        `INSERT INTO user_favorites (user_id, target_type, education_id, calendar_id)
         SELECT $1, 'calendar', NULL, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM user_favorites WHERE user_id = $1 AND target_type = 'calendar' AND calendar_id = $2
         )`,
        [req.user.id, calendarId],
      );
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.delete("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const educationId = String(req.query.educationId || "").trim();
    const calendarId = String(req.query.calendarId || "").trim();
    if (Boolean(educationId) === Boolean(calendarId)) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId query parametresi gönderin." });
    }
    if (educationId) {
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND target_type = 'education' AND education_id = $2`,
        [req.user.id, educationId],
      );
    } else {
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND target_type = 'calendar' AND calendar_id = $2`,
        [req.user.id, calendarId],
      );
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/api/users/education-reviews", userAuth, async (req, res, next) => {
  try {
    const { educationId, calendarId, rating: rawRating, comment: rawComment } = req.body || {};
    const eId = String(educationId || "").trim();
    const cId = String(calendarId || "").trim();
    const hasE = Boolean(eId);
    const hasC = Boolean(cId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId gönderin." });
    }

    let rating = Number(rawRating);
    if (!Number.isFinite(rating)) rating = 5;
    rating = Math.min(5, Math.max(1, Math.round(rating)));

    const commentText = rawComment != null ? String(rawComment).trim() : "";
    const comment = commentText.length ? commentText.slice(0, 4000) : null;

    let result;
    if (eId) {
      const education = await pool.query(`SELECT id FROM educations WHERE id = $1 LIMIT 1`, [eId]);
      if (!education.rows[0]) {
        return res.status(404).json({ message: "Eğitim bulunamadı." });
      }
      result = await pool.query(
        `INSERT INTO education_reviews (user_id, target_type, education_id, calendar_id, rating, comment)
         VALUES ($1, 'education', $2, NULL, $3, $4)
         ON CONFLICT (user_id, education_id) WHERE target_type = 'education'
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
         RETURNING id, rating, comment, created_at`,
        [req.user.id, eId, rating, comment],
      );
    } else {
      const cal = await pool.query(`SELECT id FROM education_calendar WHERE id = $1 LIMIT 1`, [cId]);
      if (!cal.rows[0]) {
        return res.status(404).json({ message: "Takvim kaydı bulunamadı." });
      }
      result = await pool.query(
        `INSERT INTO education_reviews (user_id, target_type, education_id, calendar_id, rating, comment)
         VALUES ($1, 'calendar', NULL, $2, $3, $4)
         ON CONFLICT (user_id, calendar_id) WHERE target_type = 'calendar'
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
         RETURNING id, rating, comment, created_at`,
        [req.user.id, cId, rating, comment],
      );
    }

    const userRow = await pool.query(`SELECT first_name, last_name FROM normal_users WHERE id = $1 LIMIT 1`, [
      req.user.id,
    ]);
    const aggRow = eId
      ? (await pool.query(`SELECT rating_average, rating_count FROM educations WHERE id = $1 LIMIT 1`, [eId])).rows[0]
      : (await pool.query(`SELECT rating_average, rating_count FROM education_calendar WHERE id = $1 LIMIT 1`, [cId]))
          .rows[0];
    return res.status(200).json({
      ok: true,
      review: formatEducationReviewRow({ ...result.rows[0], ...userRow.rows[0] }),
      ...formatRatingAggregateFields(aggRow || {}),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
