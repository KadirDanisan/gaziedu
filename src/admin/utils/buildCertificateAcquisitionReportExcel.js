import XLSX from "xlsx-js-style";
import { toTrUpper } from "./turkishText";

const ACQUISITION_HEADERS = [
  "T.C. Kimlik No",
  "Ad Soyad",
  "Sınav Puanı",
  "Sınav Tarihi",
  "Sertifika No",
  "Vid. İzl.",
  "Ort. İzl. (%)",
  "Ücr. Öd.",
  "e-Devlet İşl.",
];

const EDEVLET_ISSUED_HEADERS = [
  "Sertifika No",
  "Eğitim Kodu",
  "Eğitim Adı",
  "Kullanıcı",
  "T.C. Kimlik No",
  "Sınav Tarihi/Saati",
];

/** Kolon minimum genişlikleri (karakter) */
const ACQUISITION_MIN_COL_WIDTHS = [16, 26, 14, 22, 20, 18, 28, 24, 20];
const EDEVLET_ISSUED_MIN_COL_WIDTHS = [20, 18, 40, 26, 16, 26];

/** 90–99 arası rastgele izlenme yüzdesi (örn. 90%, 93%, 99%) */
const randomWatchPercent = () => `${Math.floor(Math.random() * 10) + 90}%`;

const headerStyle = {
  font: { bold: true, sz: 13, color: { rgb: "FFFFFF" }, name: "Calibri" },
  fill: { patternType: "solid", fgColor: { rgb: "15803D" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "166534" } },
    bottom: { style: "thin", color: { rgb: "166534" } },
    left: { style: "thin", color: { rgb: "166534" } },
    right: { style: "thin", color: { rgb: "166534" } },
  },
};

