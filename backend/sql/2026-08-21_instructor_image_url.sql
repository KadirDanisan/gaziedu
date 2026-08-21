-- Eğitmen profil görseli kolonu
-- Idempotent: birden fazla kez çalıştırılabilir.
-- Kullanım: psql "$DATABASE_URL" -f backend/sql/2026-08-21_instructor_image_url.sql

BEGIN;

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMIT;

-- Doğrulama (isteğe bağlı):
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'instructors' AND column_name = 'image_url';
