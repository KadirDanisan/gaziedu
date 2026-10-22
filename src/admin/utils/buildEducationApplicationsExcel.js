import XLSX from "xlsx-js-style";
import { formatPersonName } from "./turkishText";

const HEADERS = [
  "Başvuru Tarihi",
  "Eğitim Kodu",
  "Eğitim Adı",
  "Ad Soyad",
  "T.C. Kimlik No",
  "E-Posta",
  "Telefon",
  "Doğum Tarihi",
  "Ödenen Tutar (TL)",
  "İndirim (%)",
  "Ödeme Türü",
  "Ödeme Durumu",
  "Ödeme Tarihi",
  "Durum",
  "Onay Tarihi",
];

const MIN_COL_WIDTHS = [18, 14, 36, 24, 14, 28, 16, 12, 14, 10, 14, 14, 18, 12, 18];
const CENTERED_COLS = new Set([0, 1, 4, 7, 9, 10, 11, 12, 13, 14]);
const BULK_PAYMENT_METHOD = "toplu";

const border = (rgb) => ({
  top: { style: "thin", color: { rgb } },
  bottom: { style: "thin", color: { rgb } },
  left: { style: "thin", color: { rgb } },
  right: { style: "thin", color: { rgb } },
});

const headerStyle = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Calibri" },
  fill: { patternType: "solid", fgColor: { rgb: "0D47A1" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: border("0B3C88"),
};

const bodyStyle = {
  font: { sz: 10, name: "Calibri", color: { rgb: "1F2937" } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: border("D1D5DB"),
};

const altRowFill = { patternType: "solid", fgColor: { rgb: "F3F7FF" } };

const formatIstanbul = (value, withTime = true) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const paymentStatusLabel = (row) => {
  if (row.paymentMethod === BULK_PAYMENT_METHOD) return "Toplu";
  if (row.paymentStatus === "paid") return "Ödendi";
  if (row.paymentStatus === "unpaid") return "Ödenmedi";
  return "";
};

const toNumberOrEmpty = (value) => {
  if (value == null || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
};

export const buildEducationApplicationRows = (rows = []) =>
  rows.map((row) => [
    formatIstanbul(row.createdAt),
    String(row.educationCode || "").trim(),
    String(row.educationName || "").trim(),
    formatPersonName(`${row.firstName || ""} ${row.lastName || ""}`.trim(), ""),
    String(row.nationalId || "").replace(/\D/g, ""),
    String(row.email || "").trim(),
    String(row.phone || "").trim(),
    row.birthDate ? String(row.birthDate).slice(0, 10) : "",
    toNumberOrEmpty(row.payableAmount ?? row.price),
    row.hasDiscount ? toNumberOrEmpty(row.discountRate) : "",
    row.paymentMethod === BULK_PAYMENT_METHOD ? "Toplu başvuru" : "Tek Çekim",
    paymentStatusLabel(row),
    formatIstanbul(row.paidAt),
    row.status === "approved" ? "Onaylandı" : "Beklemede",
    formatIstanbul(row.approvedAt),
  ]);

export const downloadEducationApplicationsExcel = (rows = [], fileName = "egitim-basvurulari.xlsx") => {
  const dataRows = buildEducationApplicationRows(rows);
  const sheetRows = [HEADERS, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const lastCol = XLSX.utils.encode_col(HEADERS.length - 1);

  HEADERS.forEach((title, colIndex) => {
    worksheet[`${XLSX.utils.encode_col(colIndex)}1`] = { t: "s", v: title, s: headerStyle };
  });

  dataRows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      worksheet[`${XLSX.utils.encode_col(colIndex)}${rowIndex + 2}`] = {
        v: value,
        t: typeof value === "number" ? "n" : "s",
        ...(colIndex === 8 && typeof value === "number" ? { z: "#,##0.00" } : {}),
        s: {
          ...bodyStyle,
          ...(CENTERED_COLS.has(colIndex) ? { alignment: { ...bodyStyle.alignment, horizontal: "center" } } : {}),
          ...(rowIndex % 2 === 1 ? { fill: altRowFill } : {}),
        },
      };
    });
  });

  worksheet["!ref"] = `A1:${lastCol}${sheetRows.length}`;
  worksheet["!cols"] = HEADERS.map((_, colIndex) => {
    const minLen = MIN_COL_WIDTHS[colIndex] || 10;
    const longest = dataRows.reduce((max, row) => Math.max(max, String(row[colIndex] ?? "").length + 1), minLen);
    return { wch: Math.min(longest, 50) };
  });
  worksheet["!rows"] = [{ hpt: 30 }];
  worksheet["!autofilter"] = { ref: `A1:${lastCol}${sheetRows.length}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Eğitim Başvuruları");
  XLSX.writeFile(workbook, fileName);
};
