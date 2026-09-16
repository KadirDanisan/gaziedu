-- Ücretli eğitim ücret / indirim alanları
-- Kullanım: psql "$DATABASE_URL" -f backend/sql/2026-09-16_education_price.sql

ALTER TABLE educations ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
ALTER TABLE educations ADD COLUMN IF NOT EXISTS has_discount BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE educations ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5,2);
