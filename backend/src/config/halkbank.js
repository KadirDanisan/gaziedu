/**
 * Halkbank NestPay (3d_pay_hosting, ver3) yapılandırması.
 * StoreKey yalnızca ortam değişkeninden okunur; frontend'e, loglara veya Git'e yazılmaz.
 */
const env = (key) => String(process.env[key] || "").trim();

/** Callback sonrası kullanıcının yönlendirileceği site kökü */
const frontendBaseUrl = (env("FRONTEND_BASE_URL") || "https://uzaktan.gazi.edu.tr").replace(/\/+$/, "");

export const halkbankConfig = {
  clientId: env("HALKBANK_CLIENT_ID") || "500487032",
  storeKey: env("HALKBANK_STORE_KEY"),
  /** Bankanın verdiği test / canlı est3Dgate adresi */
  gatewayUrl: env("HALKBANK_GATEWAY_URL"),
  /** Bankanın okUrl/failUrl olarak POST ile döneceği adres; API aynı domainde /api altında yayınlanır. */
  callbackUrl: env("HALKBANK_CALLBACK_URL") || `${frontendBaseUrl}/api/payments/halkbank/callback`,
  frontendBaseUrl,
  storeType: "3d_pay_hosting",
  hashAlgorithm: "ver3",
  tranType: "Auth",
  currency: "949",
  lang: "tr",
  encoding: "UTF-8",
  refreshTime: "3",
};

export const missingHalkbankSettings = () =>
  [
    ["HALKBANK_STORE_KEY", halkbankConfig.storeKey],
    ["HALKBANK_GATEWAY_URL", halkbankConfig.gatewayUrl],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
