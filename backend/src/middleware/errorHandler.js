import pool from "../db/pool.js";

function serializeErrorPayload(body) {
  if (!body || typeof body !== "object") return null;
  try {
    const safe = {};
    for (const [key, value] of Object.entries(body)) {
      if (value instanceof Buffer) continue;
      if (typeof value === "object" && value !== null) safe[key] = "[skipped]";
      else safe[key] = value;
    }
    return safe;
  } catch {
    return null;
  }
}

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
        serializeErrorPayload(req.body),
      ],
    );
  } catch {
    // no-op
  }
  res.status(500).json({ message: "Sunucu hatası.", detail: error.message });
  next();
}
