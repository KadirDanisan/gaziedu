/** Onaylanmış eğitimlerin satış/listeleme türü. Frontend kopyası: src/constants/salesFilters.js */
const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "Ücretli Eğitim Programları", requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "İş Birliği ve Sertifika Programları", requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "Kamu Yararına Yönelik Ücretsiz Eğitim Programları", requiresInstitution: false },
  { key: "yok-mikro-yeterlilik", label: "YÖK Mikro Yeterlilik Programları", requiresInstitution: false },
];

const DEFAULT_SALES_FILTER = "egitim-isbirligi-sertifikasyon";

const SALES_FILTER_KEYS = SALES_FILTERS.map((item) => item.key);

const salesFilterByKey = Object.fromEntries(SALES_FILTERS.map((item) => [item.key, item]));

const normalizeSalesFilter = (value) => {
  const key = String(value ?? "").trim().toLowerCase();
  return salesFilterByKey[key] ? key : "";
};

const salesFilterLabel = (value) => salesFilterByKey[normalizeSalesFilter(value)]?.label || "";

const salesFilterRequiresInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstitution);

export {
  SALES_FILTERS,
  SALES_FILTER_KEYS,
  DEFAULT_SALES_FILTER,
  salesFilterByKey,
  normalizeSalesFilter,
  salesFilterLabel,
  salesFilterRequiresInstitution,
};
