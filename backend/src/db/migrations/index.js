import pool from "../pool.js";

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

const migrateExamPortalParticipantNameColumns = async () => {
  await pool.query(`ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS participant_name TEXT`);
  await pool.query(`ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS participant_name TEXT`);
  await pool.query(`ALTER TABLE exam_portal_visits ADD COLUMN IF NOT EXISTS participant_name TEXT`);
  await pool.query(`
    UPDATE exam_portal_best_scores b
    SET participant_name = src.participant_name
    FROM (
      SELECT DISTINCT ON (UPPER(TRIM(education_code)), TRIM(national_id))
        UPPER(TRIM(education_code)) AS education_code,
        TRIM(national_id) AS national_id,
        TRIM(participant_name) AS participant_name
      FROM exam_attempts
      WHERE participant_name IS NOT NULL
        AND TRIM(participant_name) <> ''
        AND status = 'completed'
      ORDER BY UPPER(TRIM(education_code)), TRIM(national_id), submitted_at DESC NULLS LAST
    ) src
    WHERE UPPER(TRIM(b.education_code)) = src.education_code
      AND TRIM(b.national_id) = src.national_id
      AND (b.participant_name IS NULL OR TRIM(b.participant_name) = '')
  `);
  await pool.query(`
    UPDATE exam_portal_visits v
    SET participant_name = src.participant_name
    FROM (
      SELECT DISTINCT ON (UPPER(TRIM(education_code)), TRIM(national_id))
        UPPER(TRIM(education_code)) AS education_code,
        TRIM(national_id) AS national_id,
        TRIM(participant_name) AS participant_name
      FROM exam_attempts
      WHERE participant_name IS NOT NULL
        AND TRIM(participant_name) <> ''
      ORDER BY UPPER(TRIM(education_code)), TRIM(national_id), COALESCE(submitted_at, started_at) DESC NULLS LAST
    ) src
    WHERE UPPER(TRIM(v.education_code)) = src.education_code
      AND TRIM(v.national_id) = src.national_id
      AND (v.participant_name IS NULL OR TRIM(v.participant_name) = '')
  `);
};

/** Tamamlanmış sınav oturumlarından eksik özet kayıtlarını doldurur (GZM-1-32-03 formatı). */
const migrateBackfillExamPortalBestScores = async () => {
  await pool.query(`
    WITH ranked AS (
      SELECT
        UPPER(TRIM(education_code)) AS education_code,
        TRIM(national_id) AS national_id,
        score::numeric AS score,
        COALESCE(submitted_at, updated_at, started_at) AS attempt_at,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(TRIM(education_code)), TRIM(national_id)
          ORDER BY score DESC, COALESCE(submitted_at, updated_at, started_at) DESC
        ) AS best_rank,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(TRIM(education_code)), TRIM(national_id)
          ORDER BY COALESCE(submitted_at, updated_at, started_at) DESC
        ) AS last_rank
      FROM exam_attempts
      WHERE status = 'completed'
        AND education_code IS NOT NULL
        AND TRIM(education_code) <> ''
        AND national_id IS NOT NULL
        AND TRIM(national_id) <> ''
    ),
    best AS (
      SELECT education_code, national_id, score, attempt_at
      FROM ranked
      WHERE best_rank = 1
    ),
    last AS (
      SELECT education_code, national_id, score, attempt_at
      FROM ranked
      WHERE last_rank = 1
    )
    INSERT INTO exam_portal_best_scores (education_code, national_id, best_score, best_recorded_at, last_attempt_at, last_score)
    SELECT b.education_code, b.national_id, b.score, b.attempt_at, l.attempt_at, l.score
    FROM best b
    INNER JOIN last l ON l.education_code = b.education_code AND l.national_id = b.national_id
    WHERE b.education_code ~ '^[A-Z]{3}-[0-9]+-[0-9]+-[0-9]+$'
      AND b.national_id ~ '^[0-9]{11}$'
    ON CONFLICT (education_code, national_id) DO UPDATE SET
      best_score = GREATEST(exam_portal_best_scores.best_score, EXCLUDED.best_score),
      best_recorded_at = CASE
        WHEN EXCLUDED.best_score > exam_portal_best_scores.best_score THEN EXCLUDED.best_recorded_at
        ELSE exam_portal_best_scores.best_recorded_at
      END,
      last_attempt_at = GREATEST(exam_portal_best_scores.last_attempt_at, EXCLUDED.last_attempt_at),
      last_score = EXCLUDED.last_score,
      updated_at = NOW()
  `);
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

const migrateCertificateListPermissions = async () => {
  await pool.query(`
    INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
    SELECT r.id, 'certificateList', p.can_view, FALSE, FALSE, FALSE
    FROM roles r
    INNER JOIN permissions p ON p.role_id = r.id AND p.module_name = 'examResults'
    ON CONFLICT (role_id, module_name) DO NOTHING
  `);
};

const migrateExamSuccessPaymentsPermissions = async () => {
  await pool.query(`
    INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
    SELECT r.id, 'examSuccessPayments', p.can_view, FALSE, p.can_update, FALSE
    FROM roles r
    INNER JOIN permissions p ON p.role_id = r.id AND p.module_name = 'examResults'
    ON CONFLICT (role_id, module_name) DO NOTHING
  `);
};

const migrateExamQuestionSettingsColumns = async () => {
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS exam_target_difficulty TEXT NOT NULL DEFAULT 'medium'`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS exam_question_count INT NOT NULL DEFAULT 20`);
  await pool.query(`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS pool_question_count INT NOT NULL DEFAULT 60`);
};

