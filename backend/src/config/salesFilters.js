/** Onaylanmış eğitimlerin satış/listeleme türü. Frontend kopyası: src/constants/salesFilters.js */
const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "GUZEM ÜCRETLİ EĞİTİM", requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "Eğitim İşbirliği Sertifikasyon Eğitimleri", requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "GUZEM KAMU YARARI (ÜCRETSİZ) EĞİTİMLER", requiresInstitution: false },
  { key: "yok-mikro-yeterlilik", label: "YÖK MİKRO YETERLİLİK EĞİTİMLERİ", requiresInstitution: false },
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
