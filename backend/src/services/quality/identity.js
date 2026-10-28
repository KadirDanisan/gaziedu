import jwt from "jsonwebtoken";
import pool from "../../db/pool.js";
import { jwtSecret } from "../../config/env.js";

const QUALITY_TOKEN_ISSUER = "gaziedu-quality-education";
const QUALITY_TOKEN_AUDIENCE = "quality-education-v1";

const clean = (value, max = 250) => String(value ?? "").trim().slice(0, max);

/**
 * Gazi LDAP bağlantısı geldiğinde yalnızca bu fonksiyonun gerçek LDAP bind/search
 * uygulamasıyla değiştirilmesi gerekir. Geliştirme bypass'ı varsayılan olarak kapalıdır.
 */
const authenticateQualityIdentity = async ({ username, password }) => {
  const user = clean(username, 150);
  const pass = String(password ?? "");
  if (!user || !pass) {
    const error = new Error("Kullanıcı adı ve şifre zorunludur.");
    error.statusCode = 400;
    throw error;
  }

  if (String(process.env.QUALITY_LDAP_DEV_BYPASS || "").toLowerCase() !== "true") {
    const error = new Error("Gazi Üniversitesi LDAP bağlantısı henüz yapılandırılmadı.");
    error.statusCode = 503;
    error.code = "LDAP_NOT_CONFIGURED";
    throw error;
  }

  const nationalIdFromUsername = /^\d{11}$/.test(user) ? user : "";
  return {
    subject: `dev:${user.toLowerCase()}`,
    username: user,
    displayName: clean(process.env.QUALITY_LDAP_DEV_DISPLAY_NAME || user, 200),
    email: clean(process.env.QUALITY_LDAP_DEV_EMAIL || "", 250).toLowerCase(),
    nationalId: clean(process.env.QUALITY_LDAP_DEV_NATIONAL_ID || nationalIdFromUsername, 11).replace(/\D/g, ""),
  };
};

const upsertQualityIdentity = async (identity) => {
  await pool.query(
    `INSERT INTO quality_ldap_users
       (ldap_subject, username, display_name, email, national_id, last_login_at)
     VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NOW())
     ON CONFLICT (ldap_subject) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       national_id = COALESCE(EXCLUDED.national_id, quality_ldap_users.national_id),
       last_login_at = NOW(),
       updated_at = NOW()`,
    [identity.subject, identity.username, identity.displayName, identity.email, identity.nationalId],
  );
};

const signQualityToken = (identity) =>
  jwt.sign(
    {
      userType: "qualityLdap",
      ldapSubject: identity.subject,
      username: identity.username,
      displayName: identity.displayName,
      email: identity.email,
      nationalId: identity.nationalId,
    },
    jwtSecret,
    {
      expiresIn: "8h",
      issuer: QUALITY_TOKEN_ISSUER,
      audience: QUALITY_TOKEN_AUDIENCE,
    },
  );

const verifyQualityToken = (token) =>
  jwt.verify(token, jwtSecret, {
    issuer: QUALITY_TOKEN_ISSUER,
    audience: QUALITY_TOKEN_AUDIENCE,
  });

export {
  QUALITY_TOKEN_ISSUER,
  QUALITY_TOKEN_AUDIENCE,
  authenticateQualityIdentity,
  upsertQualityIdentity,
  signQualityToken,
  verifyQualityToken,
};
