/** Onaylanmış eğitimlerin satış/listeleme türü. Frontend kopyası: src/constants/salesFilters.js */
const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "Ücretli Eğitim Programları", supportsInstitution: true, requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "İş Birliği ve Sertifika Programları", supportsInstitution: true, requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "Kamu Yararına Yönelik Ücretsiz Eğitim Programları", supportsInstitution: true, requiresInstitution: false },
  {
    key: "kalite-egitim",
    label: "Kalite Eğitim",
    supportsInstitution: true,
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

const salesFilterSupportsInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.supportsInstitution);

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
  salesFilterSupportsInstitution,
  salesFilterRequiresInstructorVerification,
  FIRST_MODULE_PREVIEW_FILTERS,
  usesFirstModulePreview,
};
