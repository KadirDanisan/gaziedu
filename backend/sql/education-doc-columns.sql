-- Word içerik yolu + takvim ek kolonları (migrateEducationDocColumns + migrateEducationCalendarColumns ile aynı)
-- Mevcut DB'de schema.sql tam uygulanmadıysa bir kez çalıştırın.
-- Sıra: education-categories.sql sonrası uyumludur.

ALTER TABLE educations ADD COLUMN IF NOT EXISTS content_doc_path TEXT;
ALTER TABLE educations ADD COLUMN IF NOT EXISTS content_doc_name TEXT;

ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS content_doc_path TEXT;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS content_doc_name TEXT;

-- DATE veya timestamp kolonunu uygulama ile uyumlu TIMESTAMPTZ yapar
ALTER TABLE education_calendar
  ALTER COLUMN calendar_date TYPE TIMESTAMPTZ USING calendar_date::timestamptz;
