import { normalizeSalesFilter, salesFilterRequiresInstitution } from "../../config/salesFilters.js";

const normalizeUploadPath = (value) => {
  if (typeof value !== "string" || !value.length) return value;
  if (!value.includes("/uploads/")) return value;
  return `/uploads/${value.split("/uploads/").pop()}`;
};

const EDUCATION_CODE_RE = /^[A-Z]{3}-\d+-\d+-\d+$/;

const normalizeEducationCodeValue = (value) => {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!EDUCATION_CODE_RE.test(code)) {
    throw new Error("Eğitim kodu GZM-1-32-03 formatında olmalıdır (Önek-Kurum-Kategori-Sıra).");
  }
  return code;
};

const isValidEducationCode = (value) => {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return EDUCATION_CODE_RE.test(code);
};

const normalizeJsonbStringArray = (value) => {
  if (value === null || value === undefined) return [];
  if (value === "") return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
        }
      } catch {
        /* satır satır madde olarak oku */
      }
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^\*\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
};

const prepareEducationPayload = (payload, { table } = {}) => {
  const isEducationsTable = table === "educations";

  if (typeof payload.content_doc_path === "string") {
    payload.content_doc_path = normalizeUploadPath(payload.content_doc_path);
  }
  if (typeof payload.promo_video_path === "string") {
    payload.promo_video_path = normalizeUploadPath(payload.promo_video_path);
  }
  if (Object.hasOwn(payload, "promo_video_path")) {
    const path = String(payload.promo_video_path || "").trim();
    payload.promo_video_path = path || null;
  }
  if (Object.hasOwn(payload, "promo_video_url")) {
    const url = String(payload.promo_video_url || "").trim();
    payload.promo_video_url = url || null;
  }
  delete payload.content_doc;
  delete payload.content_blocks;
  delete payload.content_html;
  delete payload.modules;

  if (Object.hasOwn(payload, "topic_headings")) {
    payload.topic_headings = normalizeJsonbStringArray(payload.topic_headings);
  }

  if (Object.hasOwn(payload, "code")) {
    payload.code = normalizeEducationCodeValue(payload.code);
  }

  if (Object.hasOwn(payload, "sales_filter")) {
    const salesFilter = normalizeSalesFilter(payload.sales_filter);
    if (!salesFilter) {
      throw new Error("Geçerli bir satış filtresi seçin.");
    }
    payload.sales_filter = salesFilter;
    /** Kurum yalnızca işbirliği sertifikasyon türünde tutulur. */
    if (!salesFilterRequiresInstitution(salesFilter)) {
      payload.institution_id = null;
    }
    if (isEducationsTable && salesFilter !== "guzem-ucretli") {
      payload.price = null;
      payload.has_discount = false;
      payload.discount_rate = null;
    }
  }

  // Ücret alanları yalnızca eğitim listesinde (educations) tutulur.
  if (!isEducationsTable) {
    delete payload.price;
    delete payload.has_discount;
    delete payload.discount_rate;
  } else {
    if (Object.hasOwn(payload, "price")) {
      if (payload.price === "" || payload.price === null || payload.price === undefined) {
        payload.price = null;
      } else {
        const n = Number(payload.price);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Ücret geçerli bir sayı olmalıdır.");
        }
        payload.price = n;
      }
    }

    if (Object.hasOwn(payload, "has_discount")) {
      payload.has_discount =
        payload.has_discount === true ||
        payload.has_discount === "true" ||
        payload.has_discount === 1 ||
        payload.has_discount === "1";
    }

    if (Object.hasOwn(payload, "discount_rate")) {
      if (!payload.has_discount) {
        payload.discount_rate = null;
      } else if (payload.discount_rate === "" || payload.discount_rate === null || payload.discount_rate === undefined) {
        throw new Error("İndirim oranını giriniz.");
      } else {
        const n = Number(payload.discount_rate);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
          throw new Error("İndirim oranı 1–100 arasında olmalıdır.");
        }
        payload.discount_rate = n;
      }
    }

    if (payload.sales_filter === "guzem-ucretli") {
      if (payload.price == null) {
        throw new Error("Ücretli eğitimler için ücret giriniz.");
      }
    }
  }

  if (payload.institution_id === "") payload.institution_id = null;
  if (payload.instructor_id === "") payload.instructor_id = null;
  if (payload.category_id === "") payload.category_id = null;
};

const prepareExamQuestionPayload = (payload) => {
  if (typeof payload.topic_doc_path === "string") payload.topic_doc_path = normalizeUploadPath(payload.topic_doc_path);
  if (typeof payload.questions_doc_path === "string") payload.questions_doc_path = normalizeUploadPath(payload.questions_doc_path);
  if (payload.generated_questions !== undefined) {
    const gq = payload.generated_questions;
    if (gq === null || gq === "") {
      payload.generated_questions = null;
    } else if (typeof gq === "string") {
      const trimmed = gq.trim();
      if (!trimmed) {
        payload.generated_questions = null;
      } else {
        try {
          payload.generated_questions = JSON.parse(trimmed);
        } catch {
          throw new Error("Hazırlanan sorular geçerli JSON formatında değil.");
        }
      }
    } else if (typeof gq === "object") {
      payload.generated_questions = gq;
    }
  }
  if (payload.exam_target_difficulty !== undefined) {
    const d = String(payload.exam_target_difficulty || "medium").toLowerCase();
    payload.exam_target_difficulty = ["easy", "medium", "hard"].includes(d) ? d : "medium";
  }
  if (payload.exam_question_count !== undefined) {
    const n = parseInt(payload.exam_question_count, 10);
    payload.exam_question_count = Math.min(200, Math.max(1, Number.isFinite(n) ? n : 20));
  }
  if (payload.pool_question_count !== undefined) {
    const n = parseInt(payload.pool_question_count, 10);
    payload.pool_question_count = Math.min(300, Math.max(5, Number.isFinite(n) ? n : 60));
  }
  delete payload.question_text;
  delete payload.difficulty;
  delete payload.option_a;
  delete payload.option_b;
  delete payload.option_c;
  delete payload.option_d;
  delete payload.correct_answer;
};

export {
  normalizeUploadPath,
  EDUCATION_CODE_RE,
  normalizeEducationCodeValue,
  isValidEducationCode,
  prepareEducationPayload,
  prepareExamQuestionPayload,
};
