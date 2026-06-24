-- ---------------------------------------------------------------------------
-- Sınav portali: participant_name kolonları + eksik tablolar
-- Hata: column "participant_name" of relation "exam_attempts" does not exist
--
-- Sunucuda çalıştırma (örnek):
--   psql -U postgres -d guzem -f patch-exam-portal-participant-name.sql
-- veya pgAdmin / DBeaver ile bu dosyayı SQL editörde Execute.
--
-- Tekrar çalıştırılabilir (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- PostgreSQL 12+ önerilir.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Sınav oturumları tablosu (yoksa oluştur)
-- ---------------------------------------------------------------------------
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

-- Katılımcı adı (sınav linkindeki isim) — asıl eksik kolon
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS participant_name TEXT;

-- ---------------------------------------------------------------------------
-- 2) Sınav portali ziyaret kayıtları
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_portal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_url TEXT NOT NULL,
  education_code TEXT NOT NULL,
  national_id VARCHAR(11) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exam_portal_visits_created_at_idx ON exam_portal_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS exam_portal_visits_code_tc_idx ON exam_portal_visits (education_code, national_id);

ALTER TABLE exam_portal_visits ADD COLUMN IF NOT EXISTS participant_name TEXT;

-- ---------------------------------------------------------------------------
-- 3) En iyi skor özeti (admin sınav sonuçları / sertifika listesi)
-- ---------------------------------------------------------------------------
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
);

ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS payment_received BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS participant_name TEXT;

CREATE INDEX IF NOT EXISTS exam_portal_best_scores_updated_idx ON exam_portal_best_scores (updated_at DESC);

-- ---------------------------------------------------------------------------
-- 4) (İsteğe bağlı) Eski kayıtlardan participant_name doldurma
--    Yeni kurulumda boş tablolar için zararsız.
-- ---------------------------------------------------------------------------
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
  AND (b.participant_name IS NULL OR TRIM(b.participant_name) = '');

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
  AND (v.participant_name IS NULL OR TRIM(v.participant_name) = '');

-- ---------------------------------------------------------------------------
-- 5) Kontrol — participant_name kolonları var mı?
-- ---------------------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('exam_attempts', 'exam_portal_visits', 'exam_portal_best_scores')
  AND column_name = 'participant_name'
ORDER BY table_name;
