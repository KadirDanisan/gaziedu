import pool from "../../db/pool.js";
import { isUuidParam } from "../../middleware/auth.js";
import { isValidTurkishNationalId } from "../../utils/nationalId.js";

const computePayableAmount = (price, hasDiscount, discountRate) => {
  if (price == null) return null;
  if (hasDiscount && discountRate != null && discountRate > 0) {
    return Math.round(price * (1 - Math.min(100, discountRate) / 100) * 100) / 100;
  }
  return price;
};

/**
 * Ücretli eğitim başvuru formunu doğrular; tutarı veritabanındaki fiyat/indirimden hesaplar.
 * @returns {Promise<{ error: { status: number, message: string } } | { education: object, data: object, pricing: object }>}
 */
export async function validatePaidApplicationInput(body, userId) {
  const fail = (status, message) => ({ error: { status, message } });
  const {
    educationId,
    firstName,
    lastName,
    nationalId,
    phone,
    birthDate,
    graduationDocPath,
    kvkkDocPath,
    institutionDocPath,
    infoConfirmed,
  } = body || {};

  const eId = String(educationId || "").trim();
  if (!isUuidParam(eId)) return fail(400, "Geçerli bir eğitim seçiniz.");

  const education = await pool.query(
    `SELECT id, name, code, sales_filter, price, has_discount, discount_rate FROM educations WHERE id = $1 LIMIT 1`,
    [eId],
  );
  const edu = education.rows[0];
  if (!edu) return fail(404, "Eğitim bulunamadı.");
  if (String(edu.sales_filter || "").toLowerCase() !== "guzem-ucretli") {
    return fail(400, "Bu eğitim için online başvuru açılamaz.");
  }

  const account = await pool.query(`SELECT email FROM normal_users WHERE id = $1 LIMIT 1`, [userId]);
  const email = String(account.rows[0]?.email || "").trim().toLowerCase();
  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  const tc = String(nationalId || "").replace(/\D/g, "");
  let tel = String(phone || "").replace(/\D/g, "");
  if (tel.startsWith("0")) tel = tel.slice(1);
  tel = tel.slice(0, 10);
  const birth = String(birthDate || "").trim();
  const gradPath = String(graduationDocPath || "").trim();
  const kvkkPath = String(kvkkDocPath || "").trim();
  const instPath = String(institutionDocPath || "").trim();

  if (!fn || !ln || !email || !tel || !birth) return fail(400, "Zorunlu başvuru alanlarını doldurunuz.");
  if (tel.length !== 10) return fail(400, "Telefon numarası 10 haneli olmalıdır.");
  if (tc.length !== 11 || !isValidTurkishNationalId(tc)) return fail(400, "Geçerli bir T.C. kimlik numarası giriniz.");
  const birthDateObj = new Date(birth);
  if (Number.isNaN(birthDateObj.getTime()) || birthDateObj > new Date()) return fail(400, "Geçerli bir doğum tarihi giriniz.");
  if (!gradPath || !kvkkPath || !instPath) return fail(400, "Başvuru formundaki tüm belgeleri yükleyiniz.");
  if (!infoConfirmed) return fail(400, "Bilgilerinizi onaylamanız gerekmektedir.");

  const price = edu.price != null ? Number(edu.price) : null;
  const hasDiscount = Boolean(edu.has_discount);
  const discountRate = edu.discount_rate != null ? Number(edu.discount_rate) : null;

  return {
    education: edu,
    data: {
      firstName: fn,
      lastName: ln,
      email,
      nationalId: tc,
      phone: tel,
      birthDate: birth,
      graduationDocPath: gradPath,
      kvkkDocPath: kvkkPath,
      institutionDocPath: instPath,
    },
    pricing: {
      price,
      hasDiscount,
      discountRate,
      payableAmount: computePayableAmount(price, hasDiscount, discountRate),
    },
  };
}
