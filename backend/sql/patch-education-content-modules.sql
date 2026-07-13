-- Eğitim içeriği: Word dosyası yerine metin + konu başlıkları + modüller
-- Çalıştırma: psql -U ... -d gaziedu -f backend/sql/patch-education-content-modules.sql
BEGIN;

ALTER TABLE educations ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS education_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  education_id UUID NOT NULL REFERENCES educations(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS education_modules_education_id_idx
  ON education_modules (education_id);

CREATE INDEX IF NOT EXISTS education_modules_sort_idx
  ON education_modules (education_id, sort_order, created_at);

COMMIT;
