import pool from "../db/pool.js";

const getRoleCodeById = async (roleId) => {
  if (!roleId) return null;
  const result = await pool.query(`SELECT code FROM roles WHERE id = $1 LIMIT 1`, [roleId]);
  return result.rows[0]?.code || null;
};

const upsertInstructorByAdminUser = async (adminUser) => {
  if (!adminUser?.id || !adminUser?.email) return;
  const existing = await pool.query(`SELECT id FROM instructors WHERE admin_user_id = $1 LIMIT 1`, [adminUser.id]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE instructors
       SET first_name = $1, last_name = $2, email = $3, password_hash = $4, updated_at = NOW()
       WHERE admin_user_id = $5`,
      [adminUser.first_name, adminUser.last_name, adminUser.email, adminUser.password_hash, adminUser.id],
    );
    return;
  }
  await pool.query(
    `INSERT INTO instructors (admin_user_id, first_name, last_name, email, password_hash)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET
       admin_user_id = EXCLUDED.admin_user_id,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()`,
    [adminUser.id, adminUser.first_name, adminUser.last_name, adminUser.email, adminUser.password_hash],
  );
};

const removeInstructorByAdminUserId = async (adminUserId) => {
  if (!adminUserId) return;
  await pool.query(`DELETE FROM instructors WHERE admin_user_id = $1`, [adminUserId]);
};

export { getRoleCodeById, upsertInstructorByAdminUser, removeInstructorByAdminUserId };
