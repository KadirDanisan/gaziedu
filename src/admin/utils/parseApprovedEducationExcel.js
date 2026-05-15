import * as XLSX from "xlsx";
import { codesMatch, parseEducationCode } from "./educationCode";

/** Başlık hücresini karşılaştırma için sadeleştirir (Türkçe karakter → ASCII benzeri). */
export function normalizeExcelHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/\r|\n/g, "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "C")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function findColumnIndex(headers, matcher) {
  for (let i = 0; i < headers.length; i += 1) {
    const n = normalizeExcelHeader(headers[i]);
    if (matcher(n, i)) return i;
  }
  return -1;
}

/**
 * Excel ilk sayfasını okur.
 * Zorunlu: KOD (GZM-1-32-03), EĞİTİM ADI
 * İsteğe bağlı: SIRA, KURUM KODU, EĞİTİM KATEGORİ KODU (KOD ile uyumlu olmalı)
 * @returns {{ rows: Array<{ sheetRow: number, sortKey: number, institutionCode: string, categoryCode: string, code: string, name: string }>, error: string|null }}
 */
export function parseApprovedEducationExcelBuffer(arrayBuffer) {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], error: "Excel dosyasında sayfa bulunamadı." };
    }
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    if (!matrix.length) {
      return { rows: [], error: "Excel sayfası boş." };
    }

    const headerRow = matrix[0].map((cell) => String(cell ?? ""));
    const idxSira = findColumnIndex(headerRow, (n) => n === "SIRA");
    const idxKurumKodu = findColumnIndex(headerRow, (n) => n === "KURUM KODU");
    const idxKod = findColumnIndex(headerRow, (n) => n === "KOD");
    const idxKategoriKodu = findColumnIndex(
      headerRow,
      (n) => (n.includes("KATEGOR") || n.includes("KATEGORI")) && n.includes("KOD") && n !== "KURUM KODU",
    );
    const idxEgitimAdi = findColumnIndex(
      headerRow,
      (n) => n === "EGITIM ADI" || n === "EĞİTİM ADI" || (n.includes("EGITIM") && n.endsWith(" ADI")),
    );

    const missing = [];
    if (idxKod < 0) missing.push("KOD");
    if (idxEgitimAdi < 0) missing.push("EĞİTİM ADI");
    if (missing.length) {
      return {
        rows: [],
        error: `Zorunlu sütun başlıkları bulunamadı: ${missing.join(", ")}. İlk satırda KOD (ör. GZM-1-32-03) ve EĞİTİM ADI olmalıdır.`,
      };
    }

    const rows = [];
    for (let r = 1; r < matrix.length; r += 1) {
      const line = matrix[r];
      if (!Array.isArray(line) || !line.length) continue;
      const codeRaw = String(line[idxKod] ?? "").trim();
      const name = String(line[idxEgitimAdi] ?? "").trim();
      const institutionFromSheet = idxKurumKodu >= 0 ? String(line[idxKurumKodu] ?? "").trim() : "";
      const categoryFromSheet = idxKategoriKodu >= 0 ? String(line[idxKategoriKodu] ?? "").trim() : "";
      const siraRaw = idxSira >= 0 ? String(line[idxSira] ?? "").trim() : "";
      const sortKey = siraRaw ? Number.parseInt(siraRaw, 10) : r;
      const sortKeySafe = Number.isFinite(sortKey) ? sortKey : r;

      if (!codeRaw && !name && !institutionFromSheet && !categoryFromSheet) continue;

      const parsed = parseEducationCode(codeRaw);
      if (!parsed.ok) {
        return {
          rows: [],
          error: `Satır ${r + 1}: ${parsed.error} Bulunan kod: "${codeRaw || "(boş)"}".`,
        };
      }

      if (institutionFromSheet && !codesMatch(institutionFromSheet, parsed.institutionCode)) {
        return {
          rows: [],
          error: `Satır ${r + 1}: KOD içindeki kurum (${parsed.institutionCode}) ile KURUM KODU sütunu (${institutionFromSheet}) uyuşmuyor.`,
        };
      }

      if (categoryFromSheet && !codesMatch(categoryFromSheet, parsed.categoryCode)) {
        return {
          rows: [],
          error: `Satır ${r + 1}: KOD içindeki kategori (${parsed.categoryCode}) ile kategori kodu sütunu (${categoryFromSheet}) uyuşmuyor.`,
        };
      }

      if (!name) {
        return {
          rows: [],
          error: `Satır ${r + 1}: EĞİTİM ADI boş olamaz.`,
        };
      }

      rows.push({
        sheetRow: r + 1,
        sortKey: sortKeySafe,
        institutionCode: institutionFromSheet || parsed.institutionCode,
        categoryCode: categoryFromSheet || parsed.categoryCode,
        code: parsed.code,
        name,
      });
    }

    rows.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.sheetRow - b.sheetRow;
    });

    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: e?.message || "Excel okunamadı." };
  }
}

export function normalizeLookupCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** Kurum / kategori listesinde kod eşleşmesi (sayısal kodlarda baş sıfır toleransı). */
export function lookupCodeMatches(storedCode, targetCode) {
  return codesMatch(storedCode, targetCode);
}
