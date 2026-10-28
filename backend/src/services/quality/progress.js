import pool from "../../db/pool.js";
import { loadEducationModules } from "../education/modules.js";

const QUALITY_FILTER = "kalite-egitim";

const progressKey = (moduleId, resourceId) => `${moduleId}:${resourceId}`;

const loadQualityProgressRows = async (ldapSubject, educationId) => {
  const result = await pool.query(
    `SELECT module_id, resource_id, resource_index, watched_seconds, duration_seconds,
            last_position_seconds, watched_ranges, completed, updated_at
     FROM quality_education_progress
     WHERE ldap_subject = $1 AND education_id = $2`,
    [ldapSubject, educationId],
  );
  return result.rows;
};

const decorateQualityModules = (modules, progressRows) => {
  const progressByKey = new Map(
    progressRows.map((row) => [
      progressKey(row.module_id, row.resource_id),
      {
        watchedSeconds: Number(row.watched_seconds) || 0,
        durationSeconds: Number(row.duration_seconds) || 0,
        lastPositionSeconds: Number(row.last_position_seconds) || 0,
        completed: Boolean(row.completed),
        updatedAt: row.updated_at,
      },
    ]),
  );

  let previousVideosCompleted = true;
  let videoCount = 0;
  let completedVideoCount = 0;

  const decorated = modules.map((moduleRow) => {
    const moduleUnlocked = previousVideosCompleted;
    const resources = (Array.isArray(moduleRow.resources) ? moduleRow.resources : []).map((resource, resourceIndex) => {
      const kind = String(resource?.kind || "").toLowerCase();
      const progress = progressByKey.get(progressKey(moduleRow.id, resource.id))
        || progressByKey.get(progressKey(moduleRow.id, `legacy:${resourceIndex}`))
        || {
        watchedSeconds: 0,
        durationSeconds: 0,
        lastPositionSeconds: 0,
        completed: false,
        updatedAt: null,
      };

      if (kind !== "video") {
        return { ...resource, resourceIndex, locked: !moduleUnlocked };
      }

      videoCount += 1;
      const unlocked = previousVideosCompleted;
      if (progress.completed) completedVideoCount += 1;
      previousVideosCompleted = previousVideosCompleted && progress.completed;
      const percent =
        progress.durationSeconds > 0
          ? Math.min(100, Math.round((progress.watchedSeconds / progress.durationSeconds) * 100))
          : 0;
      return { ...resource, resourceIndex, locked: !unlocked, progress: { ...progress, percent } };
    });

    return { ...moduleRow, unlocked: moduleUnlocked, locked: !moduleUnlocked, resources };
  });

  return {
    modules: decorated,
    videoCount,
    completedVideoCount,
    examUnlocked: videoCount === completedVideoCount,
    completionPercent: videoCount ? Math.round((completedVideoCount / videoCount) * 100) : 100,
  };
};

const mergeWatchedRanges = (ranges, nextRange, duration) => {
  const normalized = [...(Array.isArray(ranges) ? ranges : []), nextRange]
    .map((range) => {
      const start = Math.max(0, Math.min(duration, Number(range?.[0]) || 0));
      const end = Math.max(start, Math.min(duration, Number(range?.[1]) || 0));
      return [start, end];
    })
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  normalized.forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (!last || start > last[1] + 0.5) merged.push([start, end]);
    else last[1] = Math.max(last[1], end);
  });
  return merged;
};

const watchedSecondsFromRanges = (ranges) =>
  ranges.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);

const loadQualityCourseState = async (ldapSubject, educationId) => {
  const educationResult = await pool.query(
    `SELECT e.*, c.category_name, i.name AS institution_name,
            i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
            ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name,
            ins.title AS instructor_title, ins.department AS instructor_department,
            ins.about AS instructor_about, ins.email AS instructor_email,
            ins.image_url AS instructor_image_url
     FROM educations e
     LEFT JOIN education_categories c ON c.id = e.category_id
     LEFT JOIN institutions i ON i.id = e.institution_id
     LEFT JOIN instructors ins ON ins.id = e.instructor_id
     WHERE e.id = $1 AND e.sales_filter = $2
     LIMIT 1`,
    [educationId, QUALITY_FILTER],
  );
  const education = educationResult.rows[0];
  if (!education) return null;
  const [modules, progressRows] = await Promise.all([
    loadEducationModules(educationId),
    loadQualityProgressRows(ldapSubject, educationId),
  ]);
  return { education, ...decorateQualityModules(modules, progressRows) };
};

