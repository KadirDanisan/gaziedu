-- Kullanıcı favorileri (eğitim + takvim) — server.js migrateUserFavoritesTable + migrateUserFavoritesDualSupport
-- "relation user_favorites does not exist" için bir kez çalıştırın.

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES normal_users(id) ON DELETE CASCADE,
  education_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, education_id)
);

ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS target_type TEXT;
UPDATE user_favorites SET target_type = 'education' WHERE target_type IS NULL OR btrim(target_type) = '';
ALTER TABLE user_favorites ALTER COLUMN target_type SET DEFAULT 'education';
ALTER TABLE user_favorites ALTER COLUMN target_type SET NOT NULL;

ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES education_calendar(id) ON DELETE CASCADE;

ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_user_id_education_id_key;

ALTER TABLE user_favorites ALTER COLUMN education_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_education_unique ON user_favorites (user_id, education_id) WHERE target_type = 'education' AND education_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_calendar_unique ON user_favorites (user_id, calendar_id) WHERE target_type = 'calendar' AND calendar_id IS NOT NULL;
