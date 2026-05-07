import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from "pg";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";

const { Pool } = pkg;
const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:1234@localhost:5432/guzem",
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".png";
    cb(null, `institution-logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Sadece görsel dosyaları yüklenebilir."));
  },
});

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `education-content-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".docx"}`);
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const migrateContactFormTimestampsToIstanbul = async () => {
  const alreadyMigrated = await pool.query(
    `SELECT 1 FROM activity_logs WHERE module_name = 'contactForms' AND action = 'timezone_migration' AND entity_id = 'GLOBAL' LIMIT 1`,
  );
  if (alreadyMigrated.rows[0]) return;

  await pool.query(
    `UPDATE contact_forms
     SET created_at = created_at + INTERVAL '3 hours',
         updated_at = updated_at + INTERVAL '3 hours'`,
  );
  await pool.query(
    `INSERT INTO activity_logs (action, module_name, entity_id, old_data, new_data)
     VALUES ('timezone_migration', 'contactForms', 'GLOBAL', NULL, jsonb_build_object('migrated', true, 'migratedAt', NOW()))`,
  );
};

const migrateInstitutionCodeColumn = async () => {
  await pool.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS code TEXT`);
};

const migrateInstructorAdminLinkColumn = async () => {
  await pool.query(`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS admin_user_id UUID UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE`);
  await pool.query(
    `UPDATE instructors i
     SET admin_user_id = a.id
     FROM admin_users a
     INNER JOIN roles r ON r.id = a.role_id
     WHERE i.admin_user_id IS NULL
       AND LOWER(i.email) = LOWER(a.email)
       AND r.code = 'egitmen'`,
  );
};

const migrateEducationDocColumns = async () => {
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS content_doc_path TEXT`);
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS content_doc_name TEXT`);
};

const migrateEducationCalendarColumns = async () => {
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS code TEXT`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS duration TEXT`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS content_doc_path TEXT`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS content_doc_name TEXT`);
  await pool.query(`ALTER TABLE education_calendar ALTER COLUMN calendar_date TYPE TIMESTAMPTZ USING calendar_date::timestamptz`);
};

const migrateEducationCategoryColumns = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS education_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_code TEXT NOT NULL UNIQUE,
      category_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES education_categories(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES education_categories(id) ON DELETE SET NULL`);
};

const migrateExamQuestionBatchColumns = async () => {
  await pool.query(`ALTER TABLE exam_questions ALTER COLUMN question_text DROP NOT NULL`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS topic_doc_path TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS topic_doc_name TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS questions_doc_path TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS questions_doc_name TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS generated_questions JSONB`);
};

const moduleConfig = {
  normalUsers: { table: "normal_users", actionKey: "normalUsers", searchable: ["first_name", "last_name", "email"] },
  adminUsers: { table: "admin_users", actionKey: "adminUsers", searchable: ["first_name", "last_name", "email", "phone"] },
  institutions: { table: "institutions", actionKey: "institutions", searchable: ["name", "code", "authorized_person"] },
  educationCategories: { table: "education_categories", actionKey: "educationCategories", searchable: ["category_code", "category_name"] },
  educations: { table: "educations", actionKey: "educations", searchable: ["name", "code", "description"] },
  instructors: { table: "instructors", actionKey: "instructors", searchable: ["first_name", "last_name", "email"] },
  educationCalendar: { table: "education_calendar", actionKey: "educationCalendar", searchable: ["education_name", "code", "description", "instructor_info"] },
  newsletter: { table: "newsletter", actionKey: "newsletter", searchable: ["email"] },
  contactForms: { table: "contact_forms", actionKey: "contactForms", searchable: ["full_name", "email", "subject"] },
  examQuestions: { table: "exam_questions", actionKey: "examQuestions", searchable: ["question_text", "difficulty", "topic_doc_name", "questions_doc_name"] },
  roles: { table: "roles", actionKey: "roles", searchable: ["name", "code"] },
};

const permissionModules = [
  "dashboard",
  "normalUsers",
  "adminUsers",
  "institutions",
  "educationCategories",
  "educations",
  "instructors",
  "educationCalendar",
  "newsletter",
  "contactForms",
  "examQuestions",
  "activityLogs",
  "roles",
];

