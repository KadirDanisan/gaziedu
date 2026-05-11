-- Onaylanmış eğitim listesi (PostgreSQL)
-- Eğitim listesi formunda kod seçimi ve kurumsal referans için kullanılır.

CREATE TABLE IF NOT EXISTS approved_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES education_categories(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approved_educations_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS approved_educations_category_id_idx ON approved_educations(category_id);
CREATE INDEX IF NOT EXISTS approved_educations_institution_id_idx ON approved_educations(institution_id);
