import pool from "../../db/pool.js";
import { toApiObject } from "../../utils/apiTransform.js";

const normalizeBulletItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
};

const loadEducationModules = async (educationId) => {
  if (!educationId) return [];
  const result = await pool.query(
    `SELECT id, education_id, sort_order, title, items, created_at, updated_at
     FROM education_modules
     WHERE education_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [educationId],
  );
  return result.rows.map((row) => {
    const api = toApiObject(row);
    return {
      ...api,
      items: normalizeBulletItems(api.items),
    };
  });
};

const syncEducationModules = async (educationId, modules) => {
  if (!educationId) return [];
  await pool.query(`DELETE FROM education_modules WHERE education_id = $1`, [educationId]);
  if (!Array.isArray(modules) || !modules.length) return [];

  const saved = [];
  for (let index = 0; index < modules.length; index += 1) {
    const moduleRow = modules[index] || {};
    const title = String(moduleRow.title ?? "").trim();
    const items = normalizeBulletItems(moduleRow.items);
    if (!title && !items.length) continue;

    const result = await pool.query(
      `INSERT INTO education_modules (education_id, sort_order, title, items)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, education_id, sort_order, title, items, created_at, updated_at`,
      [educationId, index, title || `Modül ${index + 1}`, JSON.stringify(items.length ? items : [])],
    );
    const api = toApiObject(result.rows[0]);
    saved.push({ ...api, items: normalizeBulletItems(api.items) });
  }
  return saved;
};

const normalizeTopicHeadings = (value) => normalizeBulletItems(value);

const stripNonTableFields = (payload) => {
  delete payload.modules;
  delete payload._approvedEducationId;
};

export { normalizeBulletItems, normalizeTopicHeadings, loadEducationModules, syncEducationModules, stripNonTableFields };