const dbToApiMap = {
  first_name: "firstName",
  last_name: "lastName",
  password_hash: "passwordHash",
  institution_id: "institutionId",
  role_id: "roleId",
  category_id: "categoryId",
  authorized_person: "authorizedPerson",
  logo_url: "logoUrl",
  website_url: "websiteUrl",
  instructor_id: "instructorId",
  image_url: "imageUrl",
  education_name: "educationName",
  instructor_info: "instructorInfo",
  calendar_date: "calendarDate",
  full_name: "fullName",
  is_read: "isRead",
  question_text: "questionText",
  option_a: "optionA",
  option_b: "optionB",
  option_c: "optionC",
  option_d: "optionD",
  correct_answer: "correctAnswer",
  education_id: "educationId",
  module_name: "moduleName",
  can_view: "canView",
  can_create: "canCreate",
  can_update: "canUpdate",
  can_delete: "canDelete",
  created_at: "createdAt",
  updated_at: "updatedAt",
  content_doc_path: "contentDocPath",
  content_doc_name: "contentDocName",
  category_code: "categoryCode",
  category_name: "categoryName",
  content_html: "contentHtml",
  topic_doc_path: "topicDocPath",
  topic_doc_name: "topicDocName",
  questions_doc_path: "questionsDocPath",
  questions_doc_name: "questionsDocName",
  generated_questions: "generatedQuestions",
  admin_first_name: "adminFirstName",
  admin_last_name: "adminLastName",
  admin_email: "adminEmail",
};

const apiToDbMap = Object.fromEntries(Object.entries(dbToApiMap).map(([k, v]) => [v, k]));

const toApiObject = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [dbToApiMap[key] || key, Buffer.isBuffer(value) ? null : value]),
  );

const toDbObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [apiToDbMap[key] || key, value]),
  );

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Yetkisiz erişim." });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Oturum geçersiz." });
  }
};

const userAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Yetkisiz erişim." });
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload.userType !== "normalUser") {
      return res.status(401).json({ message: "Geçersiz kullanıcı oturumu." });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Oturum geçersiz." });
  }
};

const checkPermission = (moduleName, action) => async (req, res, next) => {
  const result = await pool.query(
    `SELECT can_view, can_create, can_update, can_delete FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`,
    [req.user.roleId, moduleName],
  );
  const permission = result.rows[0];
  if (!permission) return res.status(403).json({ message: "Yetkiniz yok." });
  if (!permission[action]) return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });
  next();
};

