import pool from "../../db/pool.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { sqlTitleSlugTrimmed } from "../../utils/slug.js";
import { loadEducationModules, normalizeTopicHeadings } from "./modules.js";
import { SALES_FILTERS, normalizeSalesFilter, salesFilterLabel } from "../../config/salesFilters.js";

const formatRatingAggregateFields = (row) => {
  const ratingCount = Number(row.rating_count ?? 0) || 0;
  const rawAvg = row.rating_average;
  const ratingAverage = rawAvg != null && rawAvg !== "" ? Number(rawAvg) : null;
  const hasRating = ratingAverage != null && !Number.isNaN(ratingAverage) && ratingCount > 0;
  return {
    rating: hasRating ? ratingAverage.toFixed(1) : "",
    ratingAverage: hasRating ? ratingAverage : null,
    ratingCount,
  };
};

const formatPublicCourseInstructor = (row) => {
  const first = row.instructor_first_name ? String(row.instructor_first_name).trim() : "";
  const last = row.instructor_last_name ? String(row.instructor_last_name).trim() : "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  const info = row.instructor_info != null && row.instructor_info !== "" ? String(row.instructor_info).trim() : "";
  const about = row.instructor_about != null && row.instructor_about !== "" ? String(row.instructor_about).trim() : "";
  const hasStructuredInstructor = Boolean(row.instructor_id && full);
  return {
    instructorId: row.instructor_id || null,
    instructorName: full,
    instructorTitle: row.instructor_title != null && row.instructor_title !== "" ? String(row.instructor_title).trim() : "",
    instructorDepartment: row.instructor_department != null && row.instructor_department !== "" ? String(row.instructor_department).trim() : "",
    instructorAbout: about,
    instructorEmail: row.instructor_email != null && row.instructor_email !== "" ? String(row.instructor_email).trim().toLowerCase() : "",
    instructorImage: row.instructor_image_url != null && row.instructor_image_url !== "" ? String(row.instructor_image_url).trim() : "",
    instructorLegacyInfo: !hasStructuredInstructor && info ? info : "",
  };
};

