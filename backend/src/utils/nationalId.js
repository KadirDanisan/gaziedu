const isValidTurkishNationalId = (digits11) => {
  if (typeof digits11 !== "string" || digits11.length !== 11 || !/^\d{11}$/.test(digits11)) return false;
  const d = digits11.split("").map((c) => Number(c));
  if (d[0] === 0) return false;
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  let check10 = (oddSum * 7 - evenSum) % 10;
  if (check10 < 0) check10 += 10;
  if (check10 !== d[9]) return false;
  const sumFirst10 = d.slice(0, 10).reduce((a, n) => a + n, 0) % 10;
  if (sumFirst10 !== d[10]) return false;
  return true;
};

const NORMAL_USER_GENDER_LABELS = { "1": "Kadın", "2": "Erkek", "3": "Belirtmek İstemiyorum" };
const NORMAL_USER_TYPE_LABELS = { bireysel: "Bireysel", kurumsal: "Kurumsal" };
/** Ülke seçimi (Hesap Ayarları ile aynı kodlar) */
const NORMAL_USER_COUNTRY_LABELS = {
  "215": "Türkiye",
  "13": "Australia",
  "38": "Canada",
  "81": "Germany",
  "222": "United Kingdom",
  "223": "United States",
};

/** Sertifika PDF — Eğitim Dili alanı (ülke kodu 215 = Türkiye → Türkçe) */
const resolveCertificateEducationLanguage = (countryCodeRaw) => {
  const code = String(countryCodeRaw || "").trim();
  if (!code || code === "215" || code.toUpperCase() === "TR" || code === "Türkçe") {
    return "Türkçe";
  }
  if (NORMAL_USER_COUNTRY_LABELS[code] === "Türkiye") return "Türkçe";
  const englishCountries = new Set(["13", "38", "81", "222", "223"]);
  if (englishCountries.has(code)) return "English";
  return "Türkçe";
};

export {
  isValidTurkishNationalId,
  NORMAL_USER_GENDER_LABELS,
  NORMAL_USER_TYPE_LABELS,
  NORMAL_USER_COUNTRY_LABELS,
  resolveCertificateEducationLanguage,
};
