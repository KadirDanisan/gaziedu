-- Eğitim kategorileri + educations / education_calendar FK
-- schema.sql ile senkron; mevcut DB'ye tek başına uygulanabilir (IF NOT EXISTS).
-- approved-educations.sql ÖNCE bu dosya çalıştırılmalı.

CREATE TABLE IF NOT EXISTS education_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE educations ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES education_categories(id) ON DELETE SET NULL;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES education_categories(id) ON DELETE SET NULL;
