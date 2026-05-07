INSERT INTO roles (code, name)
VALUES
  ('superadmin', 'Süper Admin'),
  ('admin', 'Admin'),
  ('yetkili', 'Yetkili'),
  ('egitmen', 'Eğitmen')
ON CONFLICT (code) DO NOTHING;

INSERT INTO institutions (name, logo_url, website_url, description, authorized_person)
VALUES ('Gazi Üniversitesi', '/Gazi_Üniversitesi_logo.png', 'https://gazi.edu.tr', 'Ana kurum kaydı', 'Sistem Yöneticisi')
ON CONFLICT DO NOTHING;

WITH role_data AS (
  SELECT id, code FROM roles
),
inst AS (
  SELECT id FROM institutions ORDER BY created_at ASC LIMIT 1
)
INSERT INTO admin_users (first_name, last_name, email, password_hash, phone, institution_id, role_id)
SELECT 'Super', 'Admin', 'superadmin@gazi.edu.tr', crypt('123456', gen_salt('bf')), '05551111111', inst.id, role_data.id
FROM role_data, inst
WHERE role_data.code = 'superadmin'
ON CONFLICT (email) DO NOTHING;

WITH modules AS (
  SELECT unnest(ARRAY[
    'dashboard','normalUsers','adminUsers','institutions','educations','instructors',
    'educationCalendar','newsletter','contactForms','examQuestions','roles'
  ]) AS module_name
)
INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module_name,
  TRUE,
  CASE WHEN r.code = 'yetkili' THEN FALSE ELSE TRUE END,
  CASE WHEN r.code = 'yetkili' THEN FALSE ELSE TRUE END,
  CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END
FROM roles r
CROSS JOIN modules m
ON CONFLICT (role_id, module_name) DO NOTHING;
