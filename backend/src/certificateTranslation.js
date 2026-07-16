const translationCache = new Map();

const EXAM_DIFFICULTY_TR = {
  easy: "TEMEL",
  medium: "ORTA",
  hard: "İLERİ",
};

const EXAM_DIFFICULTY_EN = {
  easy: "BASIC",
  medium: "INTERMEDIATE",
  hard: "ADVANCED",
};

export function buildBilingualLine(turkish, english) {
  const tr = String(turkish || "").trim() || "—";
  const en = String(english || "").trim();
  if (tr === "—") return "—";
  if (!en || en.toLowerCase() === tr.toLowerCase()) return tr;
  return `${tr} / ${en}`;
}

export function formatBilingualSeviye(examTargetDifficulty) {
  const key = String(examTargetDifficulty || "medium")
    .trim()
    .toLowerCase();
  const tr = EXAM_DIFFICULTY_TR[key] || EXAM_DIFFICULTY_TR.medium;
  const en = EXAM_DIFFICULTY_EN[key] || EXAM_DIFFICULTY_EN.medium;
  return buildBilingualLine(tr, en);
}

const normalizeCacheKey = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** TR → EN (MyMemory, önbellekli — yapay zeka / LLM kullanılmaz) */
export async function translateTrToEn(text) {
  const source = String(text || "").trim();
  if (!source || source === "—") return "";

  const cacheKey = normalizeCacheKey(source);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  if (process.env.CERTIFICATE_TRANSLATE === "0" || process.env.CERTIFICATE_TRANSLATE === "false") {
    translationCache.set(cacheKey, "");
    return "";
  }

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", source.slice(0, 500));
    url.searchParams.set("langpair", "tr|en");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      translationCache.set(cacheKey, "");
      return "";
    }

    const data = await response.json();
    const translated = String(data?.responseData?.translatedText || "").trim();
    const invalid =
      !translated ||
      translated.toUpperCase().includes("MYMEMORY WARNING") ||
      translated.toUpperCase().includes("QUERY LENGTH LIMIT");

    const result = invalid ? "" : translated;
    translationCache.set(cacheKey, result);
    return result;
  } catch {
    translationCache.set(cacheKey, "");
    return "";
  }
}

/**
 * Sertifika PROGRAMIN sütunu: "Türkçe / English"
 */
export async function buildCertificateBilingualFields({
  educationName,
  educationCategory,
  examTargetDifficulty,
}) {
  const [nameEn, categoryEn] = await Promise.all([
    translateTrToEn(educationName),
    translateTrToEn(educationCategory),
  ]);

  return {
    educationNameLine: buildBilingualLine(educationName, nameEn),
    educationCategoryLine: buildBilingualLine(educationCategory, categoryEn),
    levelLine: formatBilingualSeviye(examTargetDifficulty),
  };
}