const saveQualityVideoProgress = async ({
  ldapSubject,
  educationId,
  moduleId,
  resourceId,
  resourceIndex,
  positionSeconds,
  durationSeconds,
  watchedFromSeconds,
  watchedToSeconds,
}) => {
  const state = await loadQualityCourseState(ldapSubject, educationId);
  if (!state) {
    const error = new Error("Kalite Eğitimi bulunamadı.");
    error.statusCode = 404;
    throw error;
  }

  const moduleRow = state.modules.find((item) => String(item.id) === String(moduleId));
  const resource = moduleRow?.resources?.find(
    (item) => String(item.id) === String(resourceId)
      && Number(item.resourceIndex) === Number(resourceIndex),
  );
  if (!resource || String(resource.kind).toLowerCase() !== "video") {
    const error = new Error("Video kaynağı bulunamadı.");
    error.statusCode = 404;
    throw error;
  }
  if (resource.locked && !resource.progress?.completed) {
    const error = new Error("Önceki videoyu en az %90 tamamlamanız gerekir.");
    error.statusCode = 403;
    error.code = "QUALITY_VIDEO_LOCKED";
    throw error;
  }

  const duration = Math.min(86400, Math.max(0, Number(durationSeconds) || 0));
  const position = duration > 0
    ? Math.min(duration, Math.max(0, Number(positionSeconds) || 0))
    : Math.max(0, Number(positionSeconds) || 0);
  let rangeStart = Math.max(0, Number(watchedFromSeconds) || 0);
  let rangeEnd = Math.max(rangeStart, Number(watchedToSeconds) || 0);
  // Yaklaşık beş saniyelik parçalar beklenir; tek istekte en fazla 15 saniyelik yeni aralık kabul edilir.
  if (rangeEnd - rangeStart > 15) rangeEnd = rangeStart + 15;
  if (duration > 0) {
    rangeStart = Math.min(duration, rangeStart);
    rangeEnd = Math.min(duration, rangeEnd);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(
      `SELECT watched_ranges, duration_seconds, completed
       FROM quality_education_progress
       WHERE ldap_subject = $1 AND education_id = $2 AND module_id = $3 AND resource_id = $4
       FOR UPDATE`,
      [ldapSubject, educationId, moduleId, resourceId],
    );
    const existing = existingResult.rows[0];
    const effectiveDuration = Math.max(duration, Number(existing?.duration_seconds) || 0);
    const ranges = mergeWatchedRanges(existing?.watched_ranges, [rangeStart, rangeEnd], effectiveDuration);
    const watchedSeconds = watchedSecondsFromRanges(ranges);
    const completed = Boolean(existing?.completed) || (effectiveDuration > 0 && watchedSeconds >= effectiveDuration * 0.9);

    await client.query(
      `INSERT INTO quality_education_progress
         (ldap_subject, education_id, module_id, resource_id, resource_index, watched_seconds,
          duration_seconds, last_position_seconds, watched_ranges, completed, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
       ON CONFLICT (ldap_subject, education_id, module_id, resource_id) DO UPDATE SET
         resource_index = EXCLUDED.resource_index,
         watched_seconds = EXCLUDED.watched_seconds,
         duration_seconds = EXCLUDED.duration_seconds,
         last_position_seconds = EXCLUDED.last_position_seconds,
         watched_ranges = EXCLUDED.watched_ranges,
         completed = EXCLUDED.completed,
         updated_at = NOW()`,
      [
        ldapSubject,
        educationId,
        moduleId,
        resourceId,
        Number(resourceIndex),
        watchedSeconds,
        effectiveDuration,
        position,
        JSON.stringify(ranges),
        completed,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return loadQualityCourseState(ldapSubject, educationId);
};

export {
  QUALITY_FILTER,
  loadQualityProgressRows,
  decorateQualityModules,
  loadQualityCourseState,
  saveQualityVideoProgress,
};
