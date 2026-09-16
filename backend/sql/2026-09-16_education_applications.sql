-- Ücretli eğitim online başvuruları
-- Kullanım: psql "$DATABASE_URL" -f backend/sql/2026-09-16_education_applications.sql

CREATE TABLE IF NOT EXISTS education_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES normal_users(id) ON DELETE CASCADE,
  education_id UUID NOT NULL REFERENCES educations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  national_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  payment_method TEXT NOT NULL DEFAULT 'havale',
  payment_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, education_id)
);

ALTER TABLE education_applications ADD COLUMN IF NOT EXISTS graduation_doc_path TEXT;
ALTER TABLE education_applications ADD COLUMN IF NOT EXISTS kvkk_doc_path TEXT;
ALTER TABLE education_applications ADD COLUMN IF NOT EXISTS institution_doc_path TEXT;
ALTER TABLE education_applications ADD COLUMN IF NOT EXISTS info_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE education_applications ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE education_applications ALTER COLUMN address_line1 DROP NOT NULL;
ALTER TABLE education_applications ALTER COLUMN city DROP NOT NULL;

CREATE INDEX IF NOT EXISTS education_applications_education_id_idx
  ON education_applications (education_id);

CREATE INDEX IF NOT EXISTS education_applications_created_at_idx
  ON education_applications (created_at DESC);