const formatPublicCourse = (row) => ({
  id: row.id,
  title: row.name || row.education_name || row.title || "Eğitim",
  categoryId: row.category_id || null,
  category: row.category_name || null,
  calendarDate: row.calendar_date || null,
  date: row.calendar_date
    ? new Date(row.calendar_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : null,
  mode: row.mode || "Uzaktan Eğitim",
  duration: row.duration || "Belirtilmedi",
  attendees: row.attendees || "Sınırsız Kontenjan",
  image: row.image_url || "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282",
  description: row.description || "",
  content: row.content || "",
  contentDocPath: row.content_doc_path || "",
  topicHeadings: normalizeTopicHeadings(row.topic_headings),
  modules: Array.isArray(row.modules) ? row.modules : [],
  contentHtml: "",
  code: row.code || "",
  salesFilter: normalizeSalesFilter(row.sales_filter),
  salesFilterLabel: salesFilterLabel(row.sales_filter),
  sourceType: row.source_type || "education",
  institutionId: row.institution_id || null,
  institutionName: row.institution_name ? String(row.institution_name) : "",
  institutionLogo: row.institution_logo_url ? String(row.institution_logo_url) : "",
  institutionWebsite: row.institution_website_url ? String(row.institution_website_url) : "",
  ...formatRatingAggregateFields(row),
  ...formatPublicCourseInstructor(row),
});

const loadPublicCategoryOptions = async () => {
  const categoryRows = await pool.query(`SELECT id, category_name FROM education_categories ORDER BY category_name ASC`);
  return [
    { id: "", name: "Tüm Eğitimler" },
    ...categoryRows.rows.map((row) => ({ id: row.id, name: row.category_name })),
  ];
};

const EDUCATION_DETAIL_SELECT = `e.id, e.name, e.description, e.content, e.image_url, e.code, e.duration, e.topic_headings, e.sales_filter, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
          ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email, ins.image_url AS instructor_image_url,
          NULL::text AS instructor_info, NULL::timestamptz AS calendar_date`;

const CALENDAR_DETAIL_SELECT = `ec.id, ec.education_name, ec.description, ec.content, ec.image_url, ec.code, ec.duration, ec.topic_headings, ec.sales_filter, ec.content_doc_path, ec.calendar_date, ec.category_id, ec.institution_id, ec.instructor_id, ec.instructor_info, ec.rating_average, ec.rating_count, c.category_name, 'calendar'::text AS source_type, inst.name AS institution_name, inst.logo_url AS institution_logo_url, inst.website_url AS institution_website_url,
                     ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email, ins.image_url AS instructor_image_url`;

const buildEducationCalendarQuery = (query) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10)));
  const sortRaw = String(query.sort || "newest").toLowerCase();
  const sort = sortRaw === "newest" ? "DESC" : "ASC";
  const categoryId = String(query.categoryId || "").trim();
  const dateFrom = String(query.dateFrom || "").trim();
  const dateTo = String(query.dateTo || "").trim();
  const params = [];
  const conditions = [];

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`e.category_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`e.created_at >= $${params.length}::timestamptz`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`e.created_at <= ($${params.length}::date + interval '1 day' - interval '1 second')`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderSql = sort === "ASC" ? "e.created_at ASC" : "e.created_at DESC";

  return { page, pageSize, params, whereSql, orderSql, offset: (page - 1) * pageSize };
};

const formatPublicCourseRows = (rows, { withContent = false } = {}) =>
  rows.map((row) => formatPublicCourse({ ...row, content_html: withContent ? row.content_html || "" : "" }));

const EDUCATION_LIST_SELECT = `e.id, e.name, e.description, e.image_url, e.code, e.duration, e.content_doc_path, e.sales_filter, e.category_id, e.institution_id, e.instructor_id, e.rating_average, e.rating_count, c.category_name, 'education'::text AS source_type, i.name AS institution_name, i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
          ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name, ins.title AS instructor_title, ins.department AS instructor_department, ins.about AS instructor_about, ins.email AS instructor_email, ins.image_url AS instructor_image_url,
          NULL::text AS instructor_info`;

const parseEducationsCatalogQuery = (query) => {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 9)));
  const searchRaw = String(query.search || "").trim();
  const sortRaw = String(query.sort || "newest").toLowerCase();
  const sort =
    sortRaw === "oldest"
      ? "oldest"
      : sortRaw === "most_reviews" || sortRaw === "most-reviewed" || sortRaw === "en-cok-degerlendirme"
        ? "most_reviews"
        : sortRaw === "rating" || sortRaw === "degerlendirme"
          ? "rating"
          : "newest";

  const catRaw = query.category;
  /** Küçük harfe çevirmeyi Postgres yapar: JS "İ" harfini i+U+0307 olarak açtığı için eşleşme kaçıyordu. */
  const categoryList = (Array.isArray(catRaw) ? catRaw : catRaw != null && catRaw !== "" ? [catRaw] : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  const salesRaw = query.salesFilter;
  const salesFilterList = [
    ...new Set(
      (Array.isArray(salesRaw) ? salesRaw : salesRaw != null && salesRaw !== "" ? [salesRaw] : [])
        .map((s) => normalizeSalesFilter(s))
        .filter(Boolean),
    ),
  ];

  const params = [];
  const conditions = [];

  if (searchRaw) {
    params.push(`%${escapeIlikePattern(searchRaw)}%`);
    conditions.push(`e.name ILIKE $${params.length} ESCAPE '\\'`);
  }

  if (categoryList.length) {
    params.push(categoryList);
    conditions.push(
      `LOWER(TRIM(COALESCE(c.category_name, ''))) = ANY(ARRAY(SELECT LOWER(TRIM(v)) FROM unnest($${params.length}::text[]) AS v))`,
    );
  }

  if (salesFilterList.length) {
    params.push(salesFilterList);
    conditions.push(`e.sales_filter = ANY($${params.length}::text[])`);
  }

  if (sort === "most_reviews") {
    conditions.push(`e.rating_count > 0`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderSql =
    sort === "oldest"
      ? `e.created_at ASC`
      : sort === "most_reviews"
        ? `e.rating_count DESC, e.rating_average DESC NULLS LAST, e.created_at DESC`
        : sort === "rating"
          ? `e.rating_average DESC NULLS LAST, e.rating_count DESC, e.created_at DESC`
          : `e.created_at DESC`;

  return { page, pageSize, sort, whereSql, orderSql, params, offset: (page - 1) * pageSize };
};

const queryPublicEducationsList = async (query) => {
  const { page, pageSize, whereSql, orderSql, params, offset } = parseEducationsCatalogQuery(query);

  const baseCountSql = `SELECT COUNT(*)::int AS total
      FROM educations e
      LEFT JOIN education_categories c ON c.id = e.category_id
      ${whereSql}`;

  const listSql = `SELECT ${EDUCATION_LIST_SELECT}
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const [countResult, listResult] = await Promise.all([
    pool.query(baseCountSql, params),
    pool.query(listSql, [...params, pageSize, offset]),
  ]);

  const courses = formatPublicCourseRows(listResult.rows.map((row) => ({ ...row, content_html: "" })));
  const total = countResult.rows[0]?.total || 0;

  return {
    courses,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
};

