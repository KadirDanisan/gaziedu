-- 2026-08-19: Satis filtresi + modul icerik bloklari (metin / PDF / video)
-- Idempotent: birden fazla kez calistirilabilir.
-- Kullanim: psql "$DATABASE_URL" -f 2026-08-19_sales_filter_and_module_resources.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) sales_filter kolonlari
-- ---------------------------------------------------------------------------
ALTER TABLE approved_educations ADD COLUMN IF NOT EXISTS sales_filter TEXT;
ALTER TABLE educations ADD COLUMN IF NOT EXISTS sales_filter TEXT;

DO $$
BEGIN
  IF to_regclass('public.education_calendar') IS NOT NULL THEN
    ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS sales_filter TEXT;
  END IF;
END $$;

-- Kurum yalnizca "Egitim Isbirligi Sertifikasyon Egitimleri" turunde secilir.
ALTER TABLE approved_educations ALTER COLUMN institution_id DROP NOT NULL;

-- Mevcut kayitlar varsayilan filtreye tasinir.
UPDATE approved_educations
   SET sales_filter = 'egitim-isbirligi-sertifikasyon'
 WHERE sales_filter IS NULL OR btrim(sales_filter) = '';

UPDATE educations e
   SET sales_filter = a.sales_filter
  FROM approved_educations a
 WHERE UPPER(BTRIM(a.code)) = UPPER(BTRIM(e.code))
   AND (e.sales_filter IS NULL OR btrim(e.sales_filter) = '');

UPDATE educations
   SET sales_filter = 'egitim-isbirligi-sertifikasyon'
 WHERE sales_filter IS NULL OR btrim(sales_filter) = '';

CREATE INDEX IF NOT EXISTS approved_educations_sales_filter_idx ON approved_educations (sales_filter);
CREATE INDEX IF NOT EXISTS educations_sales_filter_idx ON educations (sales_filter);

-- ---------------------------------------------------------------------------
-- 2) Modul icerigi: baslik listesi, modul tablosu ve resources bloklari
-- ---------------------------------------------------------------------------
ALTER TABLE educations ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.education_calendar') IS NOT NULL THEN
    ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS topic_headings JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS education_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  education_id UUID NOT NULL REFERENCES educations(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS education_modules_education_id_idx ON education_modules (education_id);
CREATE INDEX IF NOT EXISTS education_modules_sort_idx ON education_modules (education_id, sort_order, created_at);

ALTER TABLE education_modules ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

-- ---------------------------------------------------------------------------
-- Dogrulama (istege bagli)
-- ---------------------------------------------------------------------------
-- SELECT table_name, column_name
--   FROM information_schema.columns
--  WHERE column_name IN ('sales_filter', 'resources', 'topic_headings')
--  ORDER BY table_name, column_name;
--
-- SELECT sales_filter, COUNT(*) FROM educations GROUP BY 1 ORDER BY 2 DESC;
