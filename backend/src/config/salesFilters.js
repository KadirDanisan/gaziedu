/** Onaylanmış eğitimlerin satış/listeleme türü. Frontend kopyası: src/constants/salesFilters.js */
const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "Ücretli Eğitim Programları", requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "İş Birliği ve Sertifika Programları", requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "Kamu Yararına Yönelik Ücretsiz Eğitim Programları", requiresInstitution: false },
  {
    key: "kalite-egitim",
    label: "Kalite Eğitim",
    requiresInstitution: false,
    requiresInstructorVerification: true,
  },
];

/** Eski anahtar → yeni anahtar (DB'deki kayıtlar migration ile taşınır). */
const LEGACY_SALES_FILTER_KEYS = {
  "yok-mikro-yeterlilik": "kalite-egitim",
  "turk-egitim-sen": "kalite-egitim",
};

const DEFAULT_SALES_FILTER = "egitim-isbirligi-sertifikasyon";

const SALES_FILTER_KEYS = SALES_FILTERS.map((item) => item.key);

const salesFilterByKey = Object.fromEntries(SALES_FILTERS.map((item) => [item.key, item]));

const normalizeSalesFilter = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  const key = LEGACY_SALES_FILTER_KEYS[raw] || raw;
  return salesFilterByKey[key] ? key : "";
};

const salesFilterLabel = (value) => salesFilterByKey[normalizeSalesFilter(value)]?.label || "";

const salesFilterRequiresInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstitution);

/** Müfredat ve sınav erişimi için admin panelinden eğitmen doğrulaması gereken türler. */
const salesFilterRequiresInstructorVerification = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstructorVerification);

const FIRST_MODULE_PREVIEW_FILTERS = [
  "guzem-ucretli",
  "guzem-kamu-yarari-ucretsiz",
  "kalite-egitim",
];

const usesFirstModulePreview = (value) => FIRST_MODULE_PREVIEW_FILTERS.includes(normalizeSalesFilter(value));

export {
  SALES_FILTERS,
  SALES_FILTER_KEYS,
  LEGACY_SALES_FILTER_KEYS,
  DEFAULT_SALES_FILTER,
  salesFilterByKey,
  normalizeSalesFilter,
  salesFilterLabel,
  salesFilterRequiresInstitution,
  salesFilterRequiresInstructorVerification,
  FIRST_MODULE_PREVIEW_FILTERS,
  usesFirstModulePreview,
};