/** Ana sayfada her satış filtresi için ayrı bir şerit; tek sorguda gruplanır. */
const queryLatestCoursesBySalesFilter = async ({ limit = 4 } = {}) => {
  const perGroup = Math.min(12, Math.max(1, Number(limit) || 4));
  const keys = SALES_FILTERS.map((item) => item.key);

  const listSql = `SELECT * FROM (
      SELECT ${EDUCATION_LIST_SELECT},
             ROW_NUMBER() OVER (PARTITION BY e.sales_filter ORDER BY e.created_at DESC) AS group_rank
      FROM educations e
      LEFT JOIN education_categories c ON c.id = e.category_id
      LEFT JOIN institutions i ON i.id = e.institution_id
      LEFT JOIN instructors ins ON ins.id = e.instructor_id
      WHERE e.sales_filter = ANY($1::text[])
    ) ranked
    WHERE ranked.group_rank <= $2`;

  const countSql = `SELECT sales_filter, COUNT(*)::int AS total
      FROM educations
      WHERE sales_filter = ANY($1::text[])
      GROUP BY sales_filter`;

  const [listResult, countResult] = await Promise.all([
    pool.query(listSql, [keys, perGroup]),
    pool.query(countSql, [keys]),
  ]);

  const totalsByKey = Object.fromEntries(countResult.rows.map((row) => [row.sales_filter, row.total]));
  const coursesByKey = new Map(keys.map((key) => [key, []]));
  listResult.rows.forEach((row) => {
    coursesByKey.get(row.sales_filter)?.push(row);
  });

  return {
    groups: SALES_FILTERS.map((item) => ({
      key: item.key,
      label: item.label,
      total: totalsByKey[item.key] || 0,
      courses: formatPublicCourseRows((coursesByKey.get(item.key) || []).map((row) => ({ ...row, content_html: "" }))),
    })),
  };
};

const formatEducationReviewRow = (row) => {
  const first = String(row.first_name || "").trim();
  const last = String(row.last_name || "").trim();
  const initial = last.length ? `${last.charAt(0).toUpperCase()}.` : "";
  const authorLabel = [first, initial].filter(Boolean).join(" ").trim() || "Katılımcı";
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment || "",
    createdAt: row.created_at,
    authorLabel,
  };
};

export {
  formatRatingAggregateFields,
  formatPublicCourseInstructor,
  formatPublicCourse,
  loadPublicCategoryOptions,
  EDUCATION_DETAIL_SELECT,
  CALENDAR_DETAIL_SELECT,
  buildEducationCalendarQuery,
  formatPublicCourseRows,
  EDUCATION_LIST_SELECT,
  parseEducationsCatalogQuery,
  queryPublicEducationsList,
  queryLatestCoursesBySalesFilter,
  formatEducationReviewRow,
};
