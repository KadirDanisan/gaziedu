/** GZM-1-32-03 → önek, kurum kodu, kategori kodu, eğitim sıra no */
export const EDUCATION_CODE_PATTERN = /^[A-Z]{3}-\d+-\d+-\d+$/;

export function normalizeEducationCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * @returns {{ ok: true, code: string, prefix: string, institutionCode: string, categoryCode: string, educationSeq: string } | { ok: false, code: string, error: string }}
 */
export function parseEducationCode(value) {
  const code = normalizeEducationCode(value);
  const match = code.match(/^([A-Z]{3})-(\d+)-(\d+)-(\d+)$/);
  if (!match) {
    return {
      ok: false,
      code,
      error: "Eğitim kodu GZM-1-32-03 formatında olmalıdır (Önek-Kurum-Kategori-Sıra).",
    };
  }
  const [, prefix, institutionCode, categoryCode, educationSeq] = match;
  return { ok: true, code, prefix, institutionCode, categoryCode, educationSeq };
}

/** Kurum / kategori kodlarını karşılaştırır (1 ile 01 gibi sayısal eşleşme). */
export function codesMatch(a, b) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  if (!left || !right) return false;
  const na = left.replace(/\s+/g, "").toUpperCase();
  const nb = right.replace(/\s+/g, "").toUpperCase();
  if (na === nb) return true;
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) {
    return Number.parseInt(na, 10) === Number.parseInt(nb, 10);
  }
  return false;
}
