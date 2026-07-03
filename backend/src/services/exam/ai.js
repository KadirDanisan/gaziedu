import { GoogleGenAI } from "@google/genai";
import { EXAM_MCQ_OPTIONS } from "./constants.js";
import { normalizeQuestions } from "./engine.js";

const parseQuestionsFromText = (text) => {
  const chunks = text
    .split(/\n(?=\s*(?:\d+[\).:.\-]|Soru\s+\d+))/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const questionLine = lines[0]?.replace(/^(?:Soru\s*)?\d+[\).:.\-]?\s*/i, "") || `Soru ${index + 1}`;
    const options = lines
      .slice(1)
      .filter((line) => /^[A-E][\).:-]\s*/i.test(line))
      .map((line) => line.replace(/^[A-E][\).:-]\s*/i, ""));
    const answerLine = lines.find((line) => /^(?:cevap|doğru cevap|dogru cevap|yanıt|yanit)\s*[:.-]/i.test(line));
    const correctAnswer = answerLine?.replace(/^(?:cevap|doğru cevap|dogru cevap|yanıt|yanit)\s*[:.-]\s*/i, "") || "";
    const defaults = Array.from({ length: EXAM_MCQ_OPTIONS }, (_, i) => `Seçenek ${String.fromCharCode(65 + i)}`);
    return {
      question: questionLine,
      options: options.length ? options : defaults,
      correctAnswer,
    };
  });
};

const fallbackQuestionsFromText = (text, mode, targetDifficulty = "medium", poolQuestionCount = 60) => {
  const N = Math.min(300, Math.max(5, Number(poolQuestionCount) || 60));
  const t = ["easy", "medium", "hard"].includes(targetDifficulty) ? targetDifficulty : "medium";
  const emptyPool = () => ({ easy: [], medium: [], hard: [] });
  if (mode === "classify") {
    const parsedQuestions = parseQuestionsFromText(text);
    const src =
      parsedQuestions.length >= 1
        ? parsedQuestions
        : text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({
              question: line,
              options: [],
              correctAnswer: "",
            }));
    const out = emptyPool();
    out[t] = normalizeQuestions(src.slice(0, N), N);
    return out;
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const seed = lines.length ? lines : ["Genel konu"];
  const label = t === "easy" ? "kolay" : t === "hard" ? "zor" : "orta";
  const items = Array.from({ length: N }, (_, index) => {
    const topic = seed[index % seed.length];
    return {
      question: `${topic} konusu icin ${label} seviyesinde soru ${index + 1}`,
      options: Array.from({ length: EXAM_MCQ_OPTIONS }, (_, i) => `Secenek ${String.fromCharCode(65 + i)}`),
      correctAnswer: "A",
    };
  });
  const out = emptyPool();
  out[t] = normalizeQuestions(items, N);
  return out;
};

const getExamAiPrompt = ({ text, mode, targetDifficulty = "medium", poolQuestionCount = 60 }) => {
  const N = Math.min(300, Math.max(5, Number(poolQuestionCount) || 60));
  const t = ["easy", "medium", "hard"].includes(targetDifficulty) ? targetDifficulty : "medium";
  const labelMap = { easy: "kolay (easy)", medium: "orta (medium)", hard: "zor (hard)" };
  const instruction =
    mode === "generate"
      ? `Verilen konu basliklarindan tam ${N} adet coktan secmeli soru uret. Tum sorular "${labelMap[t]}" zorlugunda olmali; yalnizca JSON anahtari "${t}" icinde listele, diger iki anahtar bos dizi [] olsun. Her soruda: question, tam ${EXAM_MCQ_OPTIONS} adet options (A..E), correctAnswer tek harf A-E.`
      : `Verilen icerikteki sorulari oku; tam ${N} soruyu "${labelMap[t]}" zorluguna gore siniflandir ve yalnizca "${t}" anahtarina diz; diger iki anahtar bos []. Her soruda ${EXAM_MCQ_OPTIONS} secenek ve dogru cevap A-E; eksik secenek varsa anlamli metinle tamamla.`;
  return [
    "Sadece gecerli JSON don.",
    `Sema: {"easy":[],"medium":[],"hard":[]} — "${t}" listesinde tam ${N} soru; diger iki liste bos [].`,
    `Her soru: {"question":"...","options":["","","","",""],"correctAnswer":"A"} — options tam ${EXAM_MCQ_OPTIONS} eleman.`,
    "Secenekler gercek metin olmali.",
    instruction,
    "",
    "Icerik:",
    text.slice(0, 24000),
  ].join("\n");
};

