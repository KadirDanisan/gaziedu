import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../assets/certificates/GUZEM_KS_01_1.pdf");

/** Landscape A4 şablon — koordinatlar (pt, sol-alt köşe 0,0) */
const FIELD_POSITIONS = {
  nationalId: { x: 118, y: 418, size: 11 },
  fullName: { x: 118, y: 378, size: 11 },
  birthInfo: { x: 118, y: 338, size: 10 },
  educationCode: { x: 318, y: 418, size: 10 },
  educationName: { x: 318, y: 378, size: 10, maxWidth: 220 },
  level: { x: 318, y: 338, size: 10 },
  documentNumber: { x: 618, y: 418, size: 10 },
  issuePlace: { x: 618, y: 378, size: 10 },
  controlDate: { x: 618, y: 338, size: 10 },
};

const resolveFontPath = () => {
  const candidates = [
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/arial.ttf"),
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/Arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const formatIstanbulDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul" }).format(new Date());
  }
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const drawWrappedText = (page, font, text, x, y, { size, maxWidth, color }) => {
  const safe = String(text || "").trim() || "-";
  if (!maxWidth) {
    page.drawText(safe, { x, y, size, font, color });
    return;
  }
  const words = safe.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      line = word;
      cursorY -= size + 3;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
  }
};

/**
 * @param {{
 *   nationalId: string,
 *   fullName: string,
 *   birthInfo?: string,
 *   educationCode: string,
 *   educationName: string,
 *   bestScore?: number|string,
 *   bestRecordedAt?: string|Date,
 *   issuePlace?: string,
 * }} data
 */
export async function buildCertificatePdf(data) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("Sertifika şablonu bulunamadı (GUZEM_KS_01_1.pdf).");
  }

  const fontPath = resolveFontPath();
  if (!fontPath) {
    throw new Error("Sertifika için sistem fontu bulunamadı (Arial / DejaVu).");
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fs.readFileSync(fontPath));
  const page = pdfDoc.getPages()[0];
  const color = rgb(0.1, 0.12, 0.2);

  const fullName = String(data.fullName || "").trim() || "—";
  const nationalId = String(data.nationalId || "").trim();
  const educationCode = String(data.educationCode || "").trim();
  const educationName = String(data.educationName || "").trim() || "—";
  const birthInfo = String(data.birthInfo || "").trim() || "—";
  const issuePlace = String(data.issuePlace || "Ankara").trim();
  const controlDate = formatIstanbulDate(data.bestRecordedAt);
  const levelText = data.bestScore != null && data.bestScore !== "" ? `Başarı: %${Number(data.bestScore)}` : "—";
  const documentNumber = educationCode || "—";

  const entries = [
    ["nationalId", nationalId],
    ["fullName", fullName],
    ["birthInfo", birthInfo],
    ["educationCode", educationCode],
    ["educationName", educationName],
    ["level", levelText],
    ["documentNumber", documentNumber],
    ["issuePlace", issuePlace],
    ["controlDate", controlDate],
  ];

  for (const [key, value] of entries) {
    const pos = FIELD_POSITIONS[key];
    drawWrappedText(page, font, value, pos.x, pos.y, {
      size: pos.size,
      maxWidth: pos.maxWidth,
      color,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const safeCode = educationCode.replace(/[^A-Za-z0-9-]+/g, "_") || "sertifika";
  const safeTc = nationalId.replace(/\D/g, "") || "kursiyer";
  const fileName = `sertifika_${safeCode}_${safeTc}.pdf`;

  return { pdfBytes, fileName };
}
