import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../assets/certificates/GUZEM_KS_Yeni_son.pdf");
const SIGNATURE_PATH = path.resolve(__dirname, "../assets/certificates/selami_eryilmaz_imza.png");
const GREAT_VIBES_FONT_PATH = path.resolve(__dirname, "../assets/fonts/GreatVibes-Regular.ttf");
const EXTERNAL_CHARM_FONT_PATH = "C:\\Users\\msı\\Downloads\\Document fonts\\Document fonts\\Charm-Regular.ttf";
const EXTERNAL_HELVETICA_LT_PRO_PATH =
  "C:\\Users\\msı\\Downloads\\Document fonts\\Document fonts\\Helvetica Neue LT Pro 55 Roman.ttf";

/** Site ana mavisi */
const BRAND_BLUE = rgb(14 / 255, 56 / 255, 119 / 255);

/**
 * Landscape A4 şablon (841.89 × 595.28 pt) — koordinatlar sol-alt köşe (0,0).
 * Konumları buradan ayarlayabilirsin.
 */
const LAYOUT = {
  /** Sayfa 1: isim + yasal paragraflar */
  page1: {
    displayName: { y: 295, size: 53 },
    legalParagraph: {
      y: 225,
      size: 10,
      lineHeight: 12,
      gap: 30,
      left: { x: 72 },
    },
  },
  /** Sayfa 2: kursiyer + program tabloları + QR */
  page2: {
    trainee: {
      valueX: 215,
      size: 8,
      rows: {
        fullName: 391,
        nationalId: 361,
        certificateDate: 318,
        documentNumber: 283,
      },
    },
    program: {
      valueX: 464,
      trSize: 8,
      enSize: 6,
      trCharLimit: 50,
      enCharLimit: 65,
      lineHeight: 11,
      enLineHeight: 9,
      enGap: 2,
      rows: {
        educationName: 390,
        educationCategory: 353,
        level: 320,
        language: 285,
      },
    },
    qr: { x: 373, y: 134, size: 90 },
  },
};

const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const CHARM_REGULAR_PATH = path.resolve(FONTS_DIR, "Charm-Regular.ttf");
const HELVETICA_LT_PRO_PATH = path.resolve(FONTS_DIR, "HelveticaNeueLTPro55Roman.ttf");

const firstExistingPath = (candidates) => {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
};

/** displayName — Charm Regular */
const resolveDisplayNameFontPath = () =>
  firstExistingPath([
    EXTERNAL_CHARM_FONT_PATH,
    CHARM_REGULAR_PATH,
    path.resolve(FONTS_DIR, "Charm-Regular.otf"),
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/Charm-Regular.ttf"),
    GREAT_VIBES_FONT_PATH,
  ]);

