import crypto from "node:crypto";
import express, { Router } from "express";
import pool from "../db/pool.js";
import { userAuth, isUuidParam } from "../middleware/auth.js";
import { halkbankConfig, missingHalkbankSettings } from "../config/halkbank.js";
import { computeRequestHash, verifyResponseHash } from "../services/payments/halkbankHash.js";
import { validatePaidApplicationInput } from "../services/education/applicationInput.js";
import { makeSlug } from "../utils/slug.js";

const router = Router();

/** 3D PAY Hosting'de banka tahsilatı yapar; başarı için ödeme sonucu + 3D sonucu birlikte aranır. */
const SUCCESS_MD_STATUSES = new Set(["1", "2", "3", "4"]);

/** Bankadan dönen yanıttan saklanacak alanlar (kart verisi olarak yalnızca maskeli numara). */
const STORED_RESPONSE_KEYS = [
  "Response",
  "ProcReturnCode",
  "mdStatus",
  "ErrMsg",
  "mdErrorMsg",
  "AuthCode",
  "TransId",
  "HostRefNum",
  "xid",
  "MaskedPan",
  "EXTRA.CARDBRAND",
  "EXTRA.TRXDATE",
  "oid",
  "amount",
  "currency",
  "clientid",
];

const formatAmount = (value) => Number(value).toFixed(2);

const generateOid = () => `GZM${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const pickStoredResponse = (body) =>
  Object.fromEntries(STORED_RESPONSE_KEYS.filter((key) => body[key] !== undefined).map((key) => [key, String(body[key])]));

router.post("/api/payments/halkbank/initiate", userAuth, async (req, res, next) => {
  const missing = missingHalkbankSettings();
  if (missing.length) {
    console.warn(`[halkbank] Ödeme başlatılamadı, eksik ayar: ${missing.join(", ")}`);
    return res.status(503).json({ message: "Online ödeme şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin." });
  }

  try {
    const validated = await validatePaidApplicationInput(req.body, req.user.id);
    if (validated.error) return res.status(validated.error.status).json({ message: validated.error.message });
    const { education, data, pricing } = validated;
    if (!(pricing.payableAmount > 0)) {
      return res.status(400).json({ message: "Bu eğitim için ödeme tutarı tanımlı değil." });
    }

    const client = await pool.connect();
    let applicationId;
    let payment;
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id, status, payment_status FROM education_applications WHERE user_id = $1 AND education_id = $2 LIMIT 1 FOR UPDATE`,
        [req.user.id, education.id],
      );
      const current = existing.rows[0];
      const applicationValues = [
        data.firstName,
        data.lastName,
        data.email,
        data.nationalId,
        data.phone,
        data.birthDate,
        data.graduationDocPath,
        data.kvkkDocPath,
        data.institutionDocPath,
        pricing.price,
        pricing.hasDiscount,
        pricing.discountRate,
        pricing.payableAmount,
      ];

      if (current) {
        if (current.status === "approved" || current.payment_status === "paid") {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Bu eğitim için başvurunuz ve ödemeniz zaten tamamlanmış." });
        }
        if (current.payment_status !== "unpaid") {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Bu eğitime daha önce başvurdunuz." });
        }
        await client.query(
          `UPDATE education_applications
           SET first_name = $1, last_name = $2, email = $3, national_id = $4, phone = $5, birth_date = $6::date,
               graduation_doc_path = $7, kvkk_doc_path = $8, institution_doc_path = $9, info_confirmed = TRUE,
               price_snapshot = $10, has_discount_snapshot = $11, discount_rate_snapshot = $12, payable_amount = $13,
               updated_at = NOW()
           WHERE id = $14`,
          [...applicationValues, current.id],
        );
        applicationId = current.id;
      } else {
        const inserted = await client.query(
          `INSERT INTO education_applications (
             first_name, last_name, email, national_id, phone, birth_date,
             graduation_doc_path, kvkk_doc_path, institution_doc_path,
             price_snapshot, has_discount_snapshot, discount_rate_snapshot, payable_amount,
             user_id, education_id, info_confirmed, payment_method, status, payment_status
           ) VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,'tek-cekim','pending','unpaid')
           RETURNING id`,
          [...applicationValues, req.user.id, education.id],
        );
        applicationId = inserted.rows[0].id;
      }

      const paymentInsert = await client.query(
        `INSERT INTO payments (user_id, education_id, application_id, oid, amount, currency)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, oid, amount`,
        [req.user.id, education.id, applicationId, generateOid(), pricing.payableAmount, halkbankConfig.currency],
      );
      payment = paymentInsert.rows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    const fields = {
      clientid: halkbankConfig.clientId,
      storetype: halkbankConfig.storeType,
      hashAlgorithm: halkbankConfig.hashAlgorithm,
      TranType: halkbankConfig.tranType,
      amount: formatAmount(payment.amount),
      currency: halkbankConfig.currency,
      oid: payment.oid,
      okUrl: halkbankConfig.callbackUrl,
      failUrl: halkbankConfig.callbackUrl,
      lang: halkbankConfig.lang,
      rnd: crypto.randomBytes(10).toString("hex"),
      Instalment: "",
      refreshtime: halkbankConfig.refreshTime,
      BillToName: `${data.firstName} ${data.lastName}`.trim(),
      encoding: halkbankConfig.encoding,
    };
    fields.hash = computeRequestHash(fields, halkbankConfig.storeKey);

    return res.status(201).json({
      paymentId: payment.id,
      applicationId,
      gatewayUrl: halkbankConfig.gatewayUrl,
      fields,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Bu eğitime daha önce başvurdunuz." });
    }
    return next(error);
  }
});

