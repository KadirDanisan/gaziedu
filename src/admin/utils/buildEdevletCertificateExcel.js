import * as XLSX from "xlsx";

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

/** Excel indirme tarihinden: GZM-26 (yıl) ve GZMS-22-07 (gün-ay) */
const buildExportDateCodes = (exportDate = new Date()) => {
  const parts = getIstanbulDateParts(exportDate);
  if (!parts?.year || !parts?.month || !parts?.day) {
    return { gzmYearCode: "", gzmsDayMonthCode: "" };
  }
  return {
    gzmYearCode: `GZM-${parts.year.slice(-2)}`,
    gzmsDayMonthCode: `GZMS-${parts.day}-${parts.month}`,
  };
};

const buildBarcodePayload = (documentNumber, nationalId) => {
  const barkod = String(documentNumber || "").trim();
  const tckn = String(nationalId || "").replace(/\D/g, "");
  if (!barkod || !tckn) return "";
  return `barkodlubelgedogrulama://barkod: ${barkod};tckn:${tckn}`;
};

const NULL_CELL = "NULL";

const cell = (value) => {
  const safe = value == null ? "" : String(value).trim();
  return safe === "" ? NULL_CELL : safe;
};

export const buildEdevletCertificateRows = (rows = [], exportDate = new Date()) => {
  const { gzmYearCode, gzmsDayMonthCode } = buildExportDateCodes(exportDate);

  return rows.map((row, index) => {
    const educationCode = String(row.educationCode || "").trim();
    const { firstName, lastName } = splitParticipantName(row.participantName);
    const documentNumber = String(row.documentNumber || "").trim();
    const nationalId = String(row.nationalId || "").replace(/\D/g, "");
    const sequence = index + 1;
    // örn: GZM-26/GZMS-22-07/GZMS-22-07_1
    const filePath =
      gzmYearCode && gzmsDayMonthCode
        ? `${gzmYearCode}/${gzmsDayMonthCode}/${gzmsDayMonthCode}_${sequence}`
        : "";

    return [
      NULL_CELL,
      "C",
      NULL_CELL,
      NULL_CELL,
      cell(row.educationName),
      cell(gzmYearCode),
      NULL_CELL,
      NULL_CELL,
      cell(firstName),
      cell(lastName),
      NULL_CELL,
      cell(nationalId),
      cell(formatEdevletDate(row.bestRecordedAt)),
      NULL_CELL,
      cell(educationCode),
      NULL_CELL,
      cell(documentNumber),
      cell(buildBarcodePayload(documentNumber, nationalId)),
      cell(gzmsDayMonthCode),
      cell(filePath),
      NULL_CELL,
      "True",
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
