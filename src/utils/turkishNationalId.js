/** Sadece rakamlar */
export function normalizeTurkishNationalId(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** T.C. kimlik numarası 11 hane + resmi kontrol basamakları */
export function isValidTurkishNationalId(value) {
  const digits = normalizeTurkishNationalId(value);
  if (digits.length !== 11) return false;
  if (!/^\d{11}$/.test(digits)) return false;
  const d = digits.split("").map(Number);
  if (d[0] === 0) return false;

  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  let check10 = (oddSum * 7 - evenSum) % 10;
  if (check10 < 0) check10 += 10;
  if (check10 !== d[9]) return false;

  const sumFirst10 = d.slice(0, 10).reduce((a, n) => a + n, 0) % 10;
  if (sumFirst10 !== d[10]) return false;

  return true;
}
