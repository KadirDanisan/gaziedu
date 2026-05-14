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
import { GoogleGenAI } from "@google/genai";

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

/** reCAPTCHA v2 (checkbox): RECAPTCHA_SECRET_KEY tanımlıysa siteverify zorunlu. */
async function verifyRecaptchaV2IfConfigured(token) {
  const secret = (process.env.RECAPTCHA_SECRET_KEY || "").trim();
  if (!secret) return { ok: true };
  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      ok: false,
      message:
        "reCAPTCHA yanıtı gelmedi. Gizli anahtar açıkken site anahtarı da gerekir: proje kökünde VITE_RECAPTCHA_SITE_KEY ile frontend yeniden build edilmelidir.",
    };
  }
  const body = new URLSearchParams({ secret, response: token.trim() });
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    return { ok: false, message: "reCAPTCHA doğrulanamadı. Lütfen tekrar deneyin." };
  }
  return { ok: true };
}

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

const migrateApprovedEducationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approved_educations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category_id UUID NOT NULL REFERENCES education_categories(id) ON DELETE RESTRICT,
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT approved_educations_code_unique UNIQUE (code)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS approved_educations_category_id_idx ON approved_educations(category_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS approved_educations_institution_id_idx ON approved_educations(institution_id)`);
};

const migrateUserFavoritesTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES normal_users(id) ON DELETE CASCADE,
      education_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, education_id)
    )`,
  );
};

/** Eski tek kolon şemayı education + takvim satırlarını ayırt edecek yapıya taşır. */
const migrateUserFavoritesDualSupport = async () => {
  await pool.query(`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS target_type TEXT`);
  await pool.query(`UPDATE user_favorites SET target_type = 'education' WHERE target_type IS NULL OR btrim(target_type) = ''`);
  await pool.query(`ALTER TABLE user_favorites ALTER COLUMN target_type SET DEFAULT 'education'`);
  await pool.query(`ALTER TABLE user_favorites ALTER COLUMN target_type SET NOT NULL`);

  await pool.query(
    `ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES education_calendar(id) ON DELETE CASCADE`,
  );

  await pool.query(`ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_user_id_education_id_key`);

  await pool.query(`ALTER TABLE user_favorites ALTER COLUMN education_id DROP NOT NULL`);

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_education_unique ON user_favorites (user_id, education_id) WHERE target_type = 'education' AND education_id IS NOT NULL`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_calendar_unique ON user_favorites (user_id, calendar_id) WHERE target_type = 'calendar' AND calendar_id IS NOT NULL`,
  );
};

const migrateEducationReviewsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS education_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES normal_users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('education', 'calendar')),
      education_id UUID REFERENCES educations(id) ON DELETE CASCADE,
      calendar_id UUID REFERENCES education_calendar(id) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (target_type = 'education' AND education_id IS NOT NULL AND calendar_id IS NULL)
        OR (target_type = 'calendar' AND calendar_id IS NOT NULL AND education_id IS NULL)
      )
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_education_unique
      ON education_reviews (user_id, education_id) WHERE target_type = 'education'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_calendar_unique
      ON education_reviews (user_id, calendar_id) WHERE target_type = 'calendar'
  `);
};

const migrateEducationRatingAggregates = async () => {
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS rating_average NUMERIC(4,2)`);
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS rating_average NUMERIC(4,2)`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE OR REPLACE FUNCTION refresh_education_rating_aggregate(p_target TEXT, p_education_id UUID, p_calendar_id UUID)
    RETURNS VOID AS $$
    DECLARE
      v_cnt INT;
      v_avg NUMERIC(4,2);
    BEGIN
      IF p_target = 'education' AND p_education_id IS NOT NULL THEN
        SELECT COUNT(*)::INT, CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
        INTO v_cnt, v_avg
        FROM education_reviews
        WHERE target_type = 'education' AND education_id = p_education_id;
        UPDATE educations SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_education_id;
      ELSIF p_target = 'calendar' AND p_calendar_id IS NOT NULL THEN
        SELECT COUNT(*)::INT, CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
        INTO v_cnt, v_avg
        FROM education_reviews
        WHERE target_type = 'calendar' AND calendar_id = p_calendar_id;
        UPDATE education_calendar SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_calendar_id;
      END IF;
    END;
    $$ LANGUAGE plpgsql
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION education_reviews_aggregate_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        PERFORM refresh_education_rating_aggregate(OLD.target_type, OLD.education_id, OLD.calendar_id);
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.target_type IS DISTINCT FROM NEW.target_type
           OR OLD.education_id IS DISTINCT FROM NEW.education_id
           OR OLD.calendar_id IS DISTINCT FROM NEW.calendar_id THEN
          PERFORM refresh_education_rating_aggregate(OLD.target_type, OLD.education_id, OLD.calendar_id);
          PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
        ELSE
          PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
        END IF;
      ELSE
        PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql
  `);

  await pool.query(`DROP TRIGGER IF EXISTS education_reviews_refresh_aggregate_trg ON education_reviews`);
  await pool.query(`
    CREATE TRIGGER education_reviews_refresh_aggregate_trg
    AFTER INSERT OR UPDATE OR DELETE ON education_reviews
    FOR EACH ROW EXECUTE PROCEDURE education_reviews_aggregate_trigger()
  `);

  await pool.query(`
    UPDATE educations e
    SET rating_count = s.cnt, rating_average = s.avg
    FROM (
      SELECT education_id,
        COUNT(*)::INT AS cnt,
        ROUND(AVG(rating::NUMERIC), 2) AS avg
      FROM education_reviews
      WHERE target_type = 'education'
      GROUP BY education_id
    ) s
    WHERE e.id = s.education_id
  `);

  await pool.query(`
    UPDATE education_calendar ec
    SET rating_count = s.cnt, rating_average = s.avg
    FROM (
      SELECT calendar_id,
        COUNT(*)::INT AS cnt,
        ROUND(AVG(rating::NUMERIC), 2) AS avg
      FROM education_reviews
      WHERE target_type = 'calendar'
      GROUP BY calendar_id
    ) s
    WHERE ec.id = s.calendar_id
  `);
};

const migrateNormalUserDetails = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS normal_user_details (
    user_id UUID PRIMARY KEY REFERENCES normal_users(id) ON DELETE CASCADE,
    national_id VARCHAR(11),
    gender TEXT,
    user_type TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    country_code TEXT,
    city TEXT,
    district TEXT,
    postal_code VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
};

const migrateNormalUserDetailsAddressColumns = async () => {
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS address_line1 TEXT`);
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS address_line2 TEXT`);
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS country_code TEXT`);
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS city TEXT`);
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS district TEXT`);
  await pool.query(`ALTER TABLE normal_user_details ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32)`);
};

const migrateNormalUserDetailsNationalIdUnique = async () => {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS normal_user_details_national_id_key
    ON normal_user_details (national_id)
    WHERE national_id IS NOT NULL
  `);
};

const migrateExamQuestionBatchColumns = async () => {
  await pool.query(`ALTER TABLE exam_questions ALTER COLUMN question_text DROP NOT NULL`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS topic_doc_path TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS topic_doc_name TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS questions_doc_path TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS questions_doc_name TEXT`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS generated_questions JSONB`);
};

const migrateExamAttemptsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      education_id UUID REFERENCES educations(id) ON DELETE SET NULL,
      exam_question_id UUID REFERENCES exam_questions(id) ON DELETE SET NULL,
      education_code TEXT NOT NULL,
      national_id VARCHAR(32) NOT NULL,
      selected_questions JSONB NOT NULL,
      answers JSONB,
      correct_count INT NOT NULL DEFAULT 0,
      wrong_count INT NOT NULL DEFAULT 0,
      blank_count INT NOT NULL DEFAULT 0,
      score NUMERIC(5,2) NOT NULL DEFAULT 0,
      duration_seconds INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'started',
      submit_reason TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS exam_attempts_education_code_idx ON exam_attempts (education_code)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS exam_attempts_national_id_idx ON exam_attempts (national_id)`);
};

const EXAM_PORTAL_MAX_STARTS = 5;

const migrateExamPortalVisitTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_portal_visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal_url TEXT NOT NULL,
      education_code TEXT NOT NULL,
      national_id VARCHAR(11) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS exam_portal_visits_created_at_idx ON exam_portal_visits (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS exam_portal_visits_code_tc_idx ON exam_portal_visits (education_code, national_id)`);
};

const migrateExamPortalBestScoresTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_portal_best_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      education_code TEXT NOT NULL,
      national_id VARCHAR(11) NOT NULL,
      best_score NUMERIC(5,2) NOT NULL,
      best_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_score NUMERIC(5,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (education_code, national_id)
    )
  `);
  await pool.query(`ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS payment_received BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS exam_portal_best_scores_updated_idx ON exam_portal_best_scores (updated_at DESC)`);
};

const migrateExamPortalAccessPermissions = async () => {
  await pool.query(`
    INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
    SELECT r.id, 'examPortalAccess', p.can_view, FALSE, FALSE, p.can_delete
    FROM roles r
    INNER JOIN permissions p ON p.role_id = r.id AND p.module_name = 'examQuestions'
    ON CONFLICT (role_id, module_name) DO NOTHING
  `);
};

const migrateExamResultsPermissions = async () => {
  await pool.query(`
    INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
    SELECT r.id, 'examResults', p.can_view, FALSE, p.can_update, p.can_delete
    FROM roles r
    INNER JOIN permissions p ON p.role_id = r.id AND p.module_name = 'examQuestions'
    ON CONFLICT (role_id, module_name) DO NOTHING
  `);
  await pool.query(`
    UPDATE permissions e
    SET can_update = q.can_update
    FROM permissions q
    WHERE e.module_name = 'examResults'
      AND q.module_name = 'examQuestions'
      AND e.role_id = q.role_id
  `);
};

const migrateExamQuestionSettingsColumns = async () => {
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS exam_target_difficulty TEXT NOT NULL DEFAULT 'medium'`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS exam_question_count INT NOT NULL DEFAULT 20`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS pool_question_count INT NOT NULL DEFAULT 60`);
};

const migrateAdminMessagingTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      body TEXT NOT NULL CHECK (char_length(body) <= 16000),
      author_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_announcements_created_idx ON admin_announcements (created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_dm_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_low_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      user_high_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_low_id, user_high_id),
      CHECK (user_low_id < user_high_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_dm_threads_participant_idx ON admin_dm_threads (user_low_id, user_high_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_dm_threads_last_idx ON admin_dm_threads (last_message_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_dm_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID NOT NULL REFERENCES admin_dm_threads(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) <= 8000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_dm_messages_thread_time_idx ON admin_dm_messages (thread_id, created_at ASC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_chat_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 120),
      created_by_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_chat_group_members (
      group_id UUID NOT NULL REFERENCES admin_chat_groups(id) ON DELETE CASCADE,
      admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (group_id, admin_user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_chat_group_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL REFERENCES admin_chat_groups(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) <= 8000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_chat_group_messages_group_time_idx ON admin_chat_group_messages (group_id, created_at ASC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS admin_chat_groups_updated_idx ON admin_chat_groups (updated_at DESC)`);
};

const migrateAdminMessagingPermissions = async () => {
  await pool.query(`
    INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
    SELECT r.id, 'adminMessaging', d.can_view, FALSE, FALSE, FALSE
    FROM roles r
    INNER JOIN permissions d ON d.role_id = r.id AND d.module_name = 'dashboard'
    ON CONFLICT (role_id, module_name) DO NOTHING
  `);
};

const moduleConfig = {
  normalUsers: { table: "normal_users", actionKey: "normalUsers", searchable: ["first_name", "last_name", "email"] },
  adminUsers: { table: "admin_users", actionKey: "adminUsers", searchable: ["first_name", "last_name", "email", "phone"] },
  institutions: { table: "institutions", actionKey: "institutions", searchable: ["name", "code", "authorized_person"] },
  educationCategories: { table: "education_categories", actionKey: "educationCategories", searchable: ["category_code", "category_name"] },
  educations: { table: "educations", actionKey: "educations", searchable: ["name", "code", "description"] },
  approvedEducations: {
    table: "approved_educations",
    actionKey: "approvedEducations",
    searchable: ["code", "name"],
  },
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
  "approvedEducations",
  "educations",
  "instructors",
  "educationCalendar",
  "newsletter",
  "contactForms",
  "examQuestions",
  "examPortalAccess",
  "examResults",
  "activityLogs",
  "roles",
  "adminMessaging",
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
  exam_target_difficulty: "examTargetDifficulty",
  exam_question_count: "examQuestionCount",
  pool_question_count: "poolQuestionCount",
  admin_first_name: "adminFirstName",
  admin_last_name: "adminLastName",
  admin_email: "adminEmail",
  portal_url: "portalUrl",
  education_code: "educationCode",
  national_id: "nationalId",
  best_score: "bestScore",
  best_recorded_at: "bestRecordedAt",
  last_attempt_at: "lastAttemptAt",
  last_score: "lastScore",
  payment_received: "paymentReceived",
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

/** T.C. kimlik no: 11 hane, 0 ile başlamaz, 10. ve 11. haneler kontrol formülü */
const isValidTurkishNationalId = (digits11) => {
  if (typeof digits11 !== "string" || digits11.length !== 11 || !/^\d{11}$/.test(digits11)) return false;
  const d = digits11.split("").map((c) => Number(c));
  if (d[0] === 0) return false;
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  let check10 = (oddSum * 7 - evenSum) % 10;
  if (check10 < 0) check10 += 10;
  if (check10 !== d[9]) return false;
  const sumFirst10 = d.slice(0, 10).reduce((a, n) => a + n, 0) % 10;
  if (sumFirst10 !== d[10]) return false;
  return true;
};

const NORMAL_USER_GENDER_LABELS = { "1": "Kadın", "2": "Erkek", "3": "Belirtmek İstemiyorum" };
const NORMAL_USER_TYPE_LABELS = { bireysel: "Bireysel", kurumsal: "Kurumsal" };
/** Ülke seçimi (Hesap Ayarları ile aynı kodlar) */
const NORMAL_USER_COUNTRY_LABELS = {
  "215": "Türkiye",
  "13": "Australia",
  "38": "Canada",
  "81": "Germany",
  "222": "United Kingdom",
  "223": "United States",
};

const formatNormalUserMeResponse = (user, details) => {
  const g = details?.gender != null && details.gender !== "" ? String(details.gender) : "";
  const ut = details?.user_type || null;
  const cc = details?.country_code != null && details.country_code !== "" ? String(details.country_code) : "";
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    nationalId: details?.national_id ? String(details.national_id) : "",
    gender: g,
    genderLabel: g ? NORMAL_USER_GENDER_LABELS[g] || g : "Seçim yapılmadı",
    userType: ut ? NORMAL_USER_TYPE_LABELS[ut] || ut : "Belirtilmedi",
    customerType: ut === "kurumsal" ? "2" : "1",
    addressLine1: details?.address_line1 ? String(details.address_line1) : "",
    addressLine2: details?.address_line2 ? String(details.address_line2) : "",
    countryCode: cc,
    countryLabel: cc ? NORMAL_USER_COUNTRY_LABELS[cc] || cc : "",
    city: details?.city ? String(details.city) : "",
    district: details?.district ? String(details.district) : "",
    postalCode: details?.postal_code ? String(details.postal_code) : "",
  };
};

const formatRatingAggregateFields = (row) => {
  const ratingCount = Number(row.rating_count ?? 0) || 0;
  const rawAvg = row.rating_average;
  const ratingAverage = rawAvg != null && rawAvg !== "" ? Number(rawAvg) : null;
  const hasRating = ratingAverage != null && !Number.isNaN(ratingAverage) && ratingCount > 0;
  return {
    rating: hasRating ? ratingAverage.toFixed(1) : "",
    ratingAverage: hasRating ? ratingAverage : null,
    ratingCount,
  };
};

const formatPublicCourseInstructor = (row) => {
  const first = row.instructor_first_name ? String(row.instructor_first_name).trim() : "";
  const last = row.instructor_last_name ? String(row.instructor_last_name).trim() : "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  const info = row.instructor_info != null && row.instructor_info !== "" ? String(row.instructor_info).trim() : "";
  const about = row.instructor_about != null && row.instructor_about !== "" ? String(row.instructor_about).trim() : "";
  const hasStructuredInstructor = Boolean(row.instructor_id && full);
  return {
    instructorId: row.instructor_id || null,
    instructorName: full,
    instructorTitle: row.instructor_title != null && row.instructor_title !== "" ? String(row.instructor_title).trim() : "",
    instructorDepartment: row.instructor_department != null && row.instructor_department !== "" ? String(row.instructor_department).trim() : "",
    instructorAbout: about,
    instructorEmail: row.instructor_email != null && row.instructor_email !== "" ? String(row.instructor_email).trim().toLowerCase() : "",
    instructorLegacyInfo: !hasStructuredInstructor && info ? info : "",
  };
};

const formatPublicCourse = (row) => ({
  id: row.id,
  title: row.name || row.education_name || row.title || "Eğitim",
  categoryId: row.category_id || null,
  category: row.category_name || null,
  calendarDate: row.calendar_date || null,
  date: row.calendar_date
    ? new Date(row.calendar_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : null,
  mode: row.mode || "Uzaktan Eğitim",
  duration: row.duration || "Belirtilmedi",
  attendees: row.attendees || "Kontenjan Sınırı Yoktur ",
  image: row.image_url || "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282",
  description: row.description || "",
  contentDocPath: row.content_doc_path || "",
  contentHtml: row.content_html || "",
  code: row.code || "",
  sourceType: row.source_type || "education",
  institutionId: row.institution_id || null,
  institutionName: row.institution_name ? String(row.institution_name) : "",
  institutionLogo: row.institution_logo_url ? String(row.institution_logo_url) : "",
  institutionWebsite: row.institution_website_url ? String(row.institution_website_url) : "",
  ...formatRatingAggregateFields(row),
  ...formatPublicCourseInstructor(row),
});

const formatEducationReviewRow = (row) => {
  const first = String(row.first_name || "").trim();
  const last = String(row.last_name || "").trim();
  const initial = last.length ? `${last.charAt(0).toUpperCase()}.` : "";
  const authorLabel = [first, initial].filter(Boolean).join(" ").trim() || "Katılımcı";
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment || "",
    createdAt: row.created_at,
    authorLabel,
  };
};

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

/** Duyuru ve grup oluşturma: yalnızca Süper Admin ve Admin rolleri */
const isAdminMessagingLead = (req) => ["superadmin", "admin"].includes(req.user?.roleCode);

const isUuidParam = (value) => {
  const s = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

const EXAM_MCQ_OPTIONS = 5;
const EXAM_SECONDS_PER_QUESTION = 90;

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

const upsertExamPortalBestScore = async ({ educationCode, nationalId, attemptScore }) => {
  const code = String(educationCode || "").trim().toUpperCase();
  const tc = String(nationalId || "").trim();
  const newScore = Number(attemptScore);
  if (!/^[A-Z]{3}\d{7}$/.test(code) || !/^\d{11}$/.test(tc) || !Number.isFinite(newScore)) return;
  await pool.query(
    `INSERT INTO exam_portal_best_scores (education_code, national_id, best_score, best_recorded_at, last_attempt_at, last_score)
     VALUES ($1, $2, $3, NOW(), NOW(), $3)
     ON CONFLICT (education_code, national_id) DO UPDATE SET
       best_score = GREATEST(exam_portal_best_scores.best_score, EXCLUDED.last_score),
       best_recorded_at = CASE
         WHEN EXCLUDED.last_score > exam_portal_best_scores.best_score THEN NOW()
         ELSE exam_portal_best_scores.best_recorded_at
       END,
       last_attempt_at = NOW(),
       last_score = EXCLUDED.last_score,
       updated_at = NOW()`,
    [code, tc, newScore],
  );
};

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
      parsedQuestions.length >= 3
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

/** Oturumdaki yöneticinin kendi ad, soyad, e-posta ve isteğe bağlı şifre güncellemesi */
app.patch("/api/auth/admin/me", auth, async (req, res, next) => {
  try {
    if (req.user.userType === "normalUser" || !req.user.id || !req.user.roleId) {
      return res.status(403).json({ message: "Bu islem yonetici oturumu gerektirir." });
    }
    const { firstName, lastName, email, currentPassword, newPassword } = req.body || {};
    const fn = String(firstName ?? "").trim();
    const ln = String(lastName ?? "").trim();
    const em = String(email ?? "").trim().toLowerCase();
    if (!fn || !ln || !em) {
      return res.status(400).json({ message: "Ad, soyad ve e-posta zorunludur." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ message: "Gecerli bir e-posta giriniz." });
    }
    const existing = await pool.query(
      `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash, a.role_id
       FROM admin_users a
       WHERE a.id = $1 AND a.is_active = TRUE
       LIMIT 1`,
      [req.user.id],
    );
    const u = existing.rows[0];
    if (!u) return res.status(404).json({ message: "Hesap bulunamadi." });

    const emailChanged = em !== String(u.email || "").trim().toLowerCase();
    const np = newPassword != null ? String(newPassword) : "";
    const passwordChanging = np.length > 0;
    if (passwordChanging && np.length < 6) {
      return res.status(400).json({ message: "Yeni sifre en az 6 karakter olmalidir." });
    }

    if (emailChanged || passwordChanging) {
      const curPw = String(currentPassword || "");
      if (!curPw || !(await bcrypt.compare(curPw, u.password_hash))) {
        return res.status(400).json({ message: "E-posta veya sifre degisikligi icin mevcut sifrenizi dogru giriniz." });
      }
    }

    if (emailChanged) {
      const clash = await pool.query(
        `SELECT id FROM admin_users WHERE LOWER(TRIM(email)) = LOWER($1) AND id <> $2 LIMIT 1`,
        [em, req.user.id],
      );
      if (clash.rows[0]) return res.status(400).json({ message: "Bu e-posta adresi baska bir hesapta kullaniliyor." });
    }

    const newHash = passwordChanging ? await bcrypt.hash(np, 10) : u.password_hash;
    const upd = await pool.query(
      `UPDATE admin_users SET first_name = $1, last_name = $2, email = $3, password_hash = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, first_name, last_name, email, role_id`,
      [fn, ln, em, newHash, req.user.id],
    );
    const row = upd.rows[0];
    const roleRow = await pool.query(`SELECT code, name FROM roles WHERE id = $1 LIMIT 1`, [row.role_id]);
    const rc = roleRow.rows[0]?.code || req.user.roleCode;
    const rn = roleRow.rows[0]?.name || "";

    await writeActivityLog({
      req,
      action: "update",
      moduleName: "adminUsers",
      entityId: row.id,
      oldData: {
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        emailChanged,
        passwordChanged: passwordChanging,
      },
      newData: { email: row.email, firstName: row.first_name, lastName: row.last_name },
    });

    const newToken = jwt.sign({ id: row.id, roleId: row.role_id, roleCode: rc }, jwtSecret, { expiresIn: "12h" });
    return res.json({
      token: newToken,
      user: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        roleId: row.role_id,
        roleCode: rc,
        roleName: rn,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, nationalId } = req.body || {};
    const tcEmpty =
      nationalId === undefined || nationalId === null || String(nationalId).replace(/\D/g, "").length === 0;
    if (!firstName || !lastName || !email || !password || tcEmpty) {
      return res.status(400).json({ message: "Ad, soyad, e-posta, şifre ve T.C. kimlik numarası zorunludur." });
    }

    const digits = String(nationalId).replace(/\D/g, "");
    if (digits.length !== 11) {
      return res.status(400).json({ message: "T.C. kimlik numarası 11 haneli olmalıdır." });
    }
    if (!isValidTurkishNationalId(digits)) {
      return res.status(400).json({ message: "Geçerli bir T.C. kimlik numarası giriniz." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO normal_users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, first_name, last_name, email, created_at, updated_at`,
        [String(firstName).trim(), String(lastName).trim(), String(email).trim().toLowerCase(), passwordHash],
      );
      const user = result.rows[0];
      await client.query(
        `INSERT INTO normal_user_details (user_id, national_id, updated_at) VALUES ($1, $2, NOW())`,
        [user.id, digits],
      );
      await client.query("COMMIT");

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
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505") {
        const detail = String(err.detail || "").toLowerCase();
        const c = String(err.constraint || "").toLowerCase();
        const isNational =
          detail.includes("national_id") || c.includes("national_id") || c.includes("national");
        if (isNational) {
          return res.status(409).json({ message: "Bu T.C. kimlik numarası ile zaten kayıt bulunmaktadır." });
        }
        return res.status(409).json({ message: "Bu e-posta ile daha önce kayıt olunmuş." });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
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
      `SELECT u.id, u.first_name, u.last_name, u.email,
              d.national_id, d.gender, d.user_type,
              d.address_line1, d.address_line2, d.country_code, d.city, d.district, d.postal_code
       FROM normal_users u
       LEFT JOIN normal_user_details d ON d.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [req.user.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    const user = { id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email };
    const details = {
      national_id: row.national_id,
      gender: row.gender,
      user_type: row.user_type,
      address_line1: row.address_line1,
      address_line2: row.address_line2,
      country_code: row.country_code,
      city: row.city,
      district: row.district,
      postal_code: row.postal_code,
    };
    return res.json(formatNormalUserMeResponse(user, details));
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/users/me", userAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      email,
      nationalId,
      gender,
      customerType,
      addressLine1,
      addressLine2,
      countryCode,
      city,
      district,
      postalCode,
    } = body;

    const curUserResult = await pool.query(
      `SELECT id, first_name, last_name, email FROM normal_users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const curUser = curUserResult.rows[0];
    if (!curUser) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!nextEmail) {
        return res.status(400).json({ message: "E-posta boş olamaz." });
      }
      if (nextEmail !== curUser.email) {
        const dup = await pool.query(`SELECT 1 FROM normal_users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`, [
          nextEmail,
          userId,
        ]);
        if (dup.rows[0]) {
          return res.status(409).json({ message: "Bu e-posta adresi başka bir hesapta kullanılıyor." });
        }
      }
    }

    if (firstName !== undefined && !String(firstName).trim()) {
      return res.status(400).json({ message: "Ad boş olamaz." });
    }
    if (lastName !== undefined && !String(lastName).trim()) {
      return res.status(400).json({ message: "Soyad boş olamaz." });
    }

    const userUpdates = [];
    const userVals = [];
    if (firstName !== undefined) {
      userVals.push(String(firstName).trim());
      userUpdates.push(`first_name = $${userVals.length}`);
    }
    if (lastName !== undefined) {
      userVals.push(String(lastName).trim());
      userUpdates.push(`last_name = $${userVals.length}`);
    }
    if (email !== undefined) {
      userVals.push(String(email).trim().toLowerCase());
      userUpdates.push(`email = $${userVals.length}`);
    }
    if (userUpdates.length) {
      userVals.push(userId);
      await pool.query(
        `UPDATE normal_users SET ${userUpdates.join(", ")}, updated_at = NOW() WHERE id = $${userVals.length}`,
        userVals,
      );
    }

    const detailKey = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const hasDetailPatch =
      detailKey("nationalId") ||
      detailKey("gender") ||
      detailKey("customerType") ||
      detailKey("addressLine1") ||
      detailKey("addressLine2") ||
      detailKey("countryCode") ||
      detailKey("city") ||
      detailKey("district") ||
      detailKey("postalCode");

    if (hasDetailPatch) {
      const detRes = await pool.query(
        `SELECT national_id, gender, user_type, address_line1, address_line2, country_code, city, district, postal_code
         FROM normal_user_details WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const curDet = detRes.rows[0];
      let nextNational = curDet?.national_id ?? null;
      let nextGender = curDet?.gender ?? null;
      let nextUserType = curDet?.user_type ?? null;
      let nextAddr1 = curDet?.address_line1 ?? null;
      let nextAddr2 = curDet?.address_line2 ?? null;
      let nextCountry = curDet?.country_code ?? null;
      let nextCity = curDet?.city ?? null;
      let nextDistrict = curDet?.district ?? null;
      let nextPostal = curDet?.postal_code ?? null;

      if (detailKey("nationalId")) {
        const raw = nationalId === null || nationalId === undefined ? "" : String(nationalId).replace(/\D/g, "");
        if (raw && raw.length !== 11) {
          return res.status(400).json({ message: "T.C. kimlik numarası 11 haneli olmalıdır." });
        }
        nextNational = raw || null;
      }

      if (detailKey("gender")) {
        const gv =
          gender === null || gender === undefined || gender === "" ? null : String(gender);
        if (gv && !["1", "2", "3"].includes(gv)) {
          return res.status(400).json({ message: "Geçersiz cinsiyet seçimi." });
        }
        nextGender = gv;
      }

      if (detailKey("customerType")) {
        const ct = String(customerType);
        if (!["1", "2"].includes(ct)) {
          return res.status(400).json({ message: "Geçersiz kullanıcı tipi." });
        }
        nextUserType = ct === "2" ? "kurumsal" : "bireysel";
      }

      const trimOrNull = (v, maxLen) => {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (!s) return null;
        return maxLen ? s.slice(0, maxLen) : s;
      };

      if (detailKey("addressLine1")) {
        const v = trimOrNull(addressLine1, 500);
        if (!v) {
          return res.status(400).json({ message: "Adres satırı zorunludur." });
        }
        nextAddr1 = v;
      }

      if (detailKey("addressLine2")) {
        nextAddr2 = trimOrNull(addressLine2, 500);
      }

      if (detailKey("countryCode")) {
        const raw = countryCode === null || countryCode === undefined ? "" : String(countryCode).trim();
        if (!raw) {
          return res.status(400).json({ message: "Ülke seçimi zorunludur." });
        }
        nextCountry = raw.slice(0, 16);
      }

      if (detailKey("city")) {
        const v = trimOrNull(city, 120);
        if (!v) {
          return res.status(400).json({ message: "Şehir zorunludur." });
        }
        nextCity = v;
      }

      if (detailKey("district")) {
        const v = trimOrNull(district, 120);
        if (!v) {
          return res.status(400).json({ message: "İlçe / bölge zorunludur." });
        }
        nextDistrict = v;
      }

      if (detailKey("postalCode")) {
        const v = trimOrNull(postalCode, 32);
        if (!v) {
          return res.status(400).json({ message: "Posta kodu zorunludur." });
        }
        nextPostal = v;
      }

      await pool.query(
        `INSERT INTO normal_user_details (
           user_id, national_id, gender, user_type,
           address_line1, address_line2, country_code, city, district, postal_code,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           national_id = EXCLUDED.national_id,
           gender = EXCLUDED.gender,
           user_type = EXCLUDED.user_type,
           address_line1 = EXCLUDED.address_line1,
           address_line2 = EXCLUDED.address_line2,
           country_code = EXCLUDED.country_code,
           city = EXCLUDED.city,
           district = EXCLUDED.district,
           postal_code = EXCLUDED.postal_code,
           updated_at = NOW()`,
        [
          userId,
          nextNational,
          nextGender,
          nextUserType,
          nextAddr1,
          nextAddr2,
          nextCountry,
          nextCity,
          nextDistrict,
          nextPostal,
        ],
      );
    }

    const fresh = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              d.national_id, d.gender, d.user_type,
              d.address_line1, d.address_line2, d.country_code, d.city, d.district, d.postal_code
       FROM normal_users u
       LEFT JOIN normal_user_details d ON d.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    );
    const r = fresh.rows[0];
    const userOut = { id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email };
    const detailsOut = {
      national_id: r.national_id,
      gender: r.gender,
      user_type: r.user_type,
      address_line1: r.address_line1,
      address_line2: r.address_line2,
      country_code: r.country_code,
      city: r.city,
      district: r.district,
      postal_code: r.postal_code,
    };
    return res.json(formatNormalUserMeResponse(userOut, detailsOut));
  } catch (error) {
    return next(error);
  }
});

app.get("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT f.created_at AS sort_date, e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.category_id, c.category_name, NULL::timestamptz AS calendar_date, f.target_type AS source_type, e.rating_average, e.rating_count, e.institution_id, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url
       FROM user_favorites f
       INNER JOIN educations e ON f.target_type = 'education' AND e.id = f.education_id
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       WHERE f.user_id = $1
       UNION ALL
       SELECT f.created_at, ec.id, ec.education_name AS name, ec.description, ec.image_url, ec.code, ec.duration, ec.content_doc_path, ec.category_id, c2.category_name, ec.calendar_date, f.target_type AS source_type, ec.rating_average, ec.rating_count, ec.institution_id, inst2.name AS institution_name, inst2.logo_url AS institution_logo_url, inst2.website_url AS institution_website_url
       FROM user_favorites f
       INNER JOIN education_calendar ec ON f.target_type = 'calendar' AND ec.id = f.calendar_id
       LEFT JOIN education_categories c2 ON c2.id = ec.category_id
       LEFT JOIN institutions inst2 ON inst2.id = ec.institution_id
       WHERE f.user_id = $1
       ORDER BY sort_date DESC`,
      [req.user.id],
    );
    const rowsWithContent = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        content_html: await extractEducationContentHtml(row.content_doc_path),
      })),
    );
    return res.json(rowsWithContent.map((row) => formatPublicCourse(row)));
  } catch (error) {
    return next(error);
  }
});

