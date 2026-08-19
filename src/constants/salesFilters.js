/** Onaylanmış eğitimlerin satış/listeleme türü. Backend kopyası: backend/src/config/salesFilters.js */
export const SALES_FILTERS = [
  { key: "guzem-ucretli", label: "GUZEM ÜCRETLİ EĞİTİM", requiresInstitution: false },
  { key: "egitim-isbirligi-sertifikasyon", label: "Eğitim İşbirliği Sertifikasyon Eğitimleri", requiresInstitution: true },
  { key: "guzem-kamu-yarari-ucretsiz", label: "GUZEM KAMU YARARI (ÜCRETSİZ) EĞİTİMLER", requiresInstitution: false },
  { key: "yok-mikro-yeterlilik", label: "YÖK MİKRO YETERLİLİK EĞİTİMLERİ", requiresInstitution: false },
];

export const DEFAULT_SALES_FILTER = "egitim-isbirligi-sertifikasyon";

export const SALES_FILTER_KEYS = SALES_FILTERS.map((item) => item.key);

export const salesFilterByKey = Object.fromEntries(SALES_FILTERS.map((item) => [item.key, item]));

export const normalizeSalesFilter = (value) => {
  const key = String(value ?? "").trim().toLowerCase();
  return salesFilterByKey[key] ? key : "";
};

export const salesFilterLabel = (value) => salesFilterByKey[normalizeSalesFilter(value)]?.label || "";

export const salesFilterRequiresInstitution = (value) =>
  Boolean(salesFilterByKey[normalizeSalesFilter(value)]?.requiresInstitution);
