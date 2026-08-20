/** Multer / eski kayıtlarda UTF-8 dosya adları latin1 gibi görünür (ör. ModÃ¼l_1.pdf). */
const fixUploadedFileName = (name) => {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  if (!/[ÃÄÅâ€]/.test(raw)) return raw;
  try {
    const fixed = Buffer.from(raw, "latin1").toString("utf8");
    if (fixed && !fixed.includes("\uFFFD")) return fixed;
  } catch {
    /* ignore */
  }
  return raw;
};

export { fixUploadedFileName };
