import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../assets/certificates/GUZEM_KS_01_1.pdf");
const SIGNATURE_PATH = path.resolve(__dirname, "../assets/certificates/selami_eryilmaz_imza.png");
const GREAT_VIBES_FONT_PATH = path.resolve(__dirname, "../assets/fonts/GreatVibes-Regular.ttf");

/** Site ana mavisi */
const BRAND_BLUE = rgb(14 / 255, 56 / 255, 119 / 255);

/** Landscape A4 şablon — koordinatlar (pt, sol-alt köşe 0,0) */
const LAYOUT = {
  displayName: { y: 380, size: 50 },
  table: {
    left: { x: 160, size: 9.5 },
    middle: { x: 365, size: 9.5, maxWidth: 228 },
    right: { x: 660, size: 9.5 },
    rows: { row1: 300, row2: 260, row3: 220 },
  },
  legalParagraph: {
    y: 160,
    size: 7.4,
    lineHeight: 10.5,
    gap: 36,
    left: { x: 90},
  },
  qr: { size: 60, y: 41.5, xOffset: -298},
  directorSignature: {
    x: 635,
    yOffset: -30,
    nameSize: 10,
    titleSize: 10,
    lineHeight: 11,
    signatureGap: 3,
  },
};

const resolveFontPath = () => {
  const win = process.env.WINDIR || "C:\\Windows";
  const candidates = [
    path.resolve(win, "Fonts/arial.ttf"),
    path.resolve(win, "Fonts/Arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const resolveBoldFontPath = () => {
  const win = process.env.WINDIR || "C:\\Windows";
  const candidates = [
    path.resolve(win, "Fonts/arialbd.ttf"),
    path.resolve(win, "Fonts/Arialbd.ttf"),
    path.resolve(win, "Fonts/ARIALBD.TTF"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

/** Üstte büyük isim — Great Vibes (bundled), yoksa sistem italik yedek. */
const resolveDisplayNameFontPath = () => {
  if (fs.existsSync(GREAT_VIBES_FONT_PATH)) return GREAT_VIBES_FONT_PATH;

  const win = process.env.WINDIR || "C:\\Windows";
  const candidates = [
    path.resolve(win, "Fonts/GreatVibes-Regular.ttf"),
    path.resolve(win, "Fonts/GREATVIBES.TTF"),
    path.resolve(win, "Fonts/timesi.ttf"),
    path.resolve(win, "Fonts/georgiai.ttf"),
    "/usr/share/fonts/truetype/google-great-vibes/GreatVibes-Regular.ttf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const formatIsoDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date);
};

const parseDurationHours = (duration) => {
  const match = String(duration || "").match(/(\d+)/);
  return match ? Number(match[1]) : 80;
};

const subtractDaysIso = (isoDate, days) => {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date);
};

export function buildCertificateNumber(seed) {
  const digest = crypto.createHash("sha256").update(String(seed || "")).digest("hex").slice(0, 10).toUpperCase();
  return `SRT${digest}`;
}

const DEFAULT_ISSUE_PLACE = "GUZEM (Gazi Üniversitesi\nUzaktan Eğitim Merkezi)";

const normalizeMultilineText = (text) =>
  String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .trim() || "—";

const drawText = (page, font, text, x, y, { size, color }) => {
  page.drawText(String(text || "").trim() || "—", { x, y, size, font, color });
};

const drawMultilineText = (page, font, text, x, y, { size, lineHeight, color }) => {
  const lines = normalizeMultilineText(text).split("\n");
  const step = lineHeight || size + 2.5;
  let cursorY = y;
  for (const line of lines) {
    drawText(page, font, line.trim() || "—", x, cursorY, { size, color });
    cursorY -= step;
  }
  return cursorY;
};

const drawCenteredText = (page, font, text, y, { size, color }) => {
  const safe = String(text || "").trim() || "—";
  const pageWidth = page.getWidth();
  const textWidth = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: (pageWidth - textWidth) / 2, y, size, font, color });
};

const MIDDLE_COLUMN_CHAR_WRAP = 37;

const splitTextByCharLimit = (text, limit = MIDDLE_COLUMN_CHAR_WRAP) => {
  const safe = String(text || "").trim() || "—";
  if (safe.length <= limit) return [safe];

  const lines = [];
  let remaining = safe;
  while (remaining.length > limit) {
    let breakAt = remaining.lastIndexOf(" ", limit);
    if (breakAt <= 0) breakAt = limit;
    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines.length ? lines : ["—"];
};

const drawCharLimitWrappedText = (page, font, text, x, y, { size, charLimit, lineHeight, color }) => {
  const lines = splitTextByCharLimit(text, charLimit || MIDDLE_COLUMN_CHAR_WRAP);
  const step = lineHeight || size + 2.5;
  let cursorY = y;
  for (const line of lines) {
    drawText(page, font, line, x, cursorY, { size, color });
    cursorY -= step;
  }
  return cursorY;
};

const drawWrappedText = (page, font, text, x, y, { size, maxWidth, lineHeight, color }) => {
  const safe = String(text || "").trim() || "—";
  if (!maxWidth) {
    drawText(page, font, safe, x, y, { size, color });
    return y;
  }

  const words = safe.split(/\s+/);
  let line = "";
  let cursorY = y;
  const step = lineHeight || size + 3;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      drawText(page, font, line, x, cursorY, { size, color });
      line = word;
      cursorY -= step;
    } else {
      line = candidate;
    }
  }
  if (line) {
    drawText(page, font, line, x, cursorY, { size, color });
  }
  return cursorY;
};

const buildLegalParagraphs = ({ programStartDate, programEndDate, programHours }) => ({
  left: `Yukarıda bilgileri verilen kursiyer; Gazi Üniversitesi Uzaktan Eğitim Uygulama ve Araştırma Merkezi tarafından ${programStartDate} ile ${programEndDate} tarihleri arasında verilen mesleki eğitim ve sertifika programını almaya hak kazanmıştır.`,
  right: `The trainee whose information is given above has earned the right to receive the vocational training and certificate program provided by Gazi University Distance Education Center between ${programStartDate} and ${programEndDate}.`,
});

const drawLegalParagraphRow = (page, font, paragraphs, layout, color) => {
  const pageWidth = page.getWidth();
  const { y, size, lineHeight, gap, left } = layout;
  const columnWidth = (pageWidth - left.x * 2 - gap) / 2;
  const rightX = left.x + columnWidth + gap;

  drawWrappedText(page, font, paragraphs.left, left.x, y, {
    size,
    maxWidth: columnWidth,
    lineHeight,
    color,
  });
  drawWrappedText(page, font, paragraphs.right, rightX, y, {
    size,
    maxWidth: columnWidth,
    lineHeight,
    color,
  });
};

const buildQrPayload = ({ qrContent, documentNumber, nationalId, educationCode }) => {
  const custom = String(qrContent || "").trim();
  if (custom) return custom;

  // Geçici doğrulama içeriği — e-Devlet QR bağlantısı gelince qrContent ile değiştirilecek.
  return `GUZEM|${documentNumber}|${nationalId}|${educationCode}`;
};

const drawCenteredQr = async (pdfDoc, page, payload, { size, y, xOffset = 0 }) => {
  const qrPng = await QRCode.toBuffer(payload, {
    type: "png",
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#141820", light: "#FFFFFF" },
  });

  const qrImage = await pdfDoc.embedPng(qrPng);
  const pageWidth = page.getWidth();
  const x = (pageWidth - size) / 2 + xOffset;

  page.drawImage(qrImage, { x, y, width: size, height: size });
};

const loadSignaturePng = async () => {
  if (!fs.existsSync(SIGNATURE_PATH)) {
    return null;
  }

  const { data, info } = await sharp(SIGNATURE_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const isDarkBackground = data[i] < 45 && data[i + 1] < 45 && data[i + 2] < 45;
    if (isDarkBackground) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
};

const drawDirectorSignature = async (pdfDoc, page, boldFont, qrLayout, signatureLayout, color) => {
  const name = "Prof. Dr. Selami ERYILMAZ";
  const title = "GUZEM Müdürü";
  const { x, yOffset = 0, nameSize, titleSize, lineHeight, signatureGap } = signatureLayout;
  const qrCenterY = qrLayout.y + qrLayout.size / 2;
  const nameY = qrCenterY + lineHeight / 2 + yOffset;
  const titleY = nameY - lineHeight;
  const nameWidth = boldFont.widthOfTextAtSize(name, nameSize);
  const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
  const titleX = x + (nameWidth - titleWidth) / 2;

  const signaturePng = await loadSignaturePng();
  if (signaturePng) {
    const signatureImage = await pdfDoc.embedPng(signaturePng);
    const imageWidth = nameWidth;
    const imageHeight = (signatureImage.height / signatureImage.width) * imageWidth;
    const imageX = x;
    const imageY = nameY + nameSize * 0.75 + signatureGap;

    page.drawImage(signatureImage, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    });
  }

  drawText(page, boldFont, name, x, nameY, { size: nameSize, color });
  drawText(page, boldFont, title, titleX, titleY, { size: titleSize, color });
};

/**
 * @param {{
 *   id?: string,
 *   nationalId: string,
 *   fullName: string,
 *   birthInfo?: string,
 *   educationCode?: string,
 *   educationName: string,
 *   educationCategory?: string,
 *   educationField?: string,
 *   level?: string,
 *   documentNumber?: string,
 *   issuePlace?: string,
 *   controlDate?: string|Date,
 *   programStartDate?: string|Date,
 *   programEndDate?: string|Date,
 *   programHours?: number|string,
 *   duration?: string,
 *   qrContent?: string,
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
  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(templateBytes);
  } catch (err) {
    throw new Error(
      `Sertifika şablonu okunamadı (GUZEM_KS_01_1.pdf bozuk veya geçersiz): ${err?.message || err}`,
    );
  }
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fs.readFileSync(fontPath));

  const displayFontPath = resolveDisplayNameFontPath();
  const displayFont = displayFontPath ? await pdfDoc.embedFont(fs.readFileSync(displayFontPath)) : font;

  const boldFontPath = resolveBoldFontPath();
  const boldFont = boldFontPath ? await pdfDoc.embedFont(fs.readFileSync(boldFontPath)) : font;

  const page = pdfDoc.getPages()[0];
  const color = rgb(0.08, 0.1, 0.16);
  const { table, displayName, legalParagraph, qr, directorSignature } = LAYOUT;

  const fullName = String(data.fullName || "").trim() || "—";
  const nationalId = String(data.nationalId || "").trim() || "—";
  const educationName = String(data.educationName || "").trim() || "—";
  const educationCategory =
    String(data.educationCategory || data.educationField || "").trim() || "—";
  const level = String(data.level || "Orta").trim();
  const issuePlace = normalizeMultilineText(data.issuePlace || DEFAULT_ISSUE_PLACE);
  const birthInfo = String(data.birthInfo || "Türkçe").trim();

  const programEndDate = formatIsoDate(data.programEndDate || data.controlDate || new Date());
  const programHours = Number(data.programHours) || parseDurationHours(data.duration);
  const defaultStartDays = Math.max(14, Math.ceil(programHours / 2));
  const programStartDate = formatIsoDate(
    data.programStartDate || subtractDaysIso(programEndDate, defaultStartDays),
  );
  const controlDate = formatIsoDate(data.controlDate || programEndDate);

  const educationCode = String(data.educationCode || "").trim();
  const documentNumber =
    String(data.documentNumber || "").trim() ||
    buildCertificateNumber(`${data.id || ""}:${nationalId}:${educationCode}:${programEndDate}`);

  drawCenteredText(page, displayFont, fullName, displayName.y, {
    size: displayName.size,
    color: BRAND_BLUE,
  });

  drawText(page, font, nationalId, table.left.x, table.rows.row1, { size: table.left.size, color });
  drawText(page, font, fullName, table.left.x, table.rows.row2, { size: table.left.size, color });
  drawText(page, font, birthInfo, table.left.x, table.rows.row3, { size: table.left.size, color });

  drawCharLimitWrappedText(page, font, educationName, table.middle.x, table.rows.row1, {
    size: table.middle.size,
    charLimit: MIDDLE_COLUMN_CHAR_WRAP,
    lineHeight: 11,
    color,
  });
  drawCharLimitWrappedText(page, font, educationCategory, table.middle.x, table.rows.row2, {
    size: table.middle.size,
    charLimit: MIDDLE_COLUMN_CHAR_WRAP,
    lineHeight: 11,
    color,
  });
  drawCharLimitWrappedText(page, font, level, table.middle.x, table.rows.row3, {
    size: table.middle.size,
    charLimit: MIDDLE_COLUMN_CHAR_WRAP,
    lineHeight: 11,
    color,
  });

  drawText(page, font, documentNumber, table.right.x, table.rows.row1, { size: table.right.size, color });
  drawMultilineText(page, font, issuePlace, table.right.x, table.rows.row2, {
    size: table.right.size,
    lineHeight: 11,
    color,
  });
  drawText(page, font, controlDate, table.right.x, table.rows.row3, { size: table.right.size, color });

  drawLegalParagraphRow(
    page,
    font,
    buildLegalParagraphs({ programStartDate, programEndDate, programHours }),
    legalParagraph,
    color,
  );

  await drawDirectorSignature(pdfDoc, page, boldFont, qr, directorSignature, color);

  await drawCenteredQr(
    pdfDoc,
    page,
    buildQrPayload({ qrContent: data.qrContent, documentNumber, nationalId, educationCode }),
    qr,
  );

  const pdfBytes = await pdfDoc.save();
  const safeCode = (educationCode || documentNumber).replace(/[^A-Za-z0-9-]+/g, "_") || "sertifika";
  const safeTc = nationalId.replace(/\D/g, "") || "kursiyer";
  const fileName = `sertifika_${safeCode}_${safeTc}.pdf`;

  return { pdfBytes, fileName, documentNumber };
}
