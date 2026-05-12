CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  logo_url TEXT,
  website_url TEXT,
  description TEXT,
  authorized_person TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, module_name)
);

CREATE TABLE IF NOT EXISTS normal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS normal_user_details (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS normal_user_details_national_id_key
  ON normal_user_details (national_id)
  WHERE national_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  about TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  description TEXT,
  image_url TEXT,
  code TEXT,
  duration TEXT,
  content TEXT,
  rating_average NUMERIC(4,2),
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  education_name TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  content TEXT,
  instructor_info TEXT,
  calendar_date DATE NOT NULL,
  rating_average NUMERIC(4,2),
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_education_unique
  ON education_reviews (user_id, education_id) WHERE target_type = 'education';

CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_calendar_unique
  ON education_reviews (user_id, calendar_id) WHERE target_type = 'calendar';

CREATE OR REPLACE FUNCTION refresh_education_rating_aggregate(
  p_target TEXT,
  p_education_id UUID,
  p_calendar_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_cnt INT;
  v_avg NUMERIC(4,2);
BEGIN
  IF p_target = 'education' AND p_education_id IS NOT NULL THEN
    SELECT COUNT(*)::INT,
           CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
    INTO v_cnt, v_avg
    FROM education_reviews
    WHERE target_type = 'education' AND education_id = p_education_id;
    UPDATE educations SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_education_id;
  ELSIF p_target = 'calendar' AND p_calendar_id IS NOT NULL THEN
    SELECT COUNT(*)::INT,
           CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
    INTO v_cnt, v_avg
    FROM education_reviews
    WHERE target_type = 'calendar' AND calendar_id = p_calendar_id;
    UPDATE education_calendar SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_calendar_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS education_reviews_refresh_aggregate_trg ON education_reviews;
CREATE TRIGGER education_reviews_refresh_aggregate_trg
AFTER INSERT OR UPDATE OR DELETE ON education_reviews
FOR EACH ROW EXECUTE PROCEDURE education_reviews_aggregate_trigger();

CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  difficulty TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT,
  education_id UUID REFERENCES educations(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS exam_attempts_education_code_idx ON exam_attempts (education_code);
CREATE INDEX IF NOT EXISTS exam_attempts_national_id_idx ON exam_attempts (national_id);

CREATE TABLE IF NOT EXISTS exam_portal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_url TEXT NOT NULL,
  education_code TEXT NOT NULL,
  national_id VARCHAR(11) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exam_portal_visits_created_at_idx ON exam_portal_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS exam_portal_visits_code_tc_idx ON exam_portal_visits (education_code, national_id);

CREATE TABLE IF NOT EXISTS exam_portal_best_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  education_code TEXT NOT NULL,
  national_id VARCHAR(11) NOT NULL,
  best_score NUMERIC(5,2) NOT NULL,
  best_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_score NUMERIC(5,2) NOT NULL,
  payment_received BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (education_code, national_id)
);

CREATE INDEX IF NOT EXISTS exam_portal_best_scores_updated_idx ON exam_portal_best_scores (updated_at DESC);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module_name TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  route TEXT,
  method TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT NOT NULL CHECK (char_length(body) <= 16000),
  author_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_announcements_created_idx ON admin_announcements (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  user_high_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id)
);

CREATE INDEX IF NOT EXISTS admin_dm_threads_participant_idx ON admin_dm_threads (user_low_id, user_high_id);
CREATE INDEX IF NOT EXISTS admin_dm_threads_last_idx ON admin_dm_threads (last_message_at DESC);

CREATE TABLE IF NOT EXISTS admin_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES admin_dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_dm_messages_thread_time_idx ON admin_dm_messages (thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS admin_chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 120),
  created_by_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_chat_group_members (
  group_id UUID NOT NULL REFERENCES admin_chat_groups(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, admin_user_id)
);

CREATE TABLE IF NOT EXISTS admin_chat_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES admin_chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_chat_group_messages_group_time_idx ON admin_chat_group_messages (group_id, created_at ASC);
CREATE INDEX IF NOT EXISTS admin_chat_groups_updated_idx ON admin_chat_groups (updated_at DESC);
