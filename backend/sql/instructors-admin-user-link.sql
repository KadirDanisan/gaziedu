-- Eğitmen kaydı ile admin_users (egitmen rolü) eşlemesi — server.js migrateInstructorAdminLinkColumn ile aynı
-- Mevcut DB'de "column i.admin_user_id does not exist" hatasını giderir.

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS admin_user_id UUID UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE;

UPDATE instructors i
SET admin_user_id = a.id
FROM admin_users a
INNER JOIN roles r ON r.id = a.role_id
WHERE i.admin_user_id IS NULL
  AND LOWER(i.email) = LOWER(a.email)
  AND r.code = 'egitmen';
