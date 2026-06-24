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

const prepareEducationPayload = (payload) => {
  if (typeof payload.content_doc_path === "string") {
    payload.content_doc_path = normalizeUploadPath(payload.content_doc_path);
  }
  delete payload.content_doc;
  delete payload.content_blocks;
  delete payload.content_html;

  if (Object.hasOwn(payload, "code")) {
    payload.code = normalizeEducationCodeValue(payload.code);
  }
};

const prepareExamQuestionPayload = (payload) => {
  if (typeof payload.topic_doc_path === "string") payload.topic_doc_path = normalizeUploadPath(payload.topic_doc_path);
  if (typeof payload.questions_doc_path === "string") payload.questions_doc_path = normalizeUploadPath(payload.questions_doc_path);
  if (payload.generated_questions && typeof payload.generated_questions === "object") {
    payload.generated_questions = JSON.stringify(payload.generated_questions);
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