/** legalParagraph + trainee + program — Helvetica Neue LT Pro 55 Roman */
const resolveHelveticaProFontPath = () =>
  firstExistingPath([
    EXTERNAL_HELVETICA_LT_PRO_PATH,
    HELVETICA_LT_PRO_PATH,
    path.resolve(FONTS_DIR, "HelveticaNeueLTPro55Roman.otf"),
    path.resolve(FONTS_DIR, "HelveticaNeueLTPro-Roman.ttf"),
    path.resolve(FONTS_DIR, "Helvetica Neue LT Pro 55 Roman.ttf"),
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/HelveticaNeueLTPro55Roman.ttf"),
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/HelveticaNeueLTPro-Roman.ttf"),
    path.resolve(process.env.WINDIR || "C:\\Windows", "Fonts/arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ]);

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

const splitBilingualLine = (text) => {
  const safe = String(text || "").trim() || "—";
  const sep = safe.indexOf(" / ");
  if (sep === -1) return { tr: safe, en: "" };
  return {
    tr: safe.slice(0, sep).trim() || "—",
    en: safe.slice(sep + 3).trim(),
  };
};

const drawBilingualText = (
  page,
  font,
  text,
  x,
  y,
  { trSize, enSize, charLimit, trCharLimit, enCharLimit, lineHeight, enLineHeight, enGap, color },
) => {
  const { tr, en } = splitBilingualLine(text);
  let cursorY = y;

  const trLimit = trCharLimit ?? charLimit;
  const enLimit = enCharLimit ?? (trLimit ? Math.round(trLimit * (trSize / enSize)) : undefined);
  const trStep = lineHeight || trSize + 2.5;
  const enStep = enLineHeight || enSize + 2;

  if (trLimit) {
    for (const line of splitTextByCharLimit(tr, trLimit)) {
      drawText(page, font, line, x, cursorY, { size: trSize, color });
      cursorY -= trStep;
    }
  } else {
    drawText(page, font, tr, x, cursorY, { size: trSize, color });
    cursorY -= trSize + (enGap ?? 2);
  }

  if (en) {
    if (enGap) cursorY -= enGap;
    const enLines = enLimit ? splitTextByCharLimit(en, enLimit) : [en];
    for (const line of enLines) {
      drawText(page, font, line, x, cursorY, { size: enSize, color });
      cursorY -= enStep;
    }
  }

  return cursorY;
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

const wrapTextLines = (font, text, size, maxWidth) => {
  const safe = String(text || "").trim() || "—";
  if (!maxWidth) return [safe];

  const words = safe.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
};

const drawWrappedText = (page, font, text, x, y, { size, maxWidth, lineHeight, color }) => {
  const lines = wrapTextLines(font, text, size, maxWidth);
  let cursorY = y;
  const step = lineHeight || size + 3;

  for (const line of lines) {
    drawText(page, font, line, x, cursorY, { size, color });
    cursorY -= step;
  }
  return cursorY;
};

const drawWrappedTextRight = (page, font, text, rightEdgeX, y, { size, maxWidth, lineHeight, color }) => {
  const lines = wrapTextLines(font, text, size, maxWidth);
  let cursorY = y;
  const step = lineHeight || size + 3;

  for (const line of lines) {
    const textWidth = font.widthOfTextAtSize(line, size);
    drawText(page, font, line, rightEdgeX - textWidth, cursorY, { size, color });
    cursorY -= step;
  }
  return cursorY;
};

const buildLegalParagraphs = ({ programStartDate, programEndDate, educationName }) => {
  const { tr: educationNameTr, en: educationNameEn } = splitBilingualLine(educationName);
  const educationNameEnText = educationNameEn || educationNameTr;

  return {
    left: `Yukarıda bilgileri verilen kursiyer; Gazi Üniversitesi Uzaktan Eğitim Uygulama ve Araştırma Merkezi tarafından ${programStartDate} ile ${programEndDate} tarihleri arasında çevrim içi olarak düzenlenen "${educationNameTr}" kursunun tüm koşullarını başarıyla tamamlayarak bu belgeyi almaya hak kazanmıştır.`,
    right: `The trainee whose information is given above has successfully completed all requirements of the "${educationNameEnText}" course held online by Gazi University Distance Education Application and Research Center between ${programStartDate} and ${programEndDate}, and has earned the right to receive this certificate.`,
  };
};

const drawLegalParagraphRow = (page, font, paragraphs, layout, color) => {
  const pageWidth = page.getWidth();
  const { y, size, lineHeight, gap, left } = layout;
  const columnWidth = (pageWidth - left.x * 2 - gap) / 2;
  const rightColumnX = left.x + columnWidth + gap;
  const leftColumnRightEdge = left.x + columnWidth;

  drawWrappedTextRight(page, font, paragraphs.left, leftColumnRightEdge, y, {
    size,
    maxWidth: columnWidth,
    lineHeight,
    color,
  });
  drawWrappedText(page, font, paragraphs.right, rightColumnX, y, {
    size,
    maxWidth: columnWidth,
    lineHeight,
    color,
  });
};

/**
 * e-Devlet Barkodlu Belge Doğrulama uygulamasının okuduğu QR formatı:
 * barkodlubelgedogrulama://barkod: {Belge Doğrulama Kodu};tckn:{T.C.}
 */
const buildQrPayload = ({ qrContent, documentNumber, nationalId }) => {
  const custom = String(qrContent || "").trim();
  if (custom) return custom;

  const barkod = String(documentNumber || "").trim();
  const tckn = String(nationalId || "").replace(/\D/g, "");
  if (!barkod) {
    throw new Error("Belge Doğrulama Kodu oluşturulamadı.");
  }
  if (!tckn) {
    throw new Error("T.C. Kimlik No bulunamadı.");
  }

  return `barkodlubelgedogrulama://barkod: ${barkod};tckn:${tckn}`;
};

const drawQr = async (pdfDoc, page, payload, { x, y, size }) => {
  const qrPng = await QRCode.toBuffer(payload, {
    type: "png",
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#141820", light: "#FFFFFF" },
  });

  const qrImage = await pdfDoc.embedPng(qrPng);
  page.drawImage(qrImage, { x, y, width: size, height: size });
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
    throw new Error("Sertifika şablonu bulunamadı (GUZEM_KS_Yeni_son.pdf).");
  }

  const displayFontPath = resolveDisplayNameFontPath();
  if (!displayFontPath) {
    throw new Error("Sertifika için Charm Regular fontu bulunamadı (assets/fonts/Charm-Regular.ttf).");
  }

  const bodyFontPath = resolveHelveticaProFontPath();
  if (!bodyFontPath) {
    throw new Error(
      "Sertifika için Helvetica Neue LT Pro 55 Roman fontu bulunamadı (assets/fonts/HelveticaNeueLTPro55Roman.ttf).",
    );
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  let templateDoc;
  try {
    templateDoc = await PDFDocument.load(templateBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch (err) {
    throw new Error(
      `Sertifika şablonu okunamadı (GUZEM_KS_Yeni_son.pdf bozuk veya geçersiz): ${err?.message || err}`,
    );
  }

  if (templateDoc.getPageCount() < 2) {
    throw new Error("Sertifika şablonu 2 sayfa içermelidir.");
  }

  // Şablonu kopyalayarak yükle — arka plan grafiklerinin kaybolmaması için.
  const pdfDoc = await PDFDocument.create();
  const copiedPages = await pdfDoc.copyPages(templateDoc, templateDoc.getPageIndices());
  for (const copiedPage of copiedPages) {
    pdfDoc.addPage(copiedPage);
  }

  pdfDoc.registerFontkit(fontkit);
  const displayFont = await pdfDoc.embedFont(fs.readFileSync(displayFontPath));
  const bodyFont = await pdfDoc.embedFont(fs.readFileSync(bodyFontPath));
  const legalFont = bodyFont;
  const tableFont = bodyFont;

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1];
  const color = rgb(0.08, 0.1, 0.16);
  const { page1: page1Layout, page2: page2Layout } = LAYOUT;

  const fullName = String(data.fullName || "").trim() || "—";
  const nationalId = String(data.nationalId || "").trim() || "—";
  const educationName = String(data.educationName || "").trim() || "—";
  const educationCategory =
    String(data.educationCategory || data.educationField || "").trim() || "—";
  const level = String(data.level || "ORTA").trim();
  const birthInfo = String(data.birthInfo || "Türkçe").trim();

  const programEndDate = formatIsoDate(data.programEndDate || data.controlDate || new Date());
  const programHours = Number(data.programHours) || parseDurationHours(data.duration);
  const defaultStartDays = Math.max(14, Math.ceil(programHours / 2));
  const programStartDate = formatIsoDate(
    data.programStartDate || subtractDaysIso(programEndDate, defaultStartDays),
  );
  const controlDate = formatIsoDate(data.controlDate || programEndDate);

  const educationCode = String(data.educationCode || "").trim();
  const documentNumber = String(data.documentNumber || "").trim();
  if (!documentNumber) {
    throw new Error("Belge Doğrulama Kodu (sertifika numarası) gerekli.");
  }

  // —— Sayfa 1 ——
  drawCenteredText(page1, displayFont, fullName, page1Layout.displayName.y, {
    size: page1Layout.displayName.size,
    color: BRAND_BLUE,
  });

  drawLegalParagraphRow(
    page1,
    legalFont,
    buildLegalParagraphs({ programStartDate, programEndDate, educationName }),
    page1Layout.legalParagraph,
    color,
  );

  // —— Sayfa 2 ——
  const { trainee, program, qr } = page2Layout;

  drawText(page2, tableFont, fullName, trainee.valueX, trainee.rows.fullName, {
    size: trainee.size,
    color,
  });
  drawText(page2, tableFont, nationalId, trainee.valueX, trainee.rows.nationalId, {
    size: trainee.size,
    color,
  });
  drawText(page2, tableFont, controlDate, trainee.valueX, trainee.rows.certificateDate, {
    size: trainee.size,
    color,
  });
  drawText(page2, tableFont, documentNumber, trainee.valueX, trainee.rows.documentNumber, {
    size: trainee.size,
    color,
  });

  drawBilingualText(page2, tableFont, educationName, program.valueX, program.rows.educationName, {
    trSize: program.trSize,
    enSize: program.enSize,
    trCharLimit: program.trCharLimit,
    enCharLimit: program.enCharLimit,
    lineHeight: program.lineHeight,
    enLineHeight: program.enLineHeight,
    enGap: program.enGap,
    color,
  });
  drawBilingualText(page2, tableFont, educationCategory, program.valueX, program.rows.educationCategory, {
    trSize: program.trSize,
    enSize: program.enSize,
    trCharLimit: program.trCharLimit,
    enCharLimit: program.enCharLimit,
    lineHeight: program.lineHeight,
    enLineHeight: program.enLineHeight,
    enGap: program.enGap,
    color,
  });
  drawBilingualText(page2, tableFont, level, program.valueX, program.rows.level, {
    trSize: program.trSize,
    enSize: program.enSize,
    trCharLimit: program.trCharLimit,
    enCharLimit: program.enCharLimit,
    lineHeight: program.lineHeight,
    enLineHeight: program.enLineHeight,
    enGap: program.enGap,
    color,
  });
  drawBilingualText(page2, tableFont, birthInfo, program.valueX, program.rows.language, {
    trSize: program.trSize,
    enSize: program.enSize,
    trCharLimit: program.trCharLimit,
    enCharLimit: program.enCharLimit,
    enLineHeight: program.enLineHeight,
    enGap: program.enGap,
    color,
  });

  await drawQr(
    pdfDoc,
    page2,
    buildQrPayload({ qrContent: data.qrContent, documentNumber, nationalId }),
    qr,
  );

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const safeCode = (educationCode || documentNumber).replace(/[^A-Za-z0-9-]+/g, "_") || "sertifika";
  const safeTc = nationalId.replace(/\D/g, "") || "kursiyer";
  const fileName = `sertifika_${safeCode}_${safeTc}.pdf`;

  return { pdfBytes, fileName, documentNumber };
}
