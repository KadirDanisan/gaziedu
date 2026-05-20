import jwt from "jsonwebtoken";

const ISSUER = "gaziedu-exam-portal";
const AUDIENCE = "exam-portal-v1";

const EDUCATION_CODE_RE = /^[A-Z]{3}-\d+-\d+-\d+$/;

function getLinkSecret() {
  const explicit = String(process.env.EXAM_PORTAL_LINK_SECRET || "").trim();
  if (explicit.length >= 16) return explicit;
  const base = String(process.env.JWT_SECRET || "dev-secret");
  return `${base}:exam-portal-link-v1`;
}

function normalizeEducationCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeNationalId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

/**
 * @param {{ educationCode: string, nationalId: string, participantName?: string }} payload
 * @param {{ expiresIn?: string }} [opts]
 */
export function signExamPortalLink(payload, opts = {}) {
  const ec = normalizeEducationCode(payload.educationCode);
  const tc = normalizeNationalId(payload.nationalId);
  if (!EDUCATION_CODE_RE.test(ec)) {
    throw new Error("Geçersiz eğitim kodu.");
  }
  if (!/^\d{11}$/.test(tc)) {
    throw new Error("Geçersiz T.C. kimlik no.");
  }
  const pn = String(payload.participantName || "")
    .trim()
    .slice(0, 200);
  const expiresIn = opts.expiresIn || "30d";
  return jwt.sign({ ec, tc, pn }, getLinkSecret(), {
    algorithm: "HS256",
    expiresIn,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * @returns {{ educationCode: string, nationalId: string, participantName: string }}
 */
export function verifyExamPortalLink(tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!token) {
    const err = new Error("Sınav bağlantısı geçersiz veya eksik.");
    err.statusCode = 401;
    throw err;
  }
  try {
    const decoded = jwt.verify(token, getLinkSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const ec = normalizeEducationCode(decoded.ec);
    const tc = normalizeNationalId(decoded.tc);
    const pn = String(decoded.pn || "").trim().slice(0, 200);
    if (!EDUCATION_CODE_RE.test(ec)) {
      const err = new Error("Sınav bağlantısı geçersiz.");
      err.statusCode = 401;
      throw err;
    }
    if (!/^\d{11}$/.test(tc)) {
      const err = new Error("Sınav bağlantısı geçersiz.");
      err.statusCode = 401;
      throw err;
    }
    return { educationCode: ec, nationalId: tc, participantName: pn || "—" };
  } catch (e) {
    if (e.statusCode) throw e;
    const err = new Error("Sınav bağlantısı geçersiz veya süresi dolmuş.");
    err.statusCode = 401;
    throw err;
  }
}
