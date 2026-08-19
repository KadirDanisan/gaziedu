const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || "Bir hata oluştu.");
    if (data?.code) error.code = data.code;
    throw error;
  }
  return data;
}

const singleFlightCache = new Map();

function singleFlight(key, fetcher) {
  const now = Date.now();
  const cached = singleFlightCache.get(key);
  if (cached) {
    if (cached.promise) return cached.promise;
    if (cached.result !== undefined && now - cached.settledAt < 3000) {
      return Promise.resolve(cached.result);
    }
    singleFlightCache.delete(key);
  }

  const promise = fetcher()
    .then((result) => {
      singleFlightCache.set(key, { result, settledAt: Date.now() });
      return result;
    })
    .catch((error) => {
      singleFlightCache.delete(key);
      throw error;
    });

  singleFlightCache.set(key, { promise });
  return promise;
}

/** Yorum gönderimi sonrası güncel liste için önbelleği temizler. */
export function invalidateEducationReviewsCache({ educationId, calendarId } = {}) {
  const params = new URLSearchParams();
  if (educationId) params.set("educationId", String(educationId));
  if (calendarId) params.set("calendarId", String(calendarId));
  const query = params.toString();
  if (query) singleFlightCache.delete(`education-reviews:${query}`);
}

export const publicApi = {
  getHeroCourses: () => singleFlight("hero-courses", () => request("/public/hero-courses")),
  getCategories: () => singleFlight("categories", () => request("/public/categories")),
  getUpcomingCourses: () => singleFlight("upcoming-courses", () => request("/public/upcoming-courses")),
  getTopRatedCourses: (limit = 4) =>
    singleFlight(`top-rated-courses:${limit}`, () =>
      request(`/public/top-rated-courses?limit=${encodeURIComponent(limit)}`),
    ),
  getEducationDetail: (slug) => {
    const key = `education-detail:${encodeURIComponent(String(slug ?? ""))}`;
    return singleFlight(key, () => request(`/public/educations/detail/${encodeURIComponent(slug)}`));
  },
  getUpcomingCoursesByFilter: (limit = 4) =>
    singleFlight(`upcoming-courses-by-filter:${limit}`, () =>
      request(`/public/upcoming-courses-by-filter?limit=${encodeURIComponent(limit)}`),
    ),
  getAllTrainings: ({ page = 1, pageSize = 9, search = "", categories = [], salesFilters = [], sort = "newest" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search && String(search).trim()) params.set("search", String(search).trim());
    if (sort) params.set("sort", sort);
    (Array.isArray(categories) ? categories : []).forEach((c) => {
      const s = String(c || "").trim();
      if (s) params.append("category", s);
    });
    (Array.isArray(salesFilters) ? salesFilters : []).forEach((f) => {
      const s = String(f || "").trim();
      if (s) params.append("salesFilter", s);
    });
    const query = params.toString();
    const cacheKey = `all-trainings:${query}`;
    return singleFlight(cacheKey, () => request(`/public/all-trainings?${query}`));
  },
  getEducationCalendar: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).length) {
        searchParams.set(key, String(value));
      }
    });
    const query = searchParams.toString();
    const cacheKey = `education-calendar:${query}`;
    return singleFlight(cacheKey, () => request(`/public/education-calendar${query ? `?${query}` : ""}`));
  },
  validateExamPortalToken: ({ portalToken }) =>
    request("/public/exam-portal/validate-token", {
      method: "POST",
      body: JSON.stringify({ portalToken }),
    }),
  recordExamPortalVisit: ({ portalUrl, portalToken }) =>
    request("/public/exam-portal/visit", {
      method: "POST",
      body: JSON.stringify({ portalUrl, portalToken }),
    }),
  startExamPortal: ({ portalToken }) =>
    request("/public/exam-portal/start", {
      method: "POST",
      body: JSON.stringify({ portalToken }),
    }),
  submitExamPortal: ({ attemptId, answers, reason }) =>
    request(`/public/exam-portal/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers, reason }),
    }),
  searchTrainings: (q, limit) => {
    const params = new URLSearchParams();
    params.set("q", String(q ?? "").trim());
    if (limit != null) params.set("limit", String(limit));
    return request(`/public/search/trainings?${params.toString()}`);
  },
  getEducationReviews: ({ educationId, calendarId } = {}) => {
    const params = new URLSearchParams();
    if (educationId) params.set("educationId", String(educationId));
    if (calendarId) params.set("calendarId", String(calendarId));
    const query = params.toString();
    if (!query) {
      throw new Error("educationId veya calendarId gerekli.");
    }
    return singleFlight(`education-reviews:${query}`, () => request(`/public/education-reviews?${query}`));
  },
};

export const resolvePublicImageUrl = (value) => {
  if (!value) return "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
};