const writeActivityLog = async ({ req, action, moduleName, entityId, oldData, newData }) => {
  await pool.query(
    `INSERT INTO activity_logs (admin_user_id, action, module_name, entity_id, old_data, new_data, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      req.user?.id || null,
      action,
      moduleName,
      entityId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      req.ip,
      req.headers["user-agent"] || null,
    ],
  );
};

const getRoleCodeById = async (roleId) => {
  if (!roleId) return null;
  const result = await pool.query(`SELECT code FROM roles WHERE id = $1 LIMIT 1`, [roleId]);
  return result.rows[0]?.code || null;
};

const upsertInstructorByAdminUser = async (adminUser) => {
  if (!adminUser?.id || !adminUser?.email) return;
  const existing = await pool.query(`SELECT id FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [adminUser.id]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE instructors
       SET first_name = $1, last_name = $2, email = $3, password_hash = $4, updated_at = NOW()
       WHERE admin_user_id = $5`,
      [adminUser.first_name, adminUser.last_name, adminUser.email, adminUser.password_hash, adminUser.id],
    );
    return;
  }
  await pool.query(
    `INSERT INTO instructors (admin_user_id, first_name, last_name, email, password_hash)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET
       admin_user_id = EXCLUDED.admin_user_id,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()`,
    [adminUser.id, adminUser.first_name, adminUser.last_name, adminUser.email, adminUser.password_hash],
  );
};

const removeInstructorByAdminUserId = async (adminUserId) => {
  if (!adminUserId) return;
  await pool.query(`DELETE FROM instructors WHERE admin_user_id = $1`, [adminUserId]);
};

const extractEducationContentHtml = async (contentDocPath) => {
  if (!contentDocPath) return "";
  const rawPath = String(contentDocPath);
  const candidates = new Set();
  const asBasename = path.basename(rawPath);
  if (asBasename) {
    candidates.add(path.join(uploadsDir, asBasename));
  }
  if (rawPath.startsWith("/uploads/")) {
    candidates.add(path.join(uploadsDir, rawPath.replace(/^\/uploads\//, "")));
  }
  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const parsed = new URL(rawPath);
      if (parsed.pathname.startsWith("/uploads/")) {
        candidates.add(path.join(uploadsDir, parsed.pathname.replace(/^\/uploads\//, "")));
      } else if (parsed.pathname.includes("/uploads/")) {
        const fileName = parsed.pathname.split("/uploads/").pop();
        if (fileName) candidates.add(path.join(uploadsDir, fileName));
      }
    } catch {
      // ignore malformed url
    }
  }
  if (path.isAbsolute(rawPath)) {
    candidates.add(rawPath);
  }

  const absolutePath = Array.from(candidates).find((candidate) => fs.existsSync(candidate));
  if (!absolutePath) return "";

  const buffer = fs.readFileSync(absolutePath);
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.inline(async (element) => {
        const buffer = await element.read("base64");
        return { src: `data:${element.contentType};base64,${buffer}` };
      }),
    },
  );
  return result.value || "";
};

const extractDocxText = async (docPath) => {
  if (!docPath) return "";
  const normalized = normalizeUploadPath(docPath);
  const absolutePath = path.join(uploadsDir, path.basename(normalized));
  if (!fs.existsSync(absolutePath)) return "";
  const result = await mammoth.extractRawText({ path: absolutePath });
  return result.value || "";
};

const normalizeQuestions = (items = []) =>
  items.slice(0, 20).map((item, index) => ({
    question: item.question || item.text || `Soru ${index + 1}`,
    options: Array.isArray(item.options) && item.options.length ? item.options.slice(0, 4) : ["A", "B", "C", "D"],
    correctAnswer: item.correctAnswer || item.answer || "",
  }));

const parseQuestionsFromText = (text) => {
  const chunks = text
    .split(/\n(?=\s*(?:\d+[\).:-]|Soru\s+\d+))/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const questionLine = lines[0]?.replace(/^(?:Soru\s*)?\d+[\).:-]?\s*/i, "") || `Soru ${index + 1}`;
    const options = lines
      .slice(1)
      .filter((line) => /^[A-D][\).:-]\s*/i.test(line))
      .map((line) => line.replace(/^[A-D][\).:-]\s*/i, ""));
    const answerLine = lines.find((line) => /^(?:cevap|doğru cevap|dogru cevap|yanıt|yanit)\s*[:.-]/i.test(line));
    const correctAnswer = answerLine?.replace(/^(?:cevap|doğru cevap|dogru cevap|yanıt|yanit)\s*[:.-]\s*/i, "") || "";
    return {
      question: questionLine,
      options: options.length ? options : ["A secenegi", "B secenegi", "C secenegi", "D secenegi"],
      correctAnswer,
    };
  });
};

const fallbackQuestionsFromText = (text, mode) => {
  if (mode === "classify") {
    const parsedQuestions = parseQuestionsFromText(text);
    const normalized = parsedQuestions.length >= 3 ? parsedQuestions : text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => ({
      question: line,
      options: ["A secenegi", "B secenegi", "C secenegi", "D secenegi"],
      correctAnswer: "",
    }));
    return {
      easy: normalizeQuestions(normalized.slice(0, 20)),
      medium: normalizeQuestions(normalized.slice(20, 40)),
      hard: normalizeQuestions(normalized.slice(40, 60)),
    };
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const seed = lines.length ? lines : ["Genel konu"];
  const make = (difficulty) =>
    Array.from({ length: 20 }, (_, index) => {
      const topic = seed[index % seed.length];
      return {
        question: mode === "classify" ? topic : `${topic} konusu icin ${difficulty} seviyesinde soru ${index + 1}`,
        options: ["A secenegi", "B secenegi", "C secenegi", "D secenegi"],
        correctAnswer: "A",
      };
    });
  return { easy: make("kolay"), medium: make("orta"), hard: make("zor") };
};

const getExamAiPrompt = ({ text, mode }) => {
  const instruction = mode === "generate"
    ? "Verilen konu basliklarindan toplam 60 coktan secmeli soru uret: 20 easy, 20 medium, 20 hard. Her soruda question, 4 adet options ve correctAnswer zorunlu olsun."
    : "Verilen 60 soruyu zorluk seviyesine gore ayir: 20 easy, 20 medium, 20 hard. Sorulari, secenekleri ve dogru cevaplari mumkun oldugunca aynen koru. Eksik secenek varsa 4 secenek tamamla.";
  return [
    "Sadece gecerli JSON don.",
    "Sema: {\"easy\":[{\"question\":\"\",\"options\":[\"\",\"\",\"\",\"\"],\"correctAnswer\":\"\"}],\"medium\":[],\"hard\":[]}.",
    "Her grupta tam 20 soru olmali.",
    "Secenekler gercek cevap secenekleri olmali, placeholder kullanma.",
    instruction,
    "",
    "Icerik:",
    text.slice(0, 24000),
  ].join("\n");
};

const parseAiQuestionJson = (content, providerName) => {
  try {
    const cleaned = String(content || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      easy: normalizeQuestions(parsed.easy),
      medium: normalizeQuestions(parsed.medium),
      hard: normalizeQuestions(parsed.hard),
    };
  } catch {
    throw new Error(`${providerName} yaniti JSON olarak okunamadi.`);
  }
};

const buildExamQuestionsWithGemini = async ({ text, mode }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY bulunamadi. Backend .env dosyasini kontrol edip sunucuyu restart edin.");
  }
  const discoverGeminiModels = async () => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.models || [])
        .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
        .map((model) => model.name?.replace(/^models\//, ""))
        .filter(Boolean);
    } catch {
      return [];
    }
  };
  const discoveredModels = await discoverGeminiModels();
  const models = [
    process.env.GEMINI_MODEL,
    ...discoveredModels,
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro-latest",
  ].filter(Boolean);
  const uniqueModels = [...new Set(models)];
  const apiVersions = ["v1beta", "v1"];
  let lastError = "";
  for (const apiVersion of apiVersions) {
    for (const model of uniqueModels) {
      let response;
      const supportsJsonMime = !model.includes("gemini-pro");
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.4,
              ...(supportsJsonMime ? { responseMimeType: "application/json" } : {}),
            },
            contents: [
              {
                role: "user",
                parts: [{ text: getExamAiPrompt({ text, mode }) }],
              },
            ],
          }),
        });
      } catch (error) {
        lastError = `Gemini ag baglantisi kurulamadi (${apiVersion}/${model}): ${error.message}`;
        continue;
      }
      if (!response.ok) {
        lastError = `${apiVersion}/${model}: ${response.status} ${await response.text()}`;
        continue;
      }
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      return parseAiQuestionJson(content, "Gemini");
    }
  }
  throw new Error(`Gemini istegi basarisiz oldu: ${lastError}`);
};

const buildExamQuestionsWithAi = async ({ text, mode }) => {
  const provider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai")).toLowerCase();
  if (provider === "gemini") {
    return buildExamQuestionsWithGemini({ text, mode });
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY bulunamadi. Backend .env dosyasini kontrol edip sunucuyu restart edin.");
  }
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
          content: "Sadece gecerli JSON don. Semalar: {\"easy\":[{\"question\":\"\",\"options\":[\"\",\"\",\"\",\"\"],\"correctAnswer\":\"\"}],\"medium\":[],\"hard\":[]}. Her grupta tam 20 soru olmali. Secenekler gercek cevap secenekleri olmali, placeholder kullanma.",
        },
        { role: "user", content: getExamAiPrompt({ text, mode }) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI istegi basarisiz oldu: ${response.status} ${detail}`);
  }
  const data = await response.json();
  return parseAiQuestionJson(data.choices?.[0]?.message?.content || "{}", "OpenAI");
};