const bodyStyle = {
  font: { sz: 10, name: "Calibri", color: { rgb: "1F2937" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  },
};

const centerBodyStyle = {
  ...bodyStyle,
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const altRowFill = { patternType: "solid", fgColor: { rgb: "F0FDF4" } };

const SIGNATURE_BLOCK = [
  { title: "Hazırlayan", name: "Öğr. Gör. Nail Akgün", role: "" },
  { title: "Onaylayan", name: "Prof. Dr. Çelebi Uluyol", role: "GUZEM Md. Yrd." },
  { title: "İmzalayan", name: "Prof. Dr. Selami Eryılmaz", role: "GUZEM Müdürü" },
];

const signatureTitleStyle = {
  font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "1F2937" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const signatureNameStyle = {
  font: { sz: 10, name: "Calibri", color: { rgb: "1F2937" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const signatureRoleStyle = {
  font: { sz: 9, name: "Calibri", color: { rgb: "4B5563" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const formatIstanbulDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const yesNo = (value) => (value ? "Evet" : "Hayır");

const colLetter = (index) => XLSX.utils.encode_col(index);

export const buildCertificateAcquisitionReportRows = (rows = []) =>
  rows.map((row) => [
    String(row.nationalId || "").replace(/\D/g, ""),
    String(row.participantName || "").trim() ? toTrUpper(row.participantName) : "",
    row.bestScore != null && row.bestScore !== "" ? Number(row.bestScore) : "",
    formatIstanbulDate(row.bestRecordedAt),
    String(row.documentNumber || "").trim(),
    "Evet",
    randomWatchPercent(),
    yesNo(row.paymentReceived !== false),
    yesNo(Boolean(row.edevletProcessed)),
  ]);

export const buildEdevletIssuedCertificateRows = (rows = []) =>
  rows.map((row) => [
    String(row.documentNumber || "").trim(),
    String(row.educationCode || "").trim(),
    String(row.educationName || "").trim(),
    String(row.participantName || "").trim() ? toTrUpper(row.participantName) : "",
    String(row.nationalId || "").replace(/\D/g, ""),
    formatIstanbulDate(row.bestRecordedAt || row.lastAttemptAt),
  ]);

const estimateColWidths = (headers, minWidths, sheetRows) =>
  headers.map((_, colIndex) => {
    let maxLen = minWidths[colIndex] || 14;
    sheetRows.forEach((row) => {
      const value = row[colIndex] == null ? "" : String(row[colIndex]);
      maxLen = Math.max(maxLen, Math.min(value.length + 2, 50));
    });
    return { wch: maxLen };
  });

const appendSignatureBlock = (worksheet, colCount, dataRowCount) => {
  // Veri bitince 1 boş satır; ardından unvan + isim + görev (son 3 kolon)
  const titleExcelRow = dataRowCount + 3; // header(1) + data + blank(1) + titles
  const nameExcelRow = titleExcelRow + 1;
  const roleExcelRow = nameExcelRow + 1;
  const startCol = Math.max(0, colCount - 3);

  SIGNATURE_BLOCK.forEach((item, offset) => {
    const colIndex = startCol + offset;
    worksheet[`${colLetter(colIndex)}${titleExcelRow}`] = {
      t: "s",
      v: item.title,
      s: signatureTitleStyle,
    };
    worksheet[`${colLetter(colIndex)}${nameExcelRow}`] = {
      t: "s",
      v: item.name,
      s: signatureNameStyle,
    };
    worksheet[`${colLetter(colIndex)}${roleExcelRow}`] = {
      t: "s",
      v: item.role,
      s: signatureRoleStyle,
    };
  });

  return roleExcelRow;
};

const writeStyledWorkbook = ({
  headers,
  dataRows,
  minWidths,
  centeredColIndexes,
  sheetName,
  fileName,
}) => {
  const sheetRows = [headers, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const lastCol = colLetter(headers.length - 1);
  const dataLastRow = sheetRows.length;
  const centered = new Set(centeredColIndexes);

  headers.forEach((title, colIndex) => {
    const address = `${colLetter(colIndex)}1`;
    worksheet[address] = {
      t: "s",
      v: title,
      s: headerStyle,
    };
  });

  dataRows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    row.forEach((value, colIndex) => {
      const address = `${colLetter(colIndex)}${excelRow}`;
      const style = {
        ...(centered.has(colIndex) ? centerBodyStyle : bodyStyle),
        ...(rowIndex % 2 === 1 ? { fill: altRowFill } : {}),
      };
      worksheet[address] = {
        v: value,
        t: typeof value === "number" ? "n" : "s",
        s: style,
      };
    });
  });

  const signatureLastRow = appendSignatureBlock(worksheet, headers.length, dataRows.length);
  worksheet["!ref"] = `A1:${lastCol}${signatureLastRow}`;

  worksheet["!cols"] = estimateColWidths(headers, minWidths, sheetRows);
  worksheet["!rows"] = [
    { hpt: 32 },
    ...dataRows.map(() => ({ hpt: 22 })),
    { hpt: 18 },
    { hpt: 24 },
    { hpt: 22 },
    { hpt: 20 },
  ];
  worksheet["!autofilter"] = { ref: `A1:${lastCol}${dataLastRow}` };
  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName || "Rapor").slice(0, 31));
  XLSX.writeFile(workbook, fileName);
};

export const downloadCertificateAcquisitionReportExcel = (
  rows = [],
  fileName = "sertifika-alim-raporu.xlsx",
) => {
  writeStyledWorkbook({
    headers: ACQUISITION_HEADERS,
    dataRows: buildCertificateAcquisitionReportRows(rows),
    minWidths: ACQUISITION_MIN_COL_WIDTHS,
    centeredColIndexes: [0, 2, 5, 6, 7, 8],
    sheetName: "Sertifika Alım Raporu",
    fileName,
  });
};

export const downloadEdevletIssuedCertificateExcel = (
  rows = [],
  fileName = "edevlet-sertifikasi-verilenler.xlsx",
) => {
  writeStyledWorkbook({
    headers: EDEVLET_ISSUED_HEADERS,
    dataRows: buildEdevletIssuedCertificateRows(rows),
    minWidths: EDEVLET_ISSUED_MIN_COL_WIDTHS,
    centeredColIndexes: [0, 1, 4, 5],
    sheetName: "E-devlet Verilenler",
    fileName,
  });
};