const parseAiQuestionJson = (content, providerName, poolQuestionCount = 60) => {
  const N = Math.min(300, Math.max(5, Number(poolQuestionCount) || 60));
  try {
    const cleaned = String(content || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      easy: normalizeQuestions(Array.isArray(parsed.easy) ? parsed.easy : [], N),
      medium: normalizeQuestions(Array.isArray(parsed.medium) ? parsed.medium : [], N),
      hard: normalizeQuestions(Array.isArray(parsed.hard) ? parsed.hard : [], N),
    };
  } catch {
    throw new Error(`${providerName} yaniti JSON olarak okunamadi.`);
  }
};

const buildExamQuestionsWithGemini = async ({ text, mode, targetDifficulty, poolQuestionCount }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY bulunamadi. Backend .env dosyasini kontrol edip sunucuyu restart edin.");
  }
  const model = String(process.env.GEMINI_MODEL || "").trim();
  if (!model) {
    throw new Error("GEMINI_MODEL .env icinde tanimli olmali (ornek: GEMINI_MODEL=gemini-3-flash-preview).");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = getExamAiPrompt({ text, mode, targetDifficulty, poolQuestionCount });
  const supportsJsonMime = !model.includes("gemini-pro");
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 12288,
        ...(supportsJsonMime ? { responseMimeType: "application/json" } : {}),
      },
    });
    const content = response.text ?? "";
    if (!content) {
      throw new Error(`${model}: bos yanit`);
    }
    return parseAiQuestionJson(content, "Gemini", poolQuestionCount);
  } catch (error) {
    throw new Error(`Gemini istegi basarisiz oldu (${model}): ${error?.message || error}`);
  }
};

const buildExamQuestionsWithAi = async ({ text, mode, targetDifficulty, poolQuestionCount }) => {
  const provider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai")).toLowerCase();
  if (provider === "gemini") {
    return buildExamQuestionsWithGemini({ text, mode, targetDifficulty, poolQuestionCount });
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY bulunamadi. Backend .env dosyasini kontrol edip sunucuyu restart edin.");
  }
  const N = Math.min(300, Math.max(5, Number(poolQuestionCount) || 60));
  const systemJson =
    "Sadece gecerli JSON don. Semalar: {\"easy\":[],\"medium\":[],\"hard\":[]}. " +
    "Kullanici istegine gore yalnizca bir zorluk listesi dolu olacak; o listede tam " +
    N +
    " soru olmali. Her soru: {\"question\":\"\",\"options\":[\"\",\"\",\"\",\"\",\"\"],\"correctAnswer\":\"A\"} — options tam 5 eleman, dogru cevap A-E. Secenekler gercek metin olmali.";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 12000,
      messages: [
        {
          role: "system",
          content: systemJson,
        },
        { role: "user", content: getExamAiPrompt({ text, mode, targetDifficulty, poolQuestionCount }) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI istegi basarisiz oldu: ${response.status} ${detail}`);
  }
  const data = await response.json();
  return parseAiQuestionJson(data.choices?.[0]?.message?.content || "{}", "OpenAI", poolQuestionCount);
};

export {
  parseQuestionsFromText,
  fallbackQuestionsFromText,
  getExamAiPrompt,
  parseAiQuestionJson,
  buildExamQuestionsWithGemini,
  buildExamQuestionsWithAi,
};
