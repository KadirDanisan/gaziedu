import pool from "../db/pool.js";
import { permissionModules } from "../config/adminModules.js";

const ensurePermissionRows = async () => {
  await pool.query(
    `INSERT INTO permissions (role_id, module_name, can_view, can_create, can_update, can_delete)
     SELECT r.id, m.module_name,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.code = 'superadmin' THEN TRUE ELSE FALSE END
     FROM roles r
     CROSS JOIN unnest($1::text[]) AS m(module_name)
     ON CONFLICT (role_id, module_name) DO NOTHING`,
    [permissionModules],
  );
};

export { ensurePermissionRows };
