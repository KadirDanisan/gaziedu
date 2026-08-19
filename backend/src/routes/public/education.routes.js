import { Router } from "express";
import pool from "../../db/pool.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { sqlTitleSlugTrimmed } from "../../utils/slug.js";
import {
  formatEducationReviewRow,
  formatPublicCourse,
  formatPublicCourseRows,
  buildEducationCalendarQuery,
  loadPublicCategoryOptions,
  queryPublicEducationsList,
  queryLatestCoursesBySalesFilter,
  EDUCATION_LIST_SELECT,
  EDUCATION_DETAIL_SELECT,
  CALENDAR_DETAIL_SELECT,
} from "../../services/education/publicCourses.js";
import { loadEducationModules } from "../../services/education/modules.js";
import { SALES_FILTERS } from "../../config/salesFilters.js";

const router = Router();

router.get("/api/public/education-reviews", async (req, res, next) => {
  try {
    const educationId = String(req.query.educationId || "").trim();
    const calendarId = String(req.query.calendarId || "").trim();
    const hasE = Boolean(educationId);
    const hasC = Boolean(calendarId);
    if (hasE === hasC) {
      return res.status(400).json({ message: "Yalnızca educationId veya calendarId query parametresi gönderin." });
    }

    let result;
    if (educationId) {
      result = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
         FROM education_reviews r
         INNER JOIN normal_users u ON u.id = r.user_id
         WHERE r.target_type = 'education' AND r.education_id = $1
         ORDER BY r.created_at DESC`,
        [educationId],
      );
    } else {
      result = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
         FROM education_reviews r
         INNER JOIN normal_users u ON u.id = r.user_id
         WHERE r.target_type = 'calendar' AND r.calendar_id = $1
         ORDER BY r.created_at DESC`,
        [calendarId],
      );
    }

    return res.json({ reviews: result.rows.map(formatEducationReviewRow) });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/search/trainings", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.json({ results: [] });
    }
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 20)));
    const pattern = `%${escapeIlikePattern(q)}%`;
    const [edu, cal] = await Promise.all([
      pool.query(
        `SELECT e.id, e.name, e.image_url, e.category_id, 'education'::text AS source_type
         FROM educations e
         WHERE e.name ILIKE $1 ESCAPE '\\'
         ORDER BY e.name ASC
         LIMIT $2`,
        [pattern, limit],
      ),
      pool.query(
        `SELECT ec.id, ec.education_name AS name, ec.image_url, ec.category_id, 'calendar'::text AS source_type
         FROM education_calendar ec
         WHERE ec.education_name ILIKE $1 ESCAPE '\\'
         ORDER BY ec.education_name ASC
         LIMIT $2`,
        [pattern, limit],
      ),
    ]);
    const mapRow = (row) => ({
      id: row.id,
      title: row.name,
      image: row.image_url || null,
      sourceType: row.source_type,
      categoryId: row.category_id,
    });
    const combined = [...edu.rows.map(mapRow), ...cal.rows.map(mapRow)];
    combined.sort((a, b) => String(a.title).localeCompare(String(b.title), "tr", { sensitivity: "base" }));
    return res.json({ results: combined.slice(0, limit) });
  } catch (error) {
    next(error);
  }
});

router.get("/api/public/top-rated-courses", async (req, res, next) => {
  try {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 4));
    const listSql = `SELECT ${EDUCATION_LIST_SELECT}
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       WHERE e.rating_count > 0
       ORDER BY e.rating_count DESC, e.rating_average DESC NULLS LAST, e.created_at DESC
       LIMIT $1`;
    const result = await pool.query(listSql, [limit]);
    const courses = formatPublicCourseRows(result.rows.map((row) => ({ ...row, content_html: "" })));
    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/all-trainings", async (req, res, next) => {
  try {
    const result = await queryPublicEducationsList(req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/hero-courses", async (req, res, next) => {
  try {
    const limit = 5;
    const listSql = `SELECT e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
          ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email,
          NULL::text AS instructor_info
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       ORDER BY RANDOM()
       LIMIT $1`;
    const result = await pool.query(listSql, [limit]);
    const courses = formatPublicCourseRows(result.rows.map((row) => ({ ...row, content_html: "" })));
    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/categories", async (req, res, next) => {
  try {
    const categories = await loadPublicCategoryOptions();
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/upcoming-courses", async (req, res, next) => {
  try {
    const limit = 3;
    const listSql = `SELECT ${EDUCATION_LIST_SELECT}
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       ORDER BY e.created_at DESC
       LIMIT $1`;
    const result = await pool.query(listSql, [limit]);
    const courses = formatPublicCourseRows(result.rows.map((row) => ({ ...row, content_html: "" })));
    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/sales-filters", (req, res) => {
  return res.json({ salesFilters: SALES_FILTERS.map(({ key, label }) => ({ key, label })) });
});

router.get("/api/public/upcoming-courses-by-filter", async (req, res, next) => {
  try {
    const result = await queryLatestCoursesBySalesFilter({ limit: req.query.limit || 4 });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/education-calendar", async (req, res, next) => {
  try {
    const { page, pageSize, params, whereSql, orderSql, offset } = buildEducationCalendarQuery(req.query);

    const countSql = `SELECT COUNT(*)::int AS total
                      FROM educations e
                      LEFT JOIN education_categories c ON c.id = e.category_id
                      ${whereSql}`;
    const listSql = `SELECT ${EDUCATION_LIST_SELECT}, e.created_at AS calendar_date
                     FROM educations e
                     LEFT JOIN education_categories c ON c.id = e.category_id
                     LEFT JOIN institutions i ON i.id = e.institution_id
                     LEFT JOIN instructors ins ON ins.id = e.instructor_id
                     ${whereSql}
                     ORDER BY ${orderSql}
                     LIMIT $${params.length + 1}
                     OFFSET $${params.length + 2}`;

    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
    ]);

    const courses = formatPublicCourseRows(listResult.rows.map((row) => ({ ...row, content_html: "" })));
    const total = countResult.rows[0]?.total || 0;

    return res.json({
      courses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/public/educations/detail/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ message: "Slug gerekli." });
    }

    const calendarSql = `SELECT ${CALENDAR_DETAIL_SELECT}
                         FROM education_calendar ec
                         LEFT JOIN education_categories c ON c.id = ec.category_id
                         LEFT JOIN institutions inst ON inst.id = ec.institution_id
                         LEFT JOIN instructors ins ON ins.id = ec.instructor_id
                         WHERE ${sqlTitleSlugTrimmed("ec.education_name")} = $1
                         LIMIT 1`;
    const educationSql = `SELECT ${EDUCATION_DETAIL_SELECT}
                          FROM educations e
                          LEFT JOIN education_categories c ON c.id = e.category_id
                          LEFT JOIN institutions i ON i.id = e.institution_id
                          LEFT JOIN instructors ins ON ins.id = e.instructor_id
                          WHERE ${sqlTitleSlugTrimmed("e.name")} = $1
                          LIMIT 1`;

    let row = (await pool.query(calendarSql, [slug])).rows[0];
    if (!row) {
      row = (await pool.query(educationSql, [slug])).rows[0];
    }
    if (!row) {
      return res.status(404).json({ message: "Eğitim bulunamadı." });
    }

    const withContent = {
      ...row,
      modules: row.source_type === "education" ? await loadEducationModules(row.id) : [],
    };
    return res.json({ course: formatPublicCourse(withContent) });
  } catch (error) {
    return next(error);
  }
});

export default router;
