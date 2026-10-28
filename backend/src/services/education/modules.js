import crypto from "node:crypto";
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const deterministicResourceId = (moduleId, index, resource) => {
  const hex = crypto
    .createHash("sha256")
    .update(`${moduleId}:${index}:${resource.kind}:${resource.path || resource.url || resource.title || ""}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

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
      const id = UUID_RE.test(trimmed(raw?.id)) ? trimmed(raw.id).toLowerCase() : null;

      if (kind === "text") {
        const items = normalizeBulletItems(raw?.items);
        const body = trimmed(raw?.body);
        if (!items.length && !body && !title) return null;
        return { id, kind, title, items, body };
      }

      if (kind === "pdf") {
        const path = normalizeUploadPath(trimmed(raw?.path));
        const url = trimmed(raw?.url);
        if (!path && !url) return null;
        return { id, kind, title, path, url, fileName: fixUploadedFileName(raw?.fileName), size: normalizeByteSize(raw?.size) };
      }

      const path = normalizeUploadPath(trimmed(raw?.path));
      const url = trimmed(raw?.url);
      if (!path && !url) return null;
      return {
        id,
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
  const resources = normalizeModuleResources(api.resources).map((resource, index) => ({
    ...resource,
    id: resource.id || deterministicResourceId(api.id, index, resource),
  }));
  return {
    ...api,
    items: normalizeBulletItems(api.items),
    resources,
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

/** Herkese açık yanıtta içerik URL'lerini gizle; yalnızca başlık iskeleti. */
const lockEducationModulesForPublic = (modules, { previewFirst = false } = {}) => {
  if (!Array.isArray(modules)) return [];
  return modules.map((moduleRow, index) => {
    if (previewFirst && index === 0) {
      return { ...moduleRow, locked: false, preview: true };
    }
    const resources = Array.isArray(moduleRow?.resources) ? moduleRow.resources : [];
    const legacyItems = Array.isArray(moduleRow?.items) ? moduleRow.items : [];
    const lockedResources = [];
    resources.forEach((resource) => {
      const kind = String(resource?.kind || "").toLowerCase();
      if (kind === "video" || kind === "pdf" || kind === "text") {
        lockedResources.push({ kind, title: resource.title || "", locked: true });
      }
    });
    if (!lockedResources.length && legacyItems.length) {
      lockedResources.push({ kind: "text", title: "", locked: true });
    }
    return {
      id: moduleRow.id,
      title: moduleRow.title || "",
      sortOrder: moduleRow.sortOrder,
      items: [],
      resources: lockedResources,
      locked: true,
    };
  });
};

const syncEducationModules = async (educationId, modules) => {
  if (!educationId) return [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saved = [];
    const keptIds = [];
    for (let index = 0; index < (Array.isArray(modules) ? modules : []).length; index += 1) {
      const moduleRow = modules[index] || {};
      const title = trimmed(moduleRow.title);
      const items = normalizeBulletItems(moduleRow.items);
      const normalized = normalizeModuleResources(moduleRow.resources);
      if (!title && !items.length && !normalized.length) continue;

      let existingId = UUID_RE.test(trimmed(moduleRow.id)) ? trimmed(moduleRow.id) : null;
      let result = existingId
        ? await client.query(
            `UPDATE education_modules
             SET sort_order = $3, title = $4, items = $5::jsonb, updated_at = NOW()
             WHERE id = $1 AND education_id = $2
             RETURNING id, education_id, sort_order, title, items, resources, created_at, updated_at`,
            [existingId, educationId, index, title || `Modül ${index + 1}`, JSON.stringify(items)],
          )
        : { rows: [] };

      if (!result.rows[0]) {
        result = await client.query(
          `INSERT INTO education_modules (education_id, sort_order, title, items, resources)
           VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb)
           RETURNING id, education_id, sort_order, title, items, resources, created_at, updated_at`,
          [educationId, index, title || `Modül ${index + 1}`, JSON.stringify(items)],
        );
        existingId = result.rows[0].id;
      }

      const resources = normalized.map((resource, resourceIndex) => ({
        ...resource,
        id: resource.id || deterministicResourceId(existingId, resourceIndex, resource),
      }));
      const updated = await client.query(
        `UPDATE education_modules
         SET resources = $2::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING id, education_id, sort_order, title, items, resources, created_at, updated_at`,
        [existingId, JSON.stringify(resources)],
      );
      keptIds.push(existingId);
      saved.push(toApiModule(updated.rows[0]));
    }

    if (keptIds.length) {
      await client.query(
        `DELETE FROM education_modules WHERE education_id = $1 AND NOT (id = ANY($2::uuid[]))`,
        [educationId, keptIds],
      );
    } else {
      await client.query(`DELETE FROM education_modules WHERE education_id = $1`, [educationId]);
    }
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  lockEducationModulesForPublic,
  syncEducationModules,
  stripNonTableFields,
};
