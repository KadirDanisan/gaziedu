import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { uploadsDir } from "../../config/env.js";

const EXPECTED_HEADERS = [
  "modul",
  "soru koku",
  "a sikki",
  "b sikki",
  "c sikki",
  "d sikki",
  "e sikki",
  "dogru cevap",
];

const decodeHtml = (value) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));

const htmlCellToText = (html) =>
  decodeHtml(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();

const normalizeHeader = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseRowsFromHtml = (html) => {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(String(html || "")))) {
    const cells = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      cells.push(htmlCellToText(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
};

const isExpectedHeaderRow = (cells) =>
  cells.length === EXPECTED_HEADERS.length &&
  cells.every((cell, index) => normalizeHeader(cell) === EXPECTED_HEADERS[index]);

const normalizeCorrectAnswer = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized.match(/^[A-E](?:\s*[\).:-])?$/)?.[0]?.charAt(0) || "";
};

export const parseExamTableHtml = (html) => {
  const rows = parseRowsFromHtml(html);
  const headerIndex = rows.findIndex(isExpectedHeaderRow);
  if (headerIndex < 0) {
    throw new Error(
      "Word tablosunda beklenen başlık satırı bulunamadı. Sütunlar sırasıyla Modül, Soru Kökü, A şıkkı, B şıkkı, C şıkkı, D şıkkı, E şıkkı ve Doğru Cevap olmalıdır.",
    );
  }

  const questions = [];
  const errors = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index];
    if (cells.every((cell) => !cell)) continue;
    if (isExpectedHeaderRow(cells)) continue;

    const wordRow = index + 1;
    if (cells.length !== EXPECTED_HEADERS.length) {
      errors.push(`${wordRow}. satır ${cells.length} hücre içeriyor; tam 8 hücre olmalıdır.`);
      continue;
    }

    // 1. sütun (Modül) yok sayılır; 2–8: soru kökü, A–E, doğru cevap
    const question = cells[1];
    const options = cells.slice(2, 7);
    const correctAnswer = normalizeCorrectAnswer(cells[7]);
    const missing = [];
    if (!question) missing.push("Soru Kökü");
    options.forEach((option, optionIndex) => {
      if (!option) missing.push(`${String.fromCharCode(65 + optionIndex)} şıkkı`);
    });
    if (!correctAnswer) missing.push("Doğru Cevap (A-E)");
    if (missing.length) {
      errors.push(`${wordRow}. satır eksik/geçersiz: ${missing.join(", ")}.`);
      continue;
    }

    questions.push({ question, options, correctAnswer });
  }

  if (errors.length) {
    const shown = errors.slice(0, 8).join(" ");
    const remaining = errors.length > 8 ? ` Ayrıca ${errors.length - 8} hata daha var.` : "";
    throw new Error(`Word tablosu okunamadı: ${shown}${remaining}`);
  }
  if (!questions.length) {
    throw new Error("Word tablosunda başlık satırından sonra geçerli soru bulunamadı.");
  }
  if (questions.length > 300) {
    throw new Error("Bir Word dosyasında en fazla 300 soru yüklenebilir.");
  }

  return {
    easy: [],
    medium: questions,
    hard: [],
  };
};

export const parseExamQuestionsFromDocx = async (docPath) => {
  const absolutePath = path.join(uploadsDir, path.basename(String(docPath || "")));
  if (!fs.existsSync(absolutePath)) {
    throw new Error("Yüklenen Word dosyası bulunamadı.");
  }
  const result = await mammoth.convertToHtml({ path: absolutePath });
  return parseExamTableHtml(result.value || "");
};
