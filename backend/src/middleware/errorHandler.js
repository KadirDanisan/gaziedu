import pool from "../db/pool.js";

export default async function errorHandler(error, req, res, next) {
  try {
    await pool.query(
      `INSERT INTO error_logs (admin_user_id, route, method, message, stack, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        req.user?.id || null,
        req.originalUrl,
        req.method,
        error.message || "Unknown error",
        error.stack || null,
        req.body ? JSON.stringify(req.body) : null,
      ],
    );
  } catch {
    // no-op
  }
  res.status(500).json({ message: "Sunucu hatası.", detail: error.message });
  next();
}