const normalizeUploadPath = (value) => {
  if (typeof value !== "string" || !value.length) return value;
  if (!value.includes("/uploads/")) return value;
  return `/uploads/${value.split("/uploads/").pop()}`;
};

const prepareEducationPayload = (payload) => {
  if (typeof payload.content_doc_path === "string") {
    payload.content_doc_path = normalizeUploadPath(payload.content_doc_path);
  }
  delete payload.content_doc;
  delete payload.content_blocks;
  delete payload.content_html;

  if (Object.hasOwn(payload, "code")) {
    const normalizedCode = String(payload.code || "").trim().toUpperCase();
    if (!/^[A-Z]{3}\d{7}$/.test(normalizedCode)) {
      throw new Error("Eğitim kodu GZM2631031 formatında olmalıdır (3 harf + 7 rakam).");
    }
    payload.code = normalizedCode;
  }
};

const prepareExamQuestionPayload = (payload) => {
  if (typeof payload.topic_doc_path === "string") payload.topic_doc_path = normalizeUploadPath(payload.topic_doc_path);
  if (typeof payload.questions_doc_path === "string") payload.questions_doc_path = normalizeUploadPath(payload.questions_doc_path);
  if (payload.generated_questions && typeof payload.generated_questions === "object") {
    payload.generated_questions = JSON.stringify(payload.generated_questions);
  }
  delete payload.question_text;
  delete payload.difficulty;
  delete payload.option_a;
  delete payload.option_b;
  delete payload.option_c;
  delete payload.option_d;
  delete payload.correct_answer;
};

