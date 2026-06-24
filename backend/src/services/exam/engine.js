import { EXAM_MCQ_OPTIONS } from "./constants.js";

const normalizeCorrectLetter = (value) => {
  const raw = String(value ?? "").trim().toUpperCase();
  const one = raw.match(/^[A-E]$/);
  if (one) return one[0];
  const pref = raw.match(/^([A-E])[\).:-]/i);
  return pref ? pref[1].toUpperCase() : "";
};

const normalizeQuestions = (items = [], maxCount = 300) =>
  items.slice(0, Math.max(0, maxCount)).map((item, index) => {
    let options = [];
    if (Array.isArray(item.options) && item.options.length) {
      options = item.options.map((o) => String(o ?? "").trim()).filter(Boolean).slice(0, EXAM_MCQ_OPTIONS);
    }
    while (options.length < EXAM_MCQ_OPTIONS) {
      options.push(`Seçenek ${String.fromCharCode(65 + options.length)}`);
    }
    let correct = normalizeCorrectLetter(item.correctAnswer || item.answer || "");
    const maxLetter = String.fromCharCode(65 + options.length - 1);
    if (!correct || correct > maxLetter) correct = "A";
    return {
      question: item.question || item.text || `Soru ${index + 1}`,
      options,
      correctAnswer: correct,
    };
  });

const normalizeExamQuestionPool = (value) => {
  const parsed = typeof value === "string" ? JSON.parse(value) : value || {};
  return {
    easy: normalizeQuestions(Array.isArray(parsed.easy) ? parsed.easy : [], 500),
    medium: normalizeQuestions(Array.isArray(parsed.medium) ? parsed.medium : [], 500),
    hard: normalizeQuestions(Array.isArray(parsed.hard) ? parsed.hard : [], 500),
  };
};

const shuffleArray = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const pickExamQuestions = (pool, targetDifficulty = "medium", examQuestionCount = 20) => {
  const key = ["easy", "medium", "hard"].includes(targetDifficulty) ? targetDifficulty : "medium";
  const list = pool[key] || [];
  const want = Math.max(1, Math.min(200, Number(examQuestionCount) || 20));
  const n = Math.min(want, list.length);
  return shuffleArray(list.map((question, index) => ({ ...question, difficulty: key, originalIndex: index })))
    .slice(0, n)
    .map((question, index) => ({
      id: `${key}-${question.originalIndex}-${index}`,
      difficulty: key,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
    }));
};

const publicExamQuestion = (question, index) => ({
  id: question.id,
  number: index + 1,
  difficulty: question.difficulty,
  question: question.question,
  options: question.options,
});

const normalizeExamAnswer = (value, options = []) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const letter = raw.match(/^[A-E]$/i)?.[0]?.toUpperCase();
  if (letter) return letter;
  const byPrefix = raw.match(/^([A-E])[\).:-]\s*/i)?.[1]?.toUpperCase();
  if (byPrefix) return byPrefix;
  const idx = options.findIndex((option) => String(option ?? "").trim().toLowerCase() === raw.toLowerCase());
  return idx >= 0 ? String.fromCharCode(65 + idx) : raw.toLowerCase();
};

const gradeExamAttempt = (questions = [], answers = {}) => {
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;
  const normalizedAnswers = {};
  for (const question of questions) {
    const selected = normalizeExamAnswer(answers?.[question.id], question.options);
    const correct = normalizeExamAnswer(question.correctAnswer, question.options);
    normalizedAnswers[question.id] = selected;
    if (!selected) blankCount += 1;
    else if (selected === correct) correctCount += 1;
    else wrongCount += 1;
  }
  const total = questions.length || 1;
  const score = Math.round((correctCount / total) * 10000) / 100;
  return { correctCount, wrongCount, blankCount, score, normalizedAnswers };
};

const EXAM_DIFFICULTY_LABELS = {
  easy: "Temel",
  medium: "Orta",
  hard: "İleri",
};

const formatEducationSeviye = (raw) => {
  const key = String(raw || "medium").trim().toLowerCase();
  return EXAM_DIFFICULTY_LABELS[key] || "Orta";
};

export {
  normalizeCorrectLetter,
  normalizeQuestions,
  normalizeExamQuestionPool,
  shuffleArray,
  pickExamQuestions,
  publicExamQuestion,
  normalizeExamAnswer,
  gradeExamAttempt,
  EXAM_DIFFICULTY_LABELS,
  formatEducationSeviye,
};
