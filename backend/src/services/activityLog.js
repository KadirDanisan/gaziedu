import pool from "../db/pool.js";

const writeActivityLog = async ({ req, action, moduleName, entityId, oldData, newData }) => {
  await pool.query(
    `INSERT INTO activity_logs (admin_user_id, action, module_name, entity_id, old_data, new_data, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      req.user?.id || null,
      action,
      moduleName,
      entityId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      req.ip,
      req.headers["user-agent"] || null,
    ],
  );
};

export { writeActivityLog };