const publishDueEducationCalendarItems = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const due = await client.query(
      `SELECT *
       FROM education_calendar
       WHERE calendar_date <= NOW()
       ORDER BY calendar_date ASC
       FOR UPDATE`,
    );

    for (const item of due.rows) {
      await client.query(
        `INSERT INTO educations
          (name, institution_id, instructor_id, description, image_url, code, duration, content, content_doc_path, content_doc_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          item.education_name,
          item.institution_id,
          item.instructor_id,
          item.description,
          item.image_url,
          item.code,
          item.duration,
          item.content || null,
          item.content_doc_path,
          item.content_doc_name,
        ],
      );
      await client.query(`DELETE FROM education_calendar WHERE id = $1`, [item.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    // eslint-disable-next-line no-console
    console.error("Education calendar publish failed:", error.message);
  } finally {
    client.release();
  }
};

const ensurePermissionRows = async () => {
  await pool.query(
    `INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
     SELECT r.id, m.module_name,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END
     FROM roles r
     CROSS JOIN unnest($1::text[]) AS m(module_name)
     ON CONFLICT (role_id, module_name) DO NOTHING`,
    [permissionModules],
  );
};

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash, a.role_id, r.code AS role_code, r.name AS role_name
       FROM admin_users a
       INNER JOIN roles r ON r.id = a.role_id
       WHERE a.email = $1 AND a.is_active = TRUE
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    const token = jwt.sign({ id: user.id, roleId: user.role_id, roleCode: user.role_code }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        roleId: user.role_id,
        roleCode: user.role_code,
        roleName: user.role_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Ad, soyad, e-posta ve şifre zorunludur." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO normal_users (first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name, last_name, email, created_at, updated_at`,
      [firstName, lastName, email, passwordHash],
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, userType: "normalUser" }, jwtSecret, { expiresIn: "12h" });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
      },
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Bu e-posta ile daha önce kayıt olunmuş." });
    }
    return next(error);
  }
});

