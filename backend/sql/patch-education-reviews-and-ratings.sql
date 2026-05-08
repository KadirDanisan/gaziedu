-- ---------------------------------------------------------------------------
-- Eğitim değerlendirmesi: yorumlar tablosu, ortalama puan kolonları, tetikleyici
-- Mevcut veritabanına uygulamak için SQL editörde çalıştırın.
-- Tekrar çalıştırılabilir (ADD COLUMN IF NOT EXISTS, CREATE IF NOT EXISTS, vb.)
-- PostgreSQL 12+ önerilir. Tetikleyicide EXECUTE PROCEDURE kullanıldı (PG 11+).
-- Eğer "syntax error" alırsanız satırdaki PROCEDURE yerine FUNCTION deneyin (bazı sürümler).
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Kolonlar (schema.sql ile oluşturulmuş eski DB’ler için)
ALTER TABLE educations ADD COLUMN IF NOT EXISTS rating_average NUMERIC(4,2);
ALTER TABLE educations ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS rating_average NUMERIC(4,2);
ALTER TABLE education_calendar ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;

-- Yorumlar
CREATE TABLE IF NOT EXISTS education_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES normal_users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('education', 'calendar')),
  education_id UUID REFERENCES educations(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES education_calendar(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (target_type = 'education' AND education_id IS NOT NULL AND calendar_id IS NULL)
    OR (target_type = 'calendar' AND calendar_id IS NOT NULL AND education_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_education_unique
  ON education_reviews (user_id, education_id) WHERE target_type = 'education';

CREATE UNIQUE INDEX IF NOT EXISTS education_reviews_user_calendar_unique
  ON education_reviews (user_id, calendar_id) WHERE target_type = 'calendar';

-- Ortalamayı güncelleyen fonksiyon + tetikleyici
CREATE OR REPLACE FUNCTION refresh_education_rating_aggregate(
  p_target TEXT,
  p_education_id UUID,
  p_calendar_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_cnt INT;
  v_avg NUMERIC(4,2);
BEGIN
  IF p_target = 'education' AND p_education_id IS NOT NULL THEN
    SELECT COUNT(*)::INT,
           CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
    INTO v_cnt, v_avg
    FROM education_reviews
    WHERE target_type = 'education' AND education_id = p_education_id;
    UPDATE educations SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_education_id;
  ELSIF p_target = 'calendar' AND p_calendar_id IS NOT NULL THEN
    SELECT COUNT(*)::INT,
           CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(rating)::NUMERIC, 2) ELSE NULL END
    INTO v_cnt, v_avg
    FROM education_reviews
    WHERE target_type = 'calendar' AND calendar_id = p_calendar_id;
    UPDATE education_calendar SET rating_count = v_cnt, rating_average = v_avg WHERE id = p_calendar_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION education_reviews_aggregate_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_education_rating_aggregate(OLD.target_type, OLD.education_id, OLD.calendar_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.target_type IS DISTINCT FROM NEW.target_type
       OR OLD.education_id IS DISTINCT FROM NEW.education_id
       OR OLD.calendar_id IS DISTINCT FROM NEW.calendar_id THEN
      PERFORM refresh_education_rating_aggregate(OLD.target_type, OLD.education_id, OLD.calendar_id);
      PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
    ELSE
      PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
    END IF;
  ELSE
    PERFORM refresh_education_rating_aggregate(NEW.target_type, NEW.education_id, NEW.calendar_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS education_reviews_refresh_aggregate_trg ON education_reviews;

CREATE TRIGGER education_reviews_refresh_aggregate_trg
AFTER INSERT OR UPDATE OR DELETE ON education_reviews
FOR EACH ROW EXECUTE PROCEDURE education_reviews_aggregate_trigger();

-- Mevcut yorumlardan ortalamayı bir kez senkronize et
UPDATE educations e
SET rating_count = s.cnt, rating_average = s.avg
FROM (
  SELECT education_id,
    COUNT(*)::INT AS cnt,
    ROUND(AVG(rating::NUMERIC), 2) AS avg
  FROM education_reviews
  WHERE target_type = 'education'
  GROUP BY education_id
) s
WHERE e.id = s.education_id;

UPDATE education_calendar ec
SET rating_count = s.cnt, rating_average = s.avg
FROM (
  SELECT calendar_id,
    COUNT(*)::INT AS cnt,
    ROUND(AVG(rating::NUMERIC), 2) AS avg
  FROM education_reviews
  WHERE target_type = 'calendar'
  GROUP BY calendar_id
) s
WHERE ec.id = s.calendar_id;
