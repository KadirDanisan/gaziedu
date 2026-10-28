/** Onaylanmış eğitimlerin satış/listeleme türü. Backend kopyası: backend/src/config/salesFilters.js */
export const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "Ücretli Eğitim Programları", supportsInstitution: true, requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "İş Birliği ve Sertifika Programları", supportsInstitution: true, requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "Kamu Yararına Yönelik Ücretsiz Eğitim Programları", supportsInstitution: true, requiresInstitution: false },
  {
    key: "kalite-egitim",
    label: "Kalite Eğitim",
    supportsInstitution: true,
    requiresInstitution: false,
    requiresLdap: true,
  },
];

/** Eski anahtar → yeni anahtar (eski linkler / önbellekteki veriler için). */
export const LEGACY_SALES_FILTER_KEYS = {
  "yok-mikro-yeterlilik": "kalite-egitim",
  "turk-egitim-sen": "kalite-egitim",
};

export const DEFAULT_SALES_FILTER = "egitim-isbirligi-sertifikasyon";

export const SALES_FILTER_KEYS = SALES_FILTERS.map((item) => item.key);
export const PUBLIC_SALES_FILTERS = SALES_FILTERS.filter((item) => item.key !== "kalite-egitim");

export const salesFilterByKey = Object.fromEntries(SALES_FILTERS.map((item) => [item.key, item]));

export const normalizeSalesFilter = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  const key = LEGACY_SALES_FILTER_KEYS[raw] || raw;
  return salesFilterByKey[key] ? key : "";
};

export const salesFilterLabel = (value) => salesFilterByKey[normalizeSalesFilter(value)]?.label || "";

export const salesFilterRequiresInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstitution);

export const salesFilterSupportsInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.supportsInstitution);

/** Müfredat ve sınav erişimi için admin panelinden eğitmen doğrulaması gereken türler. */
export const salesFilterRequiresInstructorVerification = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstructorVerification);

/** Girişsiz ilk modül önizlemesi: 30 sn video, PDF/sunum yalnızca görüntüleme. */
export const FIRST_MODULE_PREVIEW_FILTERS = [
  "guzem-ucretli",
  "guzem-kamu-yarari-ucretsiz",
  "kalite-egitim",
];

export const usesFirstModulePreview = (value) =>
  FIRST_MODULE_PREVIEW_FILTERS.includes(normalizeSalesFilter(value));