const migrateEducationContentModules = async () => {
  await pool.query(`ALTER TABLE educations ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS education_modules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      education_id UUID NOT NULL REFERENCES educations(id) ON DELETE CASCADE,
      sort_order INT NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS education_modules_education_id_idx ON education_modules (education_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS education_modules_sort_idx ON education_modules (education_id, sort_order, created_at)`);
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

const migrateCertificateSerialNumbers = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificate_serial_state (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      last_serial BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO certificate_serial_state (id, last_serial)
    VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS document_number TEXT`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_document_number_unique
      ON exam_portal_best_scores (document_number)
      WHERE document_number IS NOT NULL
  `);
};

const migrateCertificateEdevletProcessed = async () => {
  await pool.query(
    `ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS edevlet_processed BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_processed_idx
     ON exam_portal_best_scores (edevlet_processed)`,
  );
};

/** A kolonu ID sayacı (4000000…); seed=4000003 → sonraki export 4000004 */
const migrateEdevletExcelExportState = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS edevlet_excel_serial_state (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      last_serial BIGINT NOT NULL DEFAULT 4000003,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO edevlet_excel_serial_state (id, last_serial)
    VALUES (1, 4000003)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(
    `ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS edevlet_excel_exported BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  await pool.query(
    `ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS edevlet_excel_row_id BIGINT`,
  );
  await pool.query(
    `ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS edevlet_excel_uuid TEXT`,
  );
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_row_id_unique
      ON exam_portal_best_scores (edevlet_excel_row_id)
      WHERE edevlet_excel_row_id IS NOT NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_uuid_unique
      ON exam_portal_best_scores (edevlet_excel_uuid)
      WHERE edevlet_excel_uuid IS NOT NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_exported_idx
      ON exam_portal_best_scores (edevlet_excel_exported)
  `);
};

export {
  migrateContactFormTimestampsToIstanbul,
  migrateInstitutionCodeColumn,
  migrateInstructorAdminLinkColumn,
  migrateEducationDocColumns,
  migrateEducationCalendarColumns,
  migrateEducationCategoryColumns,
  migrateApprovedEducationsTable,
  migrateUserFavoritesTable,
  migrateUserFavoritesDualSupport,
  migrateEducationReviewsTable,
  migrateEducationRatingAggregates,
  migrateNormalUserDetails,
  migrateNormalUserDetailsAddressColumns,
  migrateNormalUserDetailsNationalIdUnique,
  migrateExamQuestionBatchColumns,
  migrateExamAttemptsTable,
  EXAM_PORTAL_MAX_STARTS,
  migrateExamPortalVisitTable,
  migrateExamPortalBestScoresTable,
  migrateExamPortalParticipantNameColumns,
  migrateBackfillExamPortalBestScores,
  migrateExamPortalAccessPermissions,
  migrateExamResultsPermissions,
  migrateCertificateListPermissions,
  migrateExamSuccessPaymentsPermissions,
  migrateExamQuestionSettingsColumns,
  migrateEducationContentModules,
  migrateAdminMessagingTables,
  migrateAdminMessagingPermissions,
  migrateCertificateSerialNumbers,
  migrateCertificateEdevletProcessed,
  migrateEdevletExcelExportState,
};

export const migrations = [
  migrateInstitutionCodeColumn,
  migrateInstructorAdminLinkColumn,
  migrateEducationDocColumns,
  migrateEducationCalendarColumns,
  migrateEducationCategoryColumns,
  migrateApprovedEducationsTable,
  migrateUserFavoritesTable,
  migrateUserFavoritesDualSupport,
  migrateEducationReviewsTable,
  migrateEducationRatingAggregates,
  migrateNormalUserDetails,
  migrateNormalUserDetailsAddressColumns,
  migrateNormalUserDetailsNationalIdUnique,
  migrateExamQuestionBatchColumns,
  migrateExamAttemptsTable,
  migrateExamPortalVisitTable,
  migrateExamPortalBestScoresTable,
  migrateExamPortalParticipantNameColumns,
  migrateBackfillExamPortalBestScores,
  migrateExamPortalAccessPermissions,
  migrateExamResultsPermissions,
  migrateCertificateListPermissions,
  migrateExamSuccessPaymentsPermissions,
  migrateExamQuestionSettingsColumns,
  migrateEducationContentModules,
  migrateAdminMessagingTables,
  migrateAdminMessagingPermissions,
  migrateCertificateSerialNumbers,
  migrateCertificateEdevletProcessed,
  migrateEdevletExcelExportState,
  migrateContactFormTimestampsToIstanbul,
];
