const RECAPTCHA_V2_ERROR_MESSAGES = {
  "missing-input-secret": "reCAPTCHA gizli anahtarı eksik (RECAPTCHA_SECRET_KEY).",
  "invalid-input-secret": "reCAPTCHA gizli anahtarı geçersiz. Secret Key’i kontrol edin (v2 Checkbox çifti olmalı).",
  "missing-input-response": 'reCAPTCHA yanıtı eksik. "Ben robot değilim" kutusunu işaretleyin.',
  "invalid-input-response": "reCAPTCHA yanıtı geçersiz veya süresi dolmuş. Kutuyu yeniden işaretleyin.",
  "bad-request": "reCAPTCHA isteği hatalı.",
  "timeout-or-duplicate": "reCAPTCHA süresi doldu veya tekrar kullanıldı. Lütfen kutuyu yeniden işaretleyin.",
};

function normalizeRecaptchaSecret(raw) {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/\u200b/g, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, "");
}

/** reCAPTCHA v2 — POST https://www.google.com/recaptcha/api/siteverify */
async function verifyRecaptchaV2IfConfigured(token, remoteip) {
  const secret = normalizeRecaptchaSecret(process.env.RECAPTCHA_SECRET_KEY);
  if (!secret) return { ok: true };

  const responseToken = typeof token === "string" ? token.trim() : "";
  if (!responseToken) {
    return {
      ok: false,
      message:
        'reCAPTCHA doğrulaması gerekli. İstemci Site Key (VITE_RECAPTCHA_SITE_KEY) ve "Ben robot değilim" kutusu gerekir.',
    };
  }

  const params = new URLSearchParams({
    secret,
    response: responseToken,
  });
  if (remoteip && String(remoteip).trim()) {
    params.set("remoteip", String(remoteip).trim());
  }

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (data.success) {
    return { ok: true };
  }

  const codes = Array.isArray(data["error-codes"]) ? data["error-codes"] : [];
  const firstCode = codes[0];
  const message =
    (firstCode && RECAPTCHA_V2_ERROR_MESSAGES[firstCode]) ||
    "reCAPTCHA doğrulanamadı. Lütfen tekrar deneyin.";

  return { ok: false, message, codes };
}

export { RECAPTCHA_V2_ERROR_MESSAGES, normalizeRecaptchaSecret, verifyRecaptchaV2IfConfigured };
