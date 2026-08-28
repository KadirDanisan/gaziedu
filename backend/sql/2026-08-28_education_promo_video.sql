-- Eğitim tanıtım videosu (yükleme yolu + harici bağlantı)
-- Kullanım: psql "$DATABASE_URL" -f backend/sql/2026-08-28_education_promo_video.sql

ALTER TABLE educations ADD COLUMN IF NOT EXISTS promo_video_path TEXT;
ALTER TABLE educations ADD COLUMN IF NOT EXISTS promo_video_url TEXT;