/** Banka okUrl/failUrl dönüşü: tarayıcı oturumuna bağlı değildir, yalnızca imzalı banka yanıtına güvenir. */
router.post(
  "/api/payments/halkbank/callback",
  express.urlencoded({ extended: false, limit: "64kb" }),
  async (req, res) => {
    const body = req.body || {};
    const redirectToResult = (paymentId, reason) => {
      const params = new URLSearchParams();
      if (paymentId) params.set("paymentId", paymentId);
      if (reason) params.set("reason", reason);
      return res.redirect(303, `${halkbankConfig.frontendBaseUrl}/odeme-sonuc?${params.toString()}`);
    };

    try {
      const oid = String(body.oid || body.ReturnOid || "").trim();
      if (!oid) return redirectToResult(null, "invalid");

      const found = await pool.query(`SELECT * FROM payments WHERE oid = $1 LIMIT 1`, [oid]);
      const payment = found.rows[0];
      if (!payment) {
        console.warn(`[halkbank] Bilinmeyen oid ile callback: ${oid}`);
        return redirectToResult(null, "invalid");
      }
      await pool.query(`UPDATE payments SET callback_count = callback_count + 1, updated_at = NOW() WHERE id = $1`, [payment.id]);

      if (!verifyResponseHash(body, halkbankConfig.storeKey)) {
        console.warn(`[halkbank] Hash doğrulaması başarısız, oid: ${oid}`);
        await pool.query(
          `UPDATE payments SET error_message = 'Banka yanıtının imzası doğrulanamadı.', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
          [payment.id],
        );
        return redirectToResult(payment.id);
      }

      const stored = pickStoredResponse(body);
      const mismatch =
        String(body.clientid || "") !== halkbankConfig.clientId ||
        formatAmount(body.amount) !== formatAmount(payment.amount) ||
        String(body.currency || "") !== String(payment.currency);
      if (mismatch) {
        console.warn(`[halkbank] Mağaza/tutar/para birimi uyuşmazlığı, oid: ${oid}`);
        await pool.query(
          `UPDATE payments
           SET status = 'review', error_message = 'Banka yanıtındaki mağaza, tutar veya para birimi siparişle eşleşmiyor.',
               response_data = $2, updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [payment.id, JSON.stringify(stored)],
        );
        return redirectToResult(payment.id);
      }

      const approved =
        body.Response === "Approved" && body.ProcReturnCode === "00" && SUCCESS_MD_STATUSES.has(String(body.mdStatus || ""));
      const resultColumns = [
        body.mdStatus || null,
        body.ProcReturnCode || null,
        body.Response || null,
        body.AuthCode || null,
        body.TransId || null,
        body.HostRefNum || null,
        JSON.stringify(stored),
      ];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (approved) {
          const updated = await client.query(
            `UPDATE payments
             SET status = 'paid', paid_at = NOW(), error_message = NULL,
                 md_status = $2, proc_return_code = $3, bank_response = $4, auth_code = $5, trans_id = $6, host_ref_num = $7,
                 response_data = $8, updated_at = NOW()
             WHERE id = $1 AND status <> 'paid'
             RETURNING id`,
            [payment.id, ...resultColumns],
          );
          if (updated.rows[0] && payment.application_id) {
            await client.query(
              `UPDATE education_applications
               SET payment_status = 'paid', paid_at = NOW(), payment_id = $2, updated_at = NOW()
               WHERE id = $1 AND COALESCE(payment_status, '') <> 'paid'`,
              [payment.application_id, payment.id],
            );
          }
        } else {
          await client.query(
            `UPDATE payments
             SET status = 'failed', error_message = $9,
                 md_status = $2, proc_return_code = $3, bank_response = $4, auth_code = $5, trans_id = $6, host_ref_num = $7,
                 response_data = $8, updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [payment.id, ...resultColumns, String(body.ErrMsg || body.mdErrorMsg || "Ödeme banka tarafından onaylanmadı.").slice(0, 500)],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      return redirectToResult(payment.id);
    } catch (error) {
      console.error("[halkbank] Callback işlenemedi:", error?.message || error);
      return redirectToResult(null, "error");
    }
  },
);

router.get("/api/payments/:paymentId/status", userAuth, async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId || "").trim();
    if (!isUuidParam(paymentId)) return res.status(400).json({ message: "Geçersiz ödeme." });
    const result = await pool.query(
      `SELECT p.id, p.status, p.amount, p.error_message, p.paid_at, p.created_at, p.education_id, e.name AS education_name
       FROM payments p
       LEFT JOIN educations e ON e.id = p.education_id
       WHERE p.id = $1 AND p.user_id = $2
       LIMIT 1`,
      [paymentId, req.user.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Ödeme kaydı bulunamadı." });
    return res.json({
      id: row.id,
      status: row.status,
      amount: row.amount != null ? Number(row.amount) : null,
      errorMessage: row.status === "failed" ? row.error_message || "" : "",
      paidAt: row.paid_at,
      createdAt: row.created_at,
      educationId: row.education_id,
      educationName: row.education_name || "",
      educationSlug: row.education_name ? makeSlug(row.education_name) : "",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