app.post("/api/users/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
    }

    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash
       FROM normal_users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const token = jwt.sign({ id: user.id, userType: "normalUser" }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/users/me", userAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email FROM normal_users WHERE id = $1 LIMIT 1`,
      [req.user.id],
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/contact-forms", async (req, res, next) => {
  try {
    const { fullName, email, phone, subject, message } = req.body || {};
    if (!fullName || !email || !message) {
      return res.status(400).json({ message: "Ad soyad, e-posta ve mesaj alanları zorunludur." });
    }

    const result = await pool.query(
      `INSERT INTO contact_forms (full_name, email, phone, subject, message, is_read)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [fullName, email, phone || null, subject || null, message, false],
    );

    return res.status(201).json(toApiObject(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/newsletter", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "E-posta alanı zorunludur." });
    }

    const result = await pool.query(
      `INSERT INTO newsletter (email)
       VALUES ($1)
       RETURNING *`,
      [email],
    );

    return res.status(201).json(toApiObject(result.rows[0]));
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Bu e-posta zaten bültene kayıtlı." });
    }
    return next(error);
  }
});

app.post("/api/admin/uploads/institution-logo", auth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    }
    const publicPath = `/uploads/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get("host")}${publicPath}`;
    return res.status(201).json({ url: fileUrl, path: publicPath });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/uploads/education-image", auth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    }
    const publicPath = `/uploads/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get("host")}${publicPath}`;
    return res.status(201).json({ url: fileUrl, path: publicPath });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/uploads/education-content-doc", auth, uploadDoc.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    if (extension !== ".docx") return res.status(400).json({ message: "Sadece .docx dosyası yüklenebilir." });
    return res.status(201).json({
      fileName: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/uploads/exam-doc", auth, uploadDoc.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    const { mode } = req.body || {};
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    if (extension !== ".docx") return res.status(400).json({ message: "Sadece .docx dosyası yüklenebilir." });
    if (mode !== "generate" && mode !== "classify") return res.status(400).json({ message: "Geçersiz işlem tipi." });
    const docPath = `/uploads/${req.file.filename}`;
    const text = await extractDocxText(docPath);
    const questions = await buildExamQuestionsWithAi({ text, mode });
    return res.status(201).json({
      fileName: req.file.originalname,
      path: docPath,
      url: `${req.protocol}://${req.get("host")}${docPath}`,
      questions,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/bootstrap", auth, async (req, res, next) => {
  try {
    await ensurePermissionRows();
    const [permissions, roles, institutions, educationCategories, instructors, educationInstructors, educations] = await Promise.all([
      pool.query(`SELECT * FROM permissions`),
      pool.query(`SELECT * FROM roles ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM institutions ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM education_categories ORDER BY created_at DESC`),
      pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email
         FROM admin_users a
         INNER JOIN roles r ON r.id = a.role_id
         WHERE r.code = 'egitmen'
         ORDER BY a.first_name ASC, a.last_name ASC`,
      ),
      pool.query(
        `SELECT i.id, i.admin_user_id, a.first_name, a.last_name, a.email
         FROM instructors i
         INNER JOIN admin_users a ON a.id = i.admin_user_id
         INNER JOIN roles r ON r.id = a.role_id
         WHERE r.code = 'egitmen'
         ORDER BY a.first_name ASC, a.last_name ASC`,
      ),
      pool.query(`SELECT id, name, code FROM educations ORDER BY created_at DESC`),
    ]);
    res.json({
      permissions: permissions.rows.map(toApiObject),
      roles: roles.rows.map(toApiObject),
      institutions: institutions.rows.map(toApiObject),
      educationCategories: educationCategories.rows.map(toApiObject),
      instructors: instructors.rows.map(toApiObject),
      educationInstructors: educationInstructors.rows.map(toApiObject),
      educations: educations.rows.map(toApiObject),
      pageSize: 20,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/dashboard", auth, checkPermission("dashboard", "can_view"), async (req, res, next) => {
  try {
    const countQueries = [
      "SELECT COUNT(*)::int AS count FROM normal_users",
      "SELECT COUNT(*)::int AS count FROM admin_users",
      "SELECT COUNT(*)::int AS count FROM institutions",
      "SELECT COUNT(*)::int AS count FROM educations",
      "SELECT COUNT(*)::int AS count FROM instructors",
      "SELECT COUNT(*)::int AS count FROM newsletter",
      "SELECT COUNT(*)::int AS count FROM contact_forms",
      "SELECT COUNT(*)::int AS count FROM education_calendar",
    ];
    const [
      normalUsers,
      adminUsers,
      institutions,
      educations,
      instructors,
      newsletter,
      contactForms,
      educationCalendar,
    ] = await Promise.all(countQueries.map((q) => pool.query(q)));

    const [latestUsers, latestContacts, latestLogs] = await Promise.all([
      pool.query(`SELECT id, first_name, last_name, email, created_at FROM normal_users ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT id, full_name, subject, created_at FROM contact_forms ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT id, action, module_name, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10`),
    ]);

    res.json({
      stats: {
        normalUsers: normalUsers.rows[0].count,
        adminUsers: adminUsers.rows[0].count,
        institutions: institutions.rows[0].count,
        educations: educations.rows[0].count,
        instructors: instructors.rows[0].count,
        newsletter: newsletter.rows[0].count,
        contactForms: contactForms.rows[0].count,
        educationCalendar: educationCalendar.rows[0].count,
      },
      latestUsers: latestUsers.rows.map(toApiObject),
      latestContacts: latestContacts.rows.map(toApiObject),
      latestLogs: latestLogs.rows.map(toApiObject),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/activity-logs", auth, async (req, res, next) => {
  try {
    const permissionResult = await pool.query(
      `SELECT can_view FROM permissions WHERE role_id = $1 AND module_name = 'dashboard' LIMIT 1`,
      [req.user.roleId],
    );
    if (!permissionResult.rows[0]?.can_view) return res.status(403).json({ message: "Yetkiniz yok." });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 100));
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM activity_logs`);
    const result = await pool.query(
      `SELECT l.*, a.first_name AS admin_first_name, a.last_name AS admin_last_name, a.email AS admin_email
       FROM activity_logs l
       LEFT JOIN admin_users a ON a.id = l.admin_user_id
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    res.json({
      data: result.rows.map(toApiObject),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/:moduleName", auth, async (req, res, next) => {
  const { moduleName } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  try {
    const permissionResult = await pool.query(`SELECT can_view FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!permissionResult.rows[0]?.can_view) return res.status(403).json({ message: "Yetkiniz yok." });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const search = String(req.query.search || "").trim().toLowerCase();
    const readStatus = String(req.query.readStatus || "all").trim().toLowerCase();
    const offset = (page - 1) * pageSize;

    if (moduleName === "instructors") {
      const params = ["egitmen"];
      const conditions = ["r.code = $1"];
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(`(
          LOWER(COALESCE(a.first_name::text, '')) LIKE $${idx}
          OR LOWER(COALESCE(a.last_name::text, '')) LIKE $${idx}
          OR LOWER(COALESCE(a.email::text, '')) LIKE $${idx}
        )`);
      }
      const whereSql = `WHERE ${conditions.join(" AND ")}`;
      const countSql = `SELECT COUNT(*)::int AS total
                        FROM admin_users a
                        INNER JOIN roles r ON r.id = a.role_id
                        ${whereSql}`;
      const listSql = `SELECT a.id, a.first_name, a.last_name, a.email, a.created_at, a.updated_at,
                              COALESCE(i.title, '') AS title, COALESCE(i.department, '') AS department, COALESCE(i.about, '') AS about
                       FROM admin_users a
                       INNER JOIN roles r ON r.id = a.role_id
                       LEFT JOIN instructors i ON i.admin_user_id = a.id
                       ${whereSql}
                       ORDER BY a.created_at DESC
                       LIMIT $${params.length + 1}
                       OFFSET $${params.length + 2}`;
      const [countResult, listResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(listSql, [...params, pageSize, offset]),
      ]);
      return res.json({
        data: listResult.rows.map(toApiObject),
        pagination: {
          page,
          pageSize,
          total: countResult.rows[0].total,
          totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
        },
      });
    }

    const params = [];
    const conditions = [];

    if (search) {
      const searchConditions = config.searchable.map((field) => {
        params.push(`%${search}%`);
        return `LOWER(COALESCE(${field}::text, '')) LIKE $${params.length}`;
      });
      conditions.push(`(${searchConditions.join(" OR ")})`);
    }

    if (config.table === "contact_forms" && (readStatus === "read" || readStatus === "unread")) {
      params.push(readStatus === "read");
      conditions.push(`is_read = $${params.length}`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM ${config.table} ${whereSql}`;
    const listSql = `SELECT * FROM ${config.table} ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
    ]);
    const rows = config.table === "educations" || config.table === "education_calendar"
      ? await Promise.all(
          listResult.rows.map(async (row) => ({
            ...row,
            content_html: await extractEducationContentHtml(row.content_doc_path),
          })),
        )
      : listResult.rows;

    res.json({
      data: rows.map(toApiObject),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/:moduleName", auth, async (req, res, next) => {
  const { moduleName } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  if (config.table === "instructors") return res.status(400).json({ message: "Eğitmen ekleme işlemi Yönetim Listesi üzerinden yapılır." });
  try {
    const p = await pool.query(`SELECT can_create FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_create) return res.status(403).json({ message: "Yetkiniz yok." });
    const payload = toDbObject(req.body);
    if (config.table === "educations" || config.table === "education_calendar") {
      try {
        prepareEducationPayload(payload);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }
    if (config.table === "exam_questions") {
      prepareExamQuestionPayload(payload);
    }
    if (config.table === "admin_users" || config.table === "instructors" || config.table === "normal_users") {
      if (payload.password) {
        payload.password_hash = await bcrypt.hash(payload.password, 10);
        delete payload.password;
      }
    }
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${config.table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(sql, values);
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(result.rows[0].role_id);
      if (roleCode === "egitmen") {
        await upsertInstructorByAdminUser(result.rows[0]);
      }
    }
    await writeActivityLog({ req, action: "create", moduleName, entityId: result.rows[0].id, newData: result.rows[0] });
    res.status(201).json(toApiObject(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/:moduleName/:id", auth, async (req, res, next) => {
  const { moduleName, id } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  try {
    const p = await pool.query(`SELECT can_update FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_update) return res.status(403).json({ message: "Yetkiniz yok." });
    if (config.table === "instructors") {
      const allowed = ["title", "department", "about"];
      const payload = toDbObject(req.body);
      const updateKeys = Object.keys(payload).filter((key) => allowed.includes(key));
      if (!updateKeys.length) return res.status(400).json({ message: "Güncellenecek alan bulunamadı." });
      const adminUser = await pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash
         FROM admin_users a
         INNER JOIN roles r ON r.id = a.role_id
         WHERE a.id = $1 AND r.code = 'egitmen'
         LIMIT 1`,
        [id],
      );
      if (!adminUser.rows[0]) return res.status(404).json({ message: "Eğitmen kaydı bulunamadı." });
      await upsertInstructorByAdminUser(adminUser.rows[0]);
      const previous = await pool.query(`SELECT * FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [id]);
      const values = updateKeys.map((key) => payload[key]);
      const setSql = updateKeys.map((key, i) => `${key} = $${i + 1}`).join(", ");
      const result = await pool.query(
        `UPDATE instructors SET ${setSql}, updated_at = NOW() WHERE admin_user_id = $${updateKeys.length + 1} RETURNING *`,
        [...values, id],
      );
      await writeActivityLog({ req, action: "update", moduleName, entityId: id, oldData: previous.rows[0], newData: result.rows[0] });
      return res.json(toApiObject({ ...adminUser.rows[0], ...result.rows[0], id: adminUser.rows[0].id }));
    }
    const previous = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });

    const payload = toDbObject(req.body);
    if (config.table === "educations" || config.table === "education_calendar") {
      try {
        prepareEducationPayload(payload);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }
    if (config.table === "exam_questions") {
      prepareExamQuestionPayload(payload);
    }
    if ((config.table === "admin_users" || config.table === "instructors" || config.table === "normal_users") && payload.password) {
      payload.password_hash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }

    const keys = Object.keys(payload).filter((k) => k !== "id");
    const values = keys.map((k) => payload[k]);
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const sql = `UPDATE ${config.table} SET ${setSql}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await pool.query(sql, [...values, id]);
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(result.rows[0].role_id);
      if (roleCode === "egitmen") {
        await upsertInstructorByAdminUser(result.rows[0]);
      } else {
        await removeInstructorByAdminUserId(result.rows[0].id);
      }
    }
    await writeActivityLog({ req, action: "update", moduleName, entityId: id, oldData: previous.rows[0], newData: result.rows[0] });
    res.json(toApiObject(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/:moduleName/:id", auth, async (req, res, next) => {
  const { moduleName, id } = req.params;
  const config = moduleConfig[moduleName];
  if (!config) return res.status(404).json({ message: "Modül bulunamadı." });
  if (config.table === "instructors") return res.status(400).json({ message: "Eğitmen silme işlemi Yönetim Listesi üzerinden yapılır." });
  try {
    const p = await pool.query(`SELECT can_delete FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_delete) return res.status(403).json({ message: "Yetkiniz yok." });
    const previous = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    if (config.table === "admin_users") {
      const roleCode = await getRoleCodeById(previous.rows[0].role_id);
      if (roleCode === "egitmen") {
        await removeInstructorByAdminUserId(previous.rows[0].id);
      }
    }
    await pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName, entityId: id, oldData: previous.rows[0] });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin-role-permissions/:id", auth, checkPermission("roles", "can_update"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = toDbObject(req.body);
    const allowed = ["can_view", "can_create", "can_update", "can_delete"];
    const keys = Object.keys(payload).filter((key) => allowed.includes(key));
    if (!keys.length) return res.status(400).json({ message: "Geçersiz payload." });
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = keys.map((k) => payload[k]);
    const result = await pool.query(`UPDATE permissions SET ${setSql}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
    if (!result.rows[0]) return res.status(404).json({ message: "Yetki bulunamadı." });
    await writeActivityLog({ req, action: "permission_update", moduleName: "roles", entityId: id, newData: result.rows[0] });
    res.json(toApiObject(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.use(async (error, req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO error_logs (admin_user_id, route, method, message, stack, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        req.user?.id || null,
        req.originalUrl,
        req.method,
        error.message || "Unknown error",
        error.stack || null,
        req.body ? JSON.stringify(req.body) : null,
      ],
    );
  } catch {
    // no-op
  }
  res.status(500).json({ message: "Sunucu hatası.", detail: error.message });
  next();
});

const startServer = async () => {
  try {
    await migrateInstitutionCodeColumn();
    await migrateInstructorAdminLinkColumn();
    await migrateEducationDocColumns();
    await migrateEducationCalendarColumns();
    await migrateEducationCategoryColumns();
    await migrateExamQuestionBatchColumns();
    await migrateContactFormTimestampsToIstanbul();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Timestamp migration skipped:", error.message);
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API running on http://localhost:${port}`);
  });
  await publishDueEducationCalendarItems();
  setInterval(publishDueEducationCalendarItems, 60 * 1000);
};

startServer();
