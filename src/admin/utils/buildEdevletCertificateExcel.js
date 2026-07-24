import * as XLSX from "xlsx";

const NULL_CELL = "NULL";

const cell = (value) => {
  const safe = value == null ? "" : String(value).trim();
  return safe === "" ? NULL_CELL : safe;
};

const toTrUpper = (value) => String(value || "").trim().toLocaleUpperCase("tr-TR");

const splitParticipantName = (fullName) => {
  const safe = String(fullName || "").trim();
  if (!safe) return { firstName: "", lastName: "" };
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const getIstanbulDateParts = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: parts.find((part) => part.type === "year")?.value || "",
    month: parts.find((part) => part.type === "month")?.value || "",
    day: parts.find((part) => part.type === "day")?.value || "",
  };
};

const formatEdevletDate = (value) => {
  const parts = getIstanbulDateParts(value);
  if (!parts?.year || !parts?.month || !parts?.day) return "";
  return `${parts.year}-${parts.month}-${parts.day} 00:00:00.000`;
};

/** Excel indirme tarihinden: GZM-26 ve 24-07 */
const buildExportDateCodes = (exportDate = new Date()) => {
  const parts = getIstanbulDateParts(exportDate);
  if (!parts?.year || !parts?.month || !parts?.day) {
    return { gzmYearCode: "", dayMonthCode: "" };
  }
  return {
    gzmYearCode: `GZM-${parts.year.slice(-2)}`,
    dayMonthCode: `${parts.day}-${parts.month}`,
  };
};

const buildBarcodePayload = (documentNumber, nationalId) => {
  const barkod = String(documentNumber || "").trim();
  const tckn = String(nationalId || "").replace(/\D/g, "");
  if (!barkod || !tckn) return "";
  return `barkodlubelgedogrulama://barkod: ${barkod};tckn:${tckn}`;
};

/** UN_041243C00006 → 00006 */
const extractDocumentSerialAfterC = (documentNumber) => {
  const match = String(documentNumber || "").trim().match(/C(\d+)\s*$/i);
  return match?.[1] || "";
};

/** GZM-1-27-02 + 00006 → GZM-1-27-02-00006 */
const buildEducationSerialCode = (educationCode, documentNumber) => {
  const code = String(educationCode || "").trim();
  const serial = extractDocumentSerialAfterC(documentNumber);
  if (!code || !serial) return "";
  return `${code}-${serial}`;
};

export const buildEdevletCertificateRows = (rows = [], exportDate = new Date()) => {
  const { gzmYearCode, dayMonthCode } = buildExportDateCodes(exportDate);

  return rows.map((row) => {
    const educationCode = String(row.educationCode || "").trim();
    const { firstName, lastName } = splitParticipantName(row.participantName);
    const documentNumber = String(row.documentNumber || "").trim();
    const nationalId = String(row.nationalId || "").replace(/\D/g, "");
    const excelRowId = row.edevletExcelRowId != null ? String(row.edevletExcelRowId) : "";
    const excelUuid = String(row.edevletExcelUuid || "").trim().toUpperCase();
    const educationSerialCode = buildEducationSerialCode(educationCode, documentNumber);
    // T: GZM-26/24-07/32344884916
    const filePath =
      gzmYearCode && dayMonthCode && nationalId ? `${gzmYearCode}/${dayMonthCode}/${nationalId}` : "";

    return [
      cell(excelRowId), // A
      "C", // B
      cell(excelUuid), // C
      NULL_CELL, // D
      cell(row.educationName), // E
      cell(educationCode), // F — eğitim kodu
      NULL_CELL, // G
      NULL_CELL, // H
      cell(toTrUpper(firstName)), // I
      cell(toTrUpper(lastName)), // J
      NULL_CELL, // K
      cell(nationalId), // L
      cell(formatEdevletDate(row.bestRecordedAt)), // M
      cell(educationSerialCode), // N — GZM-1-27-02-00006
      NULL_CELL, // O
      NULL_CELL, // P
      cell(documentNumber), // Q
      cell(buildBarcodePayload(documentNumber, nationalId)), // R
      cell(dayMonthCode), // S — 24-07
      cell(filePath), // T — GZM-26/24-07/TC
      NULL_CELL, // U
      "True", // V
    ];
  });
};

export const downloadEdevletCertificateExcel = (rows = [], fileName = "edevlet-sertifika.xlsx") => {
  const exportDate = new Date();
  const sheetRows = buildEdevletCertificateRows(rows, exportDate);
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, fileName);
};
