import pool from "../../db/pool.js";
import { fixUploadedFileName } from "../../utils/fileName.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { normalizeUploadPath } from "./payload.js";

const normalizeBulletItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
};

const MODULE_RESOURCE_KINDS = new Set(["text", "pdf", "video"]);

const trimmed = (value) => String(value ?? "").trim();

const normalizeByteSize = (value) => {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.round(size) : 0;
};

/** Modül blokları: metin (madde listesi/paragraf), indirilebilir PDF ve video (gömülü URL veya yüklenen dosya). */
const normalizeModuleResources = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const kind = trimmed(raw?.kind).toLowerCase();
      if (!MODULE_RESOURCE_KINDS.has(kind)) return null;
      const title = trimmed(raw?.title);

      if (kind === "text") {
        const items = normalizeBulletItems(raw?.items);
        const body = trimmed(raw?.body);
        if (!items.length && !body && !title) return null;
        return { kind, title, items, body };
      }

      if (kind === "pdf") {
        const path = normalizeUploadPath(trimmed(raw?.path));
        const url = trimmed(raw?.url);
        if (!path && !url) return null;
        return { kind, title, path, url, fileName: fixUploadedFileName(raw?.fileName), size: normalizeByteSize(raw?.size) };
      }

      const path = normalizeUploadPath(trimmed(raw?.path));
      const url = trimmed(raw?.url);
      if (!path && !url) return null;
      return {
        kind,
        title,
        path,
        url,
        fileName: fixUploadedFileName(raw?.fileName),
        size: normalizeByteSize(raw?.size),
        duration: trimmed(raw?.duration),
      };
    })
    .filter(Boolean);
};

const toApiModule = (row) => {
  const api = toApiObject(row);
  return {
    ...api,
    items: normalizeBulletItems(api.items),
    resources: normalizeModuleResources(api.resources),
  };
};

const loadEducationModules = async (educationId) => {
  if (!educationId) return [];
  const result = await pool.query(
    `SELECT id, education_id, sort_order, title, items, resources, created_at, updated_at
     FROM education_modules
     WHERE education_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [educationId],
  );
  return result.rows.map(toApiModule);
};

const syncEducationModules = async (educationId, modules) => {
  if (!educationId) return [];
  await pool.query(`DELETE FROM education_modules WHERE education_id = $1`, [educationId]);
  if (!Array.isArray(modules) || !modules.length) return [];

  const saved = [];
  for (let index = 0; index < modules.length; index += 1) {
    const moduleRow = modules[index] || {};
    const title = trimmed(moduleRow.title);
    const items = normalizeBulletItems(moduleRow.items);
    const resources = normalizeModuleResources(moduleRow.resources);
    if (!title && !items.length && !resources.length) continue;

    const result = await pool.query(
      `INSERT INTO education_modules (education_id, sort_order, title, items, resources)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING id, education_id, sort_order, title, items, resources, created_at, updated_at`,
      [educationId, index, title || `Modül ${index + 1}`, JSON.stringify(items), JSON.stringify(resources)],
    );
    saved.push(toApiModule(result.rows[0]));
  }
  return saved;
};

const normalizeTopicHeadings = (value) => normalizeBulletItems(value);

const stripNonTableFields = (payload) => {
  delete payload.modules;
  delete payload._approvedEducationId;
};

export {
  normalizeBulletItems,
  normalizeModuleResources,
  normalizeTopicHeadings,
  loadEducationModules,
  syncEducationModules,
  stripNonTableFields,
};
