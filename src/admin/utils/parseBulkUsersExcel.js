import * as XLSX from "xlsx";
import { normalizeExcelHeader } from "./parseApprovedEducationExcel";

const compactHeader = (value) => normalizeExcelHeader(value).replace(/[^A-Z0-9]/g, "");

const cellToText = (value) => {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value).trim();
  return String(value).trim();
};

/**
 * Sabit sütunlu şablonu okur: ilk satır `expectedHeaders` ile birebir (sırasıyla) eşleşmelidir.
 * @returns {{ lines: Array<{ sheetRow: number, cells: string[] }>, error: string|null }}
 */
function parseTemplateExcelBuffer(arrayBuffer, expectedHeaders) {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { lines: [], error: "Excel dosyasında sayfa bulunamadı." };
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    const headers = (matrix[0] || []).slice(0, expectedHeaders.length).map(compactHeader);
    const headersOk = expectedHeaders.every((h, i) => headers[i] === compactHeader(h));
    if (!headersOk) {
      const list = expectedHeaders.map((h) => `“${h}”`).join(", ");
      return {
        lines: [],
        error: `Excel şablona uygun değil. İlk satır sırasıyla ${list} başlıklarını içermelidir. Lütfen şablonu indirip onu doldurun.`,
      };
    }

    const lines = [];
    for (let i = 1; i < matrix.length; i += 1) {
      const cells = expectedHeaders.map((_, col) => cellToText((matrix[i] || [])[col]));
      if (cells.every((c) => !c)) continue;
      lines.push({ sheetRow: i + 1, cells });
    }
    return { lines, error: null };
  } catch {
    return { lines: [], error: "Excel dosyası okunamadı. Dosyanın .xlsx formatında olduğundan emin olun." };
  }
}

/** TopluKullaniciEkleme.xlsx: A = T.C. Kimlik No, B = Ad Soyad, C = E-Posta */
export function parseBulkUsersExcelBuffer(arrayBuffer) {
  const { lines, error } = parseTemplateExcelBuffer(arrayBuffer, ["T.C. Kimlik No", "Ad Soyad", "E-Posta"]);
  return {
    error,
    rows: lines.map(({ sheetRow, cells: [tc, fullName, email] }) => ({
      sheetRow,
      nationalId: tc.replace(/\D/g, ""),
      fullName: fullName.replace(/\s+/g, " "),
      email: email.toLowerCase(),
    })),
  };
}

/** TopluBasvuruFormu.xlsx: A = T.C. Kimlik No, B = E-Posta */
export function parseBulkApplicationsExcelBuffer(arrayBuffer) {
  const { lines, error } = parseTemplateExcelBuffer(arrayBuffer, ["T.C. Kimlik No", "E-Posta"]);
  return {
    error,
    rows: lines.map(({ sheetRow, cells: [tc, email] }) => ({
      sheetRow,
      nationalId: tc.replace(/\D/g, ""),
      email: email.toLowerCase(),
    })),
  };
}
