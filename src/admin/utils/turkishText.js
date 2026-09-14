/** Türkçe locale ile büyük harf (İ/i, I/ı doğru). */
export const toTrUpper = (value) => {
  const safe = String(value ?? "").trim();
  if (!safe) return "";
  return safe.toLocaleUpperCase("tr-TR");
};

/** Boş veya tire ise olduğu gibi; dolu isimleri büyük harfe çevirir. */
export const formatPersonName = (value, empty = "—") => {
  const safe = String(value ?? "").trim();
  if (!safe) return empty;
  return toTrUpper(safe);
};