app.post("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const { educationId, calendarId } = req.body || {};
    const hasE = Boolean(educationId);
    const hasC = Boolean(calendarId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId gönderin." });
    }
    if (educationId) {
      const education = await pool.query(`SELECT id FROM educations WHERE id = $1 LIMIT 1`, [educationId]);
      if (!education.rows[0]) {
        return res.status(404).json({ message: "Eğitim bulunamadı." });
      }
      await pool.query(
        `INSERT INTO user_favorites (user_id, target_type, education_id, calendar_id)
         SELECT $1, 'education', $2, NULL
         WHERE NOT EXISTS (
           SELECT 1 FROM user_favorites WHERE user_id = $1 AND target_type = 'education' AND education_id = $2
         )`,
        [req.user.id, educationId],
      );
    } else {
      const cal = await pool.query(`SELECT id FROM education_calendar WHERE id = $1 LIMIT 1`, [calendarId]);
      if (!cal.rows[0]) {
        return res.status(404).json({ message: "Takvim kaydı bulunamadı." });
      }
      await pool.query(
        `INSERT INTO user_favorites (user_id, target_type, education_id, calendar_id)
         SELECT $1, 'calendar', NULL, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM user_favorites WHERE user_id = $1 AND target_type = 'calendar' AND calendar_id = $2
         )`,
        [req.user.id, calendarId],
      );
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/users/favorites", userAuth, async (req, res, next) => {
  try {
    const educationId = String(req.query.educationId || "").trim();
    const calendarId = String(req.query.calendarId || "").trim();
    if (Boolean(educationId) === Boolean(calendarId)) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId query parametresi gönderin." });
    }
    if (educationId) {
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND target_type = 'education' AND education_id = $2`,
        [req.user.id, educationId],
      );
    } else {
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND target_type = 'calendar' AND calendar_id = $2`,
        [req.user.id, calendarId],
      );
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.post("/api/users/education-reviews", userAuth, async (req, res, next) => {
  try {
    const { educationId, calendarId, rating: rawRating, comment: rawComment } = req.body || {};
    const eId = String(educationId || "").trim();
    const cId = String(calendarId || "").trim();
    const hasE = Boolean(eId);
    const hasC = Boolean(cId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId gönderin." });
    }

    let rating = Number(rawRating);
    if (!Number.isFinite(rating)) rating = 5;
    rating = Math.min(5, Math.max(1, Math.round(rating)));

    const commentText = rawComment != null ? String(rawComment).trim() : "";
    const comment = commentText.length ? commentText.slice(0, 4000) : null;

    let result;
    if (eId) {
      const education = await pool.query(`SELECT id FROM educations WHERE id = $1 LIMIT 1`, [eId]);
      if (!education.rows[0]) {
        return res.status(404).json({ message: "Eğitim bulunamadı." });
      }
      result = await pool.query(
        `INSERT INTO education_reviews (user_id, target_type, education_id, calendar_id, rating, comment)
         VALUES ($1, 'education', $2, NULL, $3, $4)
         ON CONFLICT (user_id, education_id) WHERE target_type = 'education'
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
         RETURNING id, rating, comment, created_at`,
        [req.user.id, eId, rating, comment],
      );
    } else {
      const cal = await pool.query(`SELECT id FROM education_calendar WHERE id = $1 LIMIT 1`, [cId]);
      if (!cal.rows[0]) {
        return res.status(404).json({ message: "Takvim kaydı bulunamadı." });
      }
      result = await pool.query(
        `INSERT INTO education_reviews (user_id, target_type, education_id, calendar_id, rating, comment)
         VALUES ($1, 'calendar', NULL, $2, $3, $4)
         ON CONFLICT (user_id, calendar_id) WHERE target_type = 'calendar'
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
         RETURNING id, rating, comment, created_at`,
        [req.user.id, cId, rating, comment],
      );
    }

    const userRow = await pool.query(`SELECT first_name, last_name FROM normal_users WHERE id = $1 LIMIT 1`, [
      req.user.id,
    ]);
    const aggRow = eId
      ? (await pool.query(`SELECT rating_average, rating_count FROM educations WHERE id = $1 LIMIT 1`, [eId])).rows[0]
      : (await pool.query(`SELECT rating_average, rating_count FROM education_calendar WHERE id = $1 LIMIT 1`, [cId]))
          .rows[0];
    return res.status(200).json({
      ok: true,
      review: formatEducationReviewRow({ ...result.rows[0], ...userRow.rows[0] }),
      ...formatRatingAggregateFields(aggRow || {}),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/contact-forms", async (req, res, next) => {
  try {
    const { fullName, email, phone, subject, message, recaptchaToken } = req.body || {};
    if (!fullName || !email || !message) {
      return res.status(400).json({ message: "Ad soyad, e-posta ve mesaj alanları zorunludur." });
    }

    const captcha = await verifyRecaptchaV2IfConfigured(recaptchaToken);
    if (!captcha.ok) {
      return res.status(400).json({ message: captcha.message });
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

app.get("/api/public/education-reviews", async (req, res, next) => {
  try {
    const educationId = String(req.query.educationId || "").trim();
    const calendarId = String(req.query.calendarId || "").trim();
    const hasE = Boolean(educationId);
    const hasC = Boolean(calendarId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId query parametresi gönderin." });
    }

    let result;
    if (educationId) {
      result = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
         FROM education_reviews r
         INNER JOIN normal_users u ON u.id = r.user_id
         WHERE r.target_type = 'education' AND r.education_id = $1
         ORDER BY r.created_at DESC`,
        [educationId],
      );
    } else {
      result = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
         FROM education_reviews r
         INNER JOIN normal_users u ON u.id = r.user_id
         WHERE r.target_type = 'calendar' AND r.calendar_id = $1
         ORDER BY r.created_at DESC`,
        [calendarId],
      );
    }

    return res.json({ reviews: result.rows.map(formatEducationReviewRow) });
  } catch (error) {
    return next(error);
  }
});

const escapeIlikePattern = (raw) =>
  String(raw || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

/** Eğitim kataloğu + takvim başlıklarında büyük/küçük harf duyarsız arama */
app.get("/api/public/search/trainings", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.json({ results: [] });
    }
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 20)));
    const pattern = `%${escapeIlikePattern(q)}%`;
    const [edu, cal] = await Promise.all([
      pool.query(
        `SELECT e.id, e.name, e.image_url, e.category_id, 'education'::text AS source_type
         FROM educations e
         WHERE e.name ILIKE $1 ESCAPE '\\'
         ORDER BY e.name ASC
         LIMIT $2`,
        [pattern, limit],
      ),
      pool.query(
        `SELECT ec.id, ec.education_name AS name, ec.image_url, ec.category_id, 'calendar'::text AS source_type
         FROM education_calendar ec
         WHERE ec.education_name ILIKE $1 ESCAPE '\\'
         ORDER BY ec.education_name ASC
         LIMIT $2`,
        [pattern, limit],
      ),
    ]);
    const mapRow = (row) => ({
      id: row.id,
      title: row.name,
      image: row.image_url || null,
      sourceType: row.source_type,
      categoryId: row.category_id,
    });
    const combined = [...edu.rows.map(mapRow), ...cal.rows.map(mapRow)];
    combined.sort((a, b) => String(a.title).localeCompare(String(b.title), "tr", { sensitivity: "base" }));
    return res.json({ results: combined.slice(0, limit) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/exam-portal/visit", async (req, res, next) => {
  try {
    const portalUrl = String(req.body?.portalUrl || "").trim().slice(0, 2048);
    const educationCode = String(req.body?.educationCode || "").trim().toUpperCase();
    const nationalId = String(req.body?.nationalId || "").trim();
    if (!/^[A-Z]{3}\d{7}$/.test(educationCode)) {
      return res.status(400).json({ message: "Geçerli eğitim kodu gerekli." });
    }
    if (!/^\d{11}$/.test(nationalId)) {
      return res.status(400).json({ message: "T.C. kimlik no 11 haneli olmalıdır." });
    }
    const safeUrl = portalUrl.length ? portalUrl : `/sinavportali/${educationCode}/${nationalId}`;
    const insert = await pool.query(
      `INSERT INTO exam_portal_visits (portal_url, education_code, national_id) VALUES ($1, $2, $3) RETURNING id, portal_url, education_code, national_id, created_at`,
      [safeUrl, educationCode, nationalId],
    );
    return res.status(201).json(toApiObject(insert.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/exam-portal/start", async (req, res, next) => {
  try {
    const educationCode = String(req.body?.educationCode || "").trim().toUpperCase();
    const nationalId = String(req.body?.nationalId || "").trim();
    if (!/^[A-Z]{3}\d{7}$/.test(educationCode)) {
      return res.status(400).json({ message: "Geçerli eğitim kodu gerekli." });
    }
    if (!/^\d{11}$/.test(nationalId)) {
      return res.status(400).json({ message: "T.C. kimlik no 11 haneli olmalıdır." });
    }

    const attemptsCheck = await pool.query(
      `SELECT COUNT(*)::int AS c FROM exam_attempts WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2`,
      [educationCode, nationalId],
    );
    if (Number(attemptsCheck.rows[0]?.c || 0) >= EXAM_PORTAL_MAX_STARTS) {
      return res.status(403).json({
        message: `Bu eğitim (${educationCode}) için sınav başlatma hakkınız doldu (en fazla ${EXAM_PORTAL_MAX_STARTS} oturum).`,
      });
    }

    const educationResult = await pool.query(
      `SELECT id, name, code, duration
       FROM educations
       WHERE UPPER(code) = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [educationCode],
    );
    const education = educationResult.rows[0];
    if (!education) {
      return res.status(404).json({ message: "Bu eğitim kodu ile eğitim bulunamadı." });
    }

    const questionResult = await pool.query(
      `SELECT eq.id, eq.generated_questions, eq.exam_target_difficulty, eq.exam_question_count, eq.pool_question_count,
              eq.updated_at, e.id AS education_id, e.name AS education_name, e.code AS education_code, e.duration AS education_duration
       FROM exam_questions eq
       INNER JOIN educations e ON e.id = eq.education_id
       WHERE UPPER(e.code) = $1
         AND eq.generated_questions IS NOT NULL
       ORDER BY eq.updated_at DESC, e.updated_at DESC
       LIMIT 1`,
      [educationCode],
    );
    const questionSet = questionResult.rows[0];
    if (!questionSet?.generated_questions) {
      return res.status(404).json({ message: "Bu eğitim için sınav soruları henüz hazırlanmamış." });
    }
    const effectiveEducation = {
      id: questionSet.education_id || education.id,
      name: questionSet.education_name || education.name,
      code: questionSet.education_code || education.code,
      duration: questionSet.education_duration || education.duration,
    };

    const poolQuestions = normalizeExamQuestionPool(questionSet.generated_questions);
    const targetDifficulty = String(questionSet.exam_target_difficulty || "medium").toLowerCase();
    const difficultyKey = ["easy", "medium", "hard"].includes(targetDifficulty) ? targetDifficulty : "medium";
    const examQuestionCount = Math.min(200, Math.max(1, parseInt(questionSet.exam_question_count, 10) || 20));
    const bucket = poolQuestions[difficultyKey] || [];
    if (bucket.length < examQuestionCount) {
      return res.status(400).json({
        message: `Bu zorluk seviyesi (${difficultyKey}) için havuzda yeterli soru yok (${bucket.length}/${examQuestionCount}).`,
      });
    }

    const selectedQuestions = pickExamQuestions(poolQuestions, difficultyKey, examQuestionCount);
    const durationSeconds = selectedQuestions.length * EXAM_SECONDS_PER_QUESTION;
    const attemptResult = await pool.query(
      `INSERT INTO exam_attempts
        (education_id, exam_question_id, education_code, national_id, selected_questions)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, started_at`,
      [effectiveEducation.id, questionSet.id, educationCode, nationalId, JSON.stringify(selectedQuestions)],
    );
    const attempt = attemptResult.rows[0];

    return res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      durationSeconds,
      education: {
        id: effectiveEducation.id,
        code: effectiveEducation.code,
        title: effectiveEducation.name,
        duration: effectiveEducation.duration || "",
      },
      questionCount: selectedQuestions.length,
      questions: selectedQuestions.map(publicExamQuestion),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/exam-portal/:attemptId/submit", async (req, res, next) => {
  try {
    const attemptId = String(req.params.attemptId || "").trim();
    const reason = String(req.body?.reason || "manual").trim().slice(0, 64) || "manual";
    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    const previousResult = await pool.query(
      `SELECT id, education_code, national_id, selected_questions, started_at, status, correct_count, wrong_count, blank_count, score, duration_seconds
       FROM exam_attempts
       WHERE id = $1
       LIMIT 1`,
      [attemptId],
    );
    const previous = previousResult.rows[0];
    if (!previous) return res.status(404).json({ message: "Sınav oturumu bulunamadı." });
    if (previous.status === "completed") {
      return res.json({
        attemptId: previous.id,
        status: previous.status,
        correctCount: previous.correct_count,
        wrongCount: previous.wrong_count,
        blankCount: previous.blank_count,
        score: Number(previous.score),
        durationSeconds: previous.duration_seconds,
      });
    }

    const selectedQuestions = typeof previous.selected_questions === "string"
      ? JSON.parse(previous.selected_questions)
      : previous.selected_questions;
    const graded = gradeExamAttempt(Array.isArray(selectedQuestions) ? selectedQuestions : [], answers);
    const startedAt = new Date(previous.started_at).getTime();
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    const qCount = Array.isArray(selectedQuestions) ? selectedQuestions.length : 0;
    const maxAllowedSeconds = Math.max(EXAM_SECONDS_PER_QUESTION, qCount * EXAM_SECONDS_PER_QUESTION);
    const durationSeconds = Math.min(maxAllowedSeconds, elapsed);
    const result = await pool.query(
      `UPDATE exam_attempts
       SET answers = $2::jsonb,
           correct_count = $3,
           wrong_count = $4,
           blank_count = $5,
           score = $6,
           duration_seconds = $7,
           status = 'completed',
           submit_reason = $8,
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, correct_count, wrong_count, blank_count, score, duration_seconds, submitted_at`,
      [
        attemptId,
        JSON.stringify(graded.normalizedAnswers),
        graded.correctCount,
        graded.wrongCount,
        graded.blankCount,
        graded.score,
        durationSeconds,
        reason,
      ],
    );
    const row = result.rows[0];
    await upsertExamPortalBestScore({
      educationCode: previous.education_code,
      nationalId: previous.national_id,
      attemptScore: graded.score,
    });
    return res.json({
      attemptId: row.id,
      status: row.status,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      blankCount: row.blank_count,
      score: Number(row.score),
      durationSeconds: row.duration_seconds,
      submittedAt: row.submitted_at,
    });
  } catch (error) {
    next(error);
  }
});

/** Tüm Eğitimler sayfası: yalnızca `educations`, sayfalı; kategori, arama, sıralama sunucuda */
app.get("/api/public/educations", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 9)));
    const searchRaw = String(req.query.search || "").trim();
    const sortRaw = String(req.query.sort || "newest").toLowerCase();
    const sort =
      sortRaw === "oldest" ? "oldest" : sortRaw === "rating" || sortRaw === "degerlendirme" ? "rating" : "newest";

    const catRaw = req.query.category;
    const categoryList = (Array.isArray(catRaw) ? catRaw : catRaw != null && catRaw !== "" ? [catRaw] : [])
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean);

    const params = [];
    const conditions = [];

    if (searchRaw) {
      params.push(`%${escapeIlikePattern(searchRaw)}%`);
      conditions.push(`e.name ILIKE $${params.length} ESCAPE '\\'`);
    }

    if (categoryList.length) {
      params.push(categoryList);
      conditions.push(`LOWER(TRIM(COALESCE(c.category_name, ''))) = ANY($${params.length}::text[])`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderSql =
      sort === "oldest"
        ? `e.created_at ASC`
        : sort === "rating"
          ? `e.rating_average DESC NULLS LAST, e.rating_count DESC, e.created_at DESC`
          : `e.created_at DESC`;

    const offset = (page - 1) * pageSize;

    const baseCountSql = `SELECT COUNT(*)::int AS total
      FROM educations e
      LEFT JOIN education_categories c ON c.id = e.category_id
      ${whereSql}`;

    const listSql = `SELECT e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
          ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email,
          NULL::text AS instructor_info
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [countResult, listResult, categoryRows] = await Promise.all([
      pool.query(baseCountSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
      pool.query(`SELECT id, category_name FROM education_categories ORDER BY category_name ASC`),
    ]);

    const rowsWithEmptyContent = listResult.rows.map((row) => ({ ...row, content_html: "" }));
    const data = rowsWithEmptyContent.map((row) => formatPublicCourse(row));
    const categories = [
      { id: "", name: "Tüm Eğitimler" },
      ...categoryRows.rows.map((row) => ({ id: row.id, name: row.category_name })),
    ];
    const total = countResult.rows[0]?.total || 0;

    return res.json({
      categories,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/courses", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 6)));
    const sort = String(req.query.sort || "oldest").toLowerCase() === "newest" ? "DESC" : "ASC";
    const categoryId = String(req.query.categoryId || "").trim();
    const category = String(req.query.category || "").trim().toLowerCase();
    const dateFrom = String(req.query.dateFrom || "").trim();
    const dateTo = String(req.query.dateTo || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();
    const calendarParams = [];
    const calendarConditions = [];

    if (categoryId) {
      calendarParams.push(categoryId);
      calendarConditions.push(`ec.category_id = $${calendarParams.length}`);
    } else if (category) {
      calendarParams.push(category);
      calendarConditions.push(`LOWER(COALESCE(c.category_name, '')) = $${calendarParams.length}`);
    }

    if (dateFrom) {
      calendarParams.push(dateFrom);
      calendarConditions.push(`ec.calendar_date >= $${calendarParams.length}::timestamptz`);
    }

    if (dateTo) {
      calendarParams.push(dateTo);
      calendarConditions.push(`ec.calendar_date <= ($${calendarParams.length}::date + interval '1 day' - interval '1 second')`);
    }

    if (search) {
      calendarParams.push(`%${search}%`);
      calendarConditions.push(`LOWER(COALESCE(ec.education_name, '')) LIKE $${calendarParams.length}`);
    }

    const calendarWhere = calendarConditions.length ? `WHERE ${calendarConditions.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*)::int AS total
                      FROM education_calendar ec
                      LEFT JOIN education_categories c ON c.id = ec.category_id
                      ${calendarWhere}`;
    const listSql = `SELECT ec.id, ec.education_name, ec.description, ec.image_url, ec.code, ec.duration, ec.content_doc_path, ec.calendar_date, ec.category_id, ec.institution_id, ec.instructor_id, ec.instructor_info, ec.rating_average, ec.rating_count, c.category_name, 'calendar'::text AS source_type, inst.name AS institution_name, inst.logo_url AS institution_logo_url, inst.website_url AS institution_website_url,
                     ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email
                     FROM education_calendar ec
                     LEFT JOIN education_categories c ON c.id = ec.category_id
                     LEFT JOIN institutions inst ON inst.id = ec.institution_id
                     LEFT JOIN instructors ins ON ins.id = ec.instructor_id
                     ${calendarWhere}
                     ORDER BY ec.calendar_date ${sort}
                     LIMIT $${calendarParams.length + 1}
                     OFFSET $${calendarParams.length + 2}`;
    const offset = (page - 1) * pageSize;

    const [educations, calendarCount, calendar, categoryRows] = await Promise.all([
      pool.query(
        `SELECT e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
          ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email,
          NULL::text AS instructor_info
         FROM educations e
         LEFT JOIN education_categories c ON c.id = e.category_id
         LEFT JOIN institutions i ON i.id = e.institution_id
         LEFT JOIN instructors ins ON ins.id = e.instructor_id
         ORDER BY e.created_at DESC`,
      ),
      pool.query(countSql, calendarParams),
      pool.query(listSql, [...calendarParams, pageSize, offset]),
      pool.query(`SELECT id, category_name FROM education_categories ORDER BY category_name ASC`),
    ]);

    const educationRowsWithContent = await Promise.all(
      educations.rows.map(async (row) => ({
        ...row,
        content_html: await extractEducationContentHtml(row.content_doc_path),
      })),
    );
    const calendarRowsWithContent = await Promise.all(
      calendar.rows.map(async (row) => ({
        ...row,
        content_html: await extractEducationContentHtml(row.content_doc_path),
      })),
    );
    const educationItems = educationRowsWithContent.map((row) => formatPublicCourse(row));
    let calendarItems = calendarRowsWithContent.map((row) => formatPublicCourse(row));
    const categories = [
      { id: "", name: "Tüm Eğitimler" },
      ...categoryRows.rows.map((row) => ({ id: row.id, name: row.category_name })),
    ];
    let total = calendarCount.rows[0]?.total || 0;
    if (total === 0) {
      const fallbackParams = [];
      const fallbackConditions = [];

      if (categoryId) {
        fallbackParams.push(categoryId);
        fallbackConditions.push(`e.category_id = $${fallbackParams.length}`);
      } else if (category) {
        fallbackParams.push(category);
        fallbackConditions.push(`LOWER(COALESCE(c.category_name, '')) = $${fallbackParams.length}`);
      }

      if (dateFrom) {
        fallbackParams.push(dateFrom);
        fallbackConditions.push(`e.created_at >= $${fallbackParams.length}::timestamptz`);
      }

      if (dateTo) {
        fallbackParams.push(dateTo);
        fallbackConditions.push(`e.created_at <= ($${fallbackParams.length}::date + interval '1 day' - interval '1 second')`);
      }

      if (search) {
        fallbackParams.push(`%${search}%`);
        fallbackConditions.push(`LOWER(COALESCE(e.name, '')) LIKE $${fallbackParams.length}`);
      }

      const fallbackWhere = fallbackConditions.length ? `WHERE ${fallbackConditions.join(" AND ")}` : "";
      const fallbackCountSql = `SELECT COUNT(*)::int AS total
                                FROM educations e
                                LEFT JOIN education_categories c ON c.id = e.category_id
                                ${fallbackWhere}`;
      const fallbackListSql = `SELECT e.id, e.name AS education_name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.created_at AS calendar_date, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
                               ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email,
                               NULL::text AS instructor_info
                               FROM educations e
                               LEFT JOIN education_categories c ON c.id = e.category_id
                               LEFT JOIN institutions i ON i.id = e.institution_id
                               LEFT JOIN instructors ins ON ins.id = e.instructor_id
                               ${fallbackWhere}
                               ORDER BY e.created_at ${sort}
                               LIMIT $${fallbackParams.length + 1}
                               OFFSET $${fallbackParams.length + 2}`;
      const [fallbackCount, fallbackList] = await Promise.all([
        pool.query(fallbackCountSql, fallbackParams),
        pool.query(fallbackListSql, [...fallbackParams, pageSize, offset]),
      ]);
      total = fallbackCount.rows[0]?.total || 0;
      const fallbackRowsWithContent = await Promise.all(
        fallbackList.rows.map(async (row) => ({
          ...row,
          content_html: await extractEducationContentHtml(row.content_doc_path),
        })),
      );
      calendarItems = fallbackRowsWithContent.map((row) => formatPublicCourse(row));
    }

    const allItems = [...educationItems, ...calendarItems];

    return res.json({
      categories,
      educations: educationItems,
      educationCalendar: calendarItems,
      courses: allItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
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
    const targetDifficulty = String(req.body?.targetDifficulty || "medium").toLowerCase();
    if (!["easy", "medium", "hard"].includes(targetDifficulty)) {
      return res.status(400).json({ message: "Zorluk kolay, orta veya zor olmalıdır." });
    }
    const poolQuestionCount = Math.min(300, Math.max(5, parseInt(req.body?.poolQuestionCount ?? "60", 10) || 60));
    const docPath = `/uploads/${req.file.filename}`;
    const text = await extractDocxText(docPath);
    const questions = await buildExamQuestionsWithAi({ text, mode, targetDifficulty, poolQuestionCount });
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
    const [permissions, roles, institutions, educationCategories, approvedEducations, instructors, educationInstructors, educations] =
      await Promise.all([
        pool.query(`SELECT * FROM permissions`),
        pool.query(`SELECT * FROM roles ORDER BY created_at DESC`),
        pool.query(`SELECT * FROM institutions ORDER BY created_at DESC`),
        pool.query(`SELECT * FROM education_categories ORDER BY created_at DESC`),
        pool.query(`SELECT * FROM approved_educations ORDER BY code ASC`),
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
      approvedEducations: approvedEducations.rows.map(toApiObject),
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

app.get("/api/admin/exam-portal/visits", auth, checkPermission("examPortalAccess", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim().toLowerCase();
    const searchParam = search ? `%${search}%` : "";
    const countSql = `SELECT COUNT(*)::int AS total FROM exam_portal_visits
      WHERE ($1::text = '' OR LOWER(CONCAT(COALESCE(portal_url,''), ' ', COALESCE(education_code,''), ' ', COALESCE(national_id,''))) LIKE $1)`;
    const listSql = `SELECT * FROM exam_portal_visits
      WHERE ($1::text = '' OR LOWER(CONCAT(COALESCE(portal_url,''), ' ', COALESCE(education_code,''), ' ', COALESCE(national_id,''))) LIKE $1)
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, [searchParam]),
      pool.query(listSql, [searchParam, pageSize, offset]),
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
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/exam-portal/visits/:id", auth, checkPermission("examPortalAccess", "can_delete"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const previous = await pool.query(`SELECT * FROM exam_portal_visits WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    await pool.query(`DELETE FROM exam_portal_visits WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName: "examPortalAccess", entityId: id, oldData: previous.rows[0] });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/exam-portal/limit-exceeded", auth, checkPermission("examPortalAccess", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || "").trim().toLowerCase();
    const searchParam = search ? `%${search}%` : "";
    const countSql = `SELECT COUNT(*)::int AS total FROM (
        SELECT UPPER(TRIM(education_code)) AS education_code, national_id, COUNT(*)::int AS start_count
        FROM exam_attempts
        GROUP BY UPPER(TRIM(education_code)), national_id
        HAVING COUNT(*)::int >= $1
      ) t
      WHERE ($2::text = '' OR LOWER(CONCAT(education_code, ' ', national_id, ' ', start_count::text)) LIKE $2)`;
    const listSql = `SELECT education_code, national_id, start_count FROM (
        SELECT UPPER(TRIM(education_code)) AS education_code, national_id, COUNT(*)::int AS start_count
        FROM exam_attempts
        GROUP BY UPPER(TRIM(education_code)), national_id
        HAVING COUNT(*)::int >= $1
      ) t
      WHERE ($2::text = '' OR LOWER(CONCAT(education_code, ' ', national_id, ' ', start_count::text)) LIKE $2)
      ORDER BY education_code ASC, national_id ASC
      LIMIT $3 OFFSET $4`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, [EXAM_PORTAL_MAX_STARTS, searchParam]),
      pool.query(listSql, [EXAM_PORTAL_MAX_STARTS, searchParam, pageSize, offset]),
    ]);
    return res.json({
      data: listResult.rows.map((row) => ({
        educationCode: row.education_code,
        nationalId: row.national_id,
        startCount: row.start_count,
      })),
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

app.delete("/api/admin/exam-portal/limit-exceeded", auth, checkPermission("examPortalAccess", "can_delete"), async (req, res, next) => {
  try {
    const educationCode = String(req.body?.educationCode || "").trim().toUpperCase();
    const nationalId = String(req.body?.nationalId || "").trim();
    if (!/^[A-Z]{3}\d{7}$/.test(educationCode)) {
      return res.status(400).json({ message: "Geçerli eğitim kodu gerekli." });
    }
    if (!/^\d{11}$/.test(nationalId)) {
      return res.status(400).json({ message: "T.C. kimlik no 11 haneli olmalıdır." });
    }
    const del = await pool.query(
      `DELETE FROM exam_attempts WHERE UPPER(TRIM(education_code)) = $1 AND national_id = $2`,
      [educationCode, nationalId],
    );
    await writeActivityLog({
      req,
      action: "delete",
      moduleName: "examPortalAccess",
      entityId: `${educationCode}-${nationalId}`,
      oldData: { educationCode, nationalId, deletedAttempts: del.rowCount },
    });
    return res.json({ deletedAttempts: del.rowCount });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/exam-results/:id/payment-received", auth, checkPermission("examResults", "can_update"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const markPaid = req.body?.paymentReceived === true || req.body?.paymentReceived === "true";
    if (!markPaid) {
      return res.status(400).json({ message: "Yalnizca odeme alindi olarak isaretlenebilir (paymentReceived: true)." });
    }
    const previousResult = await pool.query(`SELECT * FROM exam_portal_best_scores WHERE id = $1 LIMIT 1`, [id]);
    const previous = previousResult.rows[0];
    if (!previous) return res.status(404).json({ message: "Kayıt bulunamadı." });
    if (previous.payment_received === true) {
      const api = toApiObject(previous);
      return res.json({
        ...api,
        certificateEligible: Number(previous.best_score) >= 60,
      });
    }
    const result = await pool.query(
      `UPDATE exam_portal_best_scores SET payment_received = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    await writeActivityLog({
      req,
      action: "update",
      moduleName: "examResults",
      entityId: id,
      oldData: previous,
      newData: row,
    });
    const api = toApiObject(row);
    return res.json({
      ...api,
      certificateEligible: Number(row.best_score) >= 60,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/exam-results", auth, checkPermission("examResults", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const searchRaw = String(req.query.search || "").trim();
    const educationCodeRaw = String(req.query.educationCode || "").trim().toUpperCase();
    const nationalIdRaw = String(req.query.nationalId || "").trim();
    const certificateOnly = ["1", "true", "yes"].includes(String(req.query.certificateOnly || "").toLowerCase());

    const params = [];
    const conditions = [];

    if (educationCodeRaw) {
      params.push(`%${educationCodeRaw.toLowerCase()}%`);
      conditions.push(`LOWER(education_code) LIKE $${params.length}`);
    }
    if (nationalIdRaw) {
      const digits = nationalIdRaw.replace(/\D/g, "");
      if (digits.length) {
        params.push(`%${digits}%`);
        conditions.push(`national_id LIKE $${params.length}`);
      }
    }
    if (searchRaw) {
      params.push(`%${searchRaw.toLowerCase()}%`);
      conditions.push(`LOWER(CONCAT(COALESCE(education_code,''), ' ', COALESCE(national_id,''))) LIKE $${params.length}`);
    }
    if (certificateOnly) {
      conditions.push(`best_score >= 60`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*)::int AS total FROM exam_portal_best_scores ${whereSql}`;
    const listSql = `SELECT * FROM exam_portal_best_scores ${whereSql} ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
    ]);
    return res.json({
      data: listResult.rows.map((row) => {
        const api = toApiObject(row);
        return {
          ...api,
          certificateEligible: Number(row.best_score) >= 60,
        };
      }),
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

app.delete("/api/admin/exam-results/:id", auth, checkPermission("examResults", "can_delete"), async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    const previous = await pool.query(`SELECT * FROM exam_portal_best_scores WHERE id = $1 LIMIT 1`, [id]);
    if (!previous.rows[0]) return res.status(404).json({ message: "Kayıt bulunamadı." });
    await pool.query(`DELETE FROM exam_portal_best_scores WHERE id = $1`, [id]);
    await writeActivityLog({ req, action: "delete", moduleName: "examResults", entityId: id, oldData: previous.rows[0] });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/messaging/admins", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.first_name, a.last_name, a.email, r.code AS role_code, r.name AS role_name
      FROM admin_users a
      INNER JOIN roles r ON r.id = a.role_id
      WHERE a.is_active = TRUE
      ORDER BY a.first_name ASC, a.last_name ASC, a.email ASC
    `);
    return res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        roleCode: row.role_code,
        roleName: row.role_name,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/messaging/announcements", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 30;
    const offset = (page - 1) * pageSize;
    const [countResult, listResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM admin_announcements`),
      pool.query(
        `SELECT an.id, an.title, an.body, an.created_at,
                u.first_name AS author_first_name, u.last_name AS author_last_name, u.email AS author_email
         FROM admin_announcements an
         LEFT JOIN admin_users u ON u.id = an.author_id
         ORDER BY an.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
    return res.json({
      data: listResult.rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        body: row.body,
        createdAt: row.created_at,
        author: row.author_first_name
          ? {
              firstName: row.author_first_name,
              lastName: row.author_last_name,
              email: row.author_email,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/messaging/announcements", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    if (!isAdminMessagingLead(req)) {
      return res.status(403).json({ message: "Duyuru yayinlamak icin Super Admin veya Admin rolu gerekir." });
    }
    const body = String(req.body?.body || "").trim();
    const titleRaw = String(req.body?.title || "").trim();
    const title = titleRaw.length ? titleRaw : null;
    if (!body) return res.status(400).json({ message: "Duyuru metni zorunludur." });
    const ins = await pool.query(
      `INSERT INTO admin_announcements (title, body, author_id) VALUES ($1, $2, $3::uuid) RETURNING id, title, body, created_at, author_id`,
      [title, body, req.user.id],
    );
    const row = ins.rows[0];
    await writeActivityLog({
      req,
      action: "create",
      moduleName: "adminMessaging",
      entityId: row.id,
      newData: { type: "announcement", title: row.title },
    });
    return res.status(201).json({
      id: row.id,
      title: row.title || "",
      body: row.body,
      createdAt: row.created_at,
      authorId: row.author_id,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/messaging/dm/threads", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const result = await pool.query(
      `SELECT t.id AS thread_id, t.last_message_at,
              o.id AS peer_id, o.first_name AS peer_first_name, o.last_name AS peer_last_name, o.email AS peer_email,
              r.code AS peer_role_code,
              lm.body AS last_body
       FROM admin_dm_threads t
       INNER JOIN admin_users o ON o.id = CASE WHEN t.user_low_id = $1::uuid THEN t.user_high_id ELSE t.user_low_id END
       INNER JOIN roles r ON r.id = o.role_id
       LEFT JOIN LATERAL (
         SELECT m.body FROM admin_dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1
       ) lm ON TRUE
       WHERE (t.user_low_id = $1::uuid OR t.user_high_id = $1::uuid)
       ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC`,
      [me],
    );
    return res.json({
      data: result.rows.map((row) => ({
        threadId: row.thread_id,
        lastMessageAt: row.last_message_at,
        lastPreview: row.last_body ? String(row.last_body).slice(0, 160) : "",
        peer: {
          id: row.peer_id,
          firstName: row.peer_first_name,
          lastName: row.peer_last_name,
          email: row.peer_email,
          roleCode: row.peer_role_code,
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/messaging/dm/peers/:peerId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const peerId = String(req.params.peerId || "").trim();
    if (!isUuidParam(peerId)) return res.status(400).json({ message: "Gecersiz kullanici." });
    if (peerId === me) return res.status(400).json({ message: "Kendinize mesaj gonderemezsiniz." });
    const peerOk = await pool.query(`SELECT id FROM admin_users WHERE id = $1::uuid AND is_active = TRUE LIMIT 1`, [peerId]);
    if (!peerOk.rows[0]) return res.status(404).json({ message: "Kullanici bulunamadi." });
    const sorted = [me, peerId].sort();
    const threadResult = await pool.query(
      `SELECT id FROM admin_dm_threads WHERE user_low_id = $1::uuid AND user_high_id = $2::uuid LIMIT 1`,
      [sorted[0], sorted[1]],
    );
    const threadId = threadResult.rows[0]?.id;
    if (!threadId) return res.json({ data: [] });
    const messages = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              s.first_name AS sender_first_name, s.last_name AS sender_last_name
       FROM admin_dm_messages m
       INNER JOIN admin_users s ON s.id = m.sender_id
       WHERE m.thread_id = $1::uuid
       ORDER BY m.created_at ASC
       LIMIT 400`,
      [threadId],
    );
    return res.json({
      data: messages.rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderId: row.sender_id,
        sender: {
          firstName: row.sender_first_name,
          lastName: row.sender_last_name,
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/messaging/dm/peers/:peerId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const me = req.user.id;
    const peerId = String(req.params.peerId || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!isUuidParam(peerId)) return res.status(400).json({ message: "Gecersiz kullanici." });
    if (peerId === me) return res.status(400).json({ message: "Kendinize mesaj gonderemezsiniz." });
    if (!body) return res.status(400).json({ message: "Mesaj metni zorunludur." });
    const peerOk = await client.query(`SELECT id FROM admin_users WHERE id = $1::uuid AND is_active = TRUE LIMIT 1`, [peerId]);
    if (!peerOk.rows[0]) return res.status(404).json({ message: "Kullanici bulunamadi." });
    const sorted = [me, peerId].sort();
    await client.query("BEGIN");
    const threadIns = await client.query(
      `INSERT INTO admin_dm_threads (user_low_id, user_high_id, last_message_at)
       VALUES ($1::uuid, $2::uuid, NOW())
       ON CONFLICT (user_low_id, user_high_id) DO UPDATE SET last_message_at = EXCLUDED.last_message_at
       RETURNING id`,
      [sorted[0], sorted[1]],
    );
    const threadId = threadIns.rows[0].id;
    const msgIns = await client.query(
      `INSERT INTO admin_dm_messages (thread_id, sender_id, body) VALUES ($1::uuid, $2::uuid, $3) RETURNING id, body, created_at, sender_id`,
      [threadId, me, body],
    );
    await client.query("COMMIT");
    const m = msgIns.rows[0];
    return res.status(201).json({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});

app.get("/api/admin/messaging/groups", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const result = await pool.query(
      `SELECT g.id, g.name, g.created_at, g.updated_at,
              (SELECT COUNT(*)::int FROM admin_chat_group_members m WHERE m.group_id = g.id) AS member_count
       FROM admin_chat_groups g
       INNER JOIN admin_chat_group_members mem ON mem.group_id = g.id AND mem.admin_user_id = $1::uuid
       ORDER BY g.updated_at DESC`,
      [me],
    );
    return res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        memberCount: row.member_count,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/messaging/groups", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    if (!isAdminMessagingLead(req)) {
      return res.status(403).json({ message: "Grup olusturmak icin Super Admin veya Admin rolu gerekir." });
    }
    const name = String(req.body?.name || "").trim();
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map((x) => String(x).trim()).filter(isUuidParam) : [];
    if (!name || name.length > 120) return res.status(400).json({ message: "Grup adi 1-120 karakter olmalidir." });
    const finalMembers = [...new Set([...memberIds, req.user.id])];
    if (finalMembers.length < 2) {
      return res.status(400).json({ message: "Gruba en az bir diger yonetici ekleyin." });
    }
    const active = await pool.query(`SELECT id FROM admin_users WHERE id = ANY($1::uuid[]) AND is_active = TRUE`, [finalMembers]);
    if (active.rows.length !== finalMembers.length) {
      return res.status(400).json({ message: "Bazi kullanicilar bulunamadi veya pasif." });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const gIns = await client.query(
        `INSERT INTO admin_chat_groups (name, created_by_id, updated_at) VALUES ($1, $2::uuid, NOW()) RETURNING id, name, created_at, updated_at`,
        [name, req.user.id],
      );
      const gid = gIns.rows[0].id;
      for (const uid of finalMembers) {
        await client.query(`INSERT INTO admin_chat_group_members (group_id, admin_user_id) VALUES ($1::uuid, $2::uuid)`, [gid, uid]);
      }
      await writeActivityLog({ req, action: "create", moduleName: "adminMessaging", entityId: gid, newData: { type: "group", name } });
      await client.query("COMMIT");
      return res.status(201).json({
        id: gIns.rows[0].id,
        name: gIns.rows[0].name,
        createdAt: gIns.rows[0].created_at,
        updatedAt: gIns.rows[0].updated_at,
        memberCount: finalMembers.length,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/messaging/groups/:groupId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const groupId = String(req.params.groupId || "").trim();
    if (!isUuidParam(groupId)) return res.status(400).json({ message: "Gecersiz grup." });
    const mem = await pool.query(
      `SELECT 1 FROM admin_chat_group_members WHERE group_id = $1::uuid AND admin_user_id = $2::uuid LIMIT 1`,
      [groupId, me],
    );
    if (!mem.rows[0]) return res.status(403).json({ message: "Bu grubun uyesi degilsiniz." });
    const messages = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              s.first_name AS sender_first_name, s.last_name AS sender_last_name
       FROM admin_chat_group_messages m
       INNER JOIN admin_users s ON s.id = m.sender_id
       WHERE m.group_id = $1::uuid
       ORDER BY m.created_at ASC
       LIMIT 400`,
      [groupId],
    );
    return res.json({
      data: messages.rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderId: row.sender_id,
        sender: { firstName: row.sender_first_name, lastName: row.sender_last_name },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/messaging/groups/:groupId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const groupId = String(req.params.groupId || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!isUuidParam(groupId)) return res.status(400).json({ message: "Gecersiz grup." });
    if (!body) return res.status(400).json({ message: "Mesaj metni zorunludur." });
    const mem = await pool.query(
      `SELECT 1 FROM admin_chat_group_members WHERE group_id = $1::uuid AND admin_user_id = $2::uuid LIMIT 1`,
      [groupId, me],
    );
    if (!mem.rows[0]) return res.status(403).json({ message: "Bu grubun uyesi degilsiniz." });
    const msgIns = await pool.query(
      `INSERT INTO admin_chat_group_messages (group_id, sender_id, body) VALUES ($1::uuid, $2::uuid, $3) RETURNING id, body, created_at, sender_id`,
      [groupId, me, body],
    );
    await pool.query(`UPDATE admin_chat_groups SET updated_at = NOW() WHERE id = $1::uuid`, [groupId]);
    const m = msgIns.rows[0];
    return res.status(201).json({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
    });
  } catch (error) {
    return next(error);
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

  if (moduleName === "instructors") {
    try {
      const p = await pool.query(`SELECT can_create FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [
        req.user.roleId,
        moduleName,
      ]);
      if (!p.rows[0]?.can_create) return res.status(403).json({ message: "Yetkiniz yok." });
      const body = req.body || {};
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const title = String(body.title || "").trim();
      const department = String(body.department || "").trim();
      const about = String(body.about || "").trim();
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Ad, soyad, e-posta ve şifre zorunludur." });
      }
      const roleResult = await pool.query(`SELECT id FROM roles WHERE code = 'egitmen' LIMIT 1`);
      if (!roleResult.rows[0]) return res.status(500).json({ message: "Eğitmen rolü bulunamadı." });
      const roleId = roleResult.rows[0].id;
      const password_hash = await bcrypt.hash(password, 10);
      const insert = await pool.query(
        `INSERT INTO admin_users (first_name, last_name, email, password_hash, role_id, is_active)
         VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING *`,
        [firstName, lastName, email, password_hash, roleId],
      );
      const admin = insert.rows[0];
      await upsertInstructorByAdminUser(admin);
      if (title || department || about) {
        await pool.query(
          `UPDATE instructors SET title = $1, department = $2, about = $3, updated_at = NOW() WHERE admin_user_id = $4`,
          [title, department, about, admin.id],
        );
      }
      const instRow = await pool.query(`SELECT title, department, about FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [admin.id]);
      const i = instRow.rows[0] || {};
      await writeActivityLog({ req, action: "create", moduleName, entityId: admin.id, newData: { ...admin, ...i } });
      return res.status(201).json(
        toApiObject({
          ...admin,
          title: i.title ?? "",
          department: i.department ?? "",
          about: i.about ?? "",
        }),
      );
    } catch (error) {
      return next(error);
    }
  }

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
      const adminPayload = {};
      if (payload.first_name !== undefined) adminPayload.first_name = String(payload.first_name || "").trim();
      if (payload.last_name !== undefined) adminPayload.last_name = String(payload.last_name || "").trim();
      if (payload.email !== undefined) adminPayload.email = String(payload.email || "").trim().toLowerCase();
      if (payload.password) {
        adminPayload.password_hash = await bcrypt.hash(String(payload.password), 10);
      }
      const adminKeys = Object.keys(adminPayload);
      if (adminKeys.length) {
        const adminVals = adminKeys.map((k) => adminPayload[k]);
        const setA = adminKeys.map((k, i) => `${k} = $${i + 1}`).join(", ");
        await pool.query(`UPDATE admin_users SET ${setA}, updated_at = NOW() WHERE id = $${adminKeys.length + 1}`, [...adminVals, id]);
      }
      const adminUser = await pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email, a.password_hash
         FROM admin_users a
         INNER JOIN roles r ON r.id = a.role_id
         WHERE a.id = $1 AND r.code = 'egitmen'
         LIMIT 1`,
        [id],
      );
      if (!adminUser.rows[0]) return res.status(404).json({ message: "Eğitmen kaydı bulunamadı." });
      const previousInstructor = await pool.query(`SELECT * FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [id]);
      await upsertInstructorByAdminUser(adminUser.rows[0]);
      const updateKeys = Object.keys(payload).filter((key) => allowed.includes(key));
      if (updateKeys.length) {
        const values = updateKeys.map((key) => payload[key]);
        const setSql = updateKeys.map((key, i) => `${key} = $${i + 1}`).join(", ");
        const result = await pool.query(
          `UPDATE instructors SET ${setSql}, updated_at = NOW() WHERE admin_user_id = $${updateKeys.length + 1} RETURNING *`,
          [...values, id],
        );
        await writeActivityLog({ req, action: "update", moduleName, entityId: id, oldData: previousInstructor.rows[0], newData: result.rows[0] });
        return res.json(toApiObject({ ...adminUser.rows[0], ...result.rows[0], id: adminUser.rows[0].id }));
      }
      const instOnly = await pool.query(`SELECT * FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [id]);
      await writeActivityLog({
        req,
        action: "update",
        moduleName,
        entityId: id,
        oldData: previousInstructor.rows[0],
        newData: instOnly.rows[0],
      });
      return res.json(toApiObject({ ...adminUser.rows[0], ...instOnly.rows[0], id: adminUser.rows[0].id }));
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
  try {
    const p = await pool.query(`SELECT can_delete FROM permissions WHERE role_id = $1 AND module_name = $2 LIMIT 1`, [req.user.roleId, moduleName]);
    if (!p.rows[0]?.can_delete) return res.status(403).json({ message: "Yetkiniz yok." });

    if (moduleName === "instructors") {
      const adminCheck = await pool.query(
        `SELECT a.id FROM admin_users a INNER JOIN roles r ON r.id = a.role_id WHERE a.id = $1 AND r.code = 'egitmen' LIMIT 1`,
        [id],
      );
      if (!adminCheck.rows[0]) return res.status(404).json({ message: "Eğitmen kaydı bulunamadı." });
      const previous = await pool.query(`SELECT * FROM admin_users WHERE id = $1 LIMIT 1`, [id]);
      await pool.query(`DELETE FROM admin_users WHERE id = $1`, [id]);
      await writeActivityLog({ req, action: "delete", moduleName, entityId: id, oldData: previous.rows[0] });
      return res.status(204).send();
    }

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
    await migrateApprovedEducationsTable();
    await migrateUserFavoritesTable();
    await migrateUserFavoritesDualSupport();
    await migrateEducationReviewsTable();
    await migrateEducationRatingAggregates();
    await migrateNormalUserDetails();
    await migrateNormalUserDetailsAddressColumns();
    await migrateNormalUserDetailsNationalIdUnique();
    await migrateExamQuestionBatchColumns();
    await migrateExamAttemptsTable();
    await migrateExamPortalVisitTable();
    await migrateExamPortalBestScoresTable();
    await migrateExamPortalAccessPermissions();
    await migrateExamResultsPermissions();
    await migrateExamQuestionSettingsColumns();
    await migrateAdminMessagingTables();
    await migrateAdminMessagingPermissions();
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
