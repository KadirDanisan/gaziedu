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
    throw new Error(data?.message || "Bir hata oluştu.");
  }
  return data;
}

const singleFlightCache = new Map();

function singleFlight(key, fetcher) {
  if (singleFlightCache.has(key)) {
    return singleFlightCache.get(key);
  }
  const promise = fetcher().catch((error) => {
    singleFlightCache.delete(key);
    throw error;
  });
  singleFlightCache.set(key, promise);
  return promise;
}

export const publicApi = {
  getHeroCourses: () => singleFlight("hero-courses", () => request("/public/hero-courses")),
  getCategories: () => singleFlight("categories", () => request("/public/categories")),
  getUpcomingCourses: () => singleFlight("upcoming-courses", () => request("/public/upcoming-courses")),
  getTopRatedCourses: () => singleFlight("top-rated-courses", () => request("/public/top-rated-courses")),
  getEducationDetail: (slug) => request(`/public/educations/detail/${encodeURIComponent(slug)}`),
  getAllTrainings: ({ page = 1, pageSize = 9, search = "", categories = [], sort = "newest" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search && String(search).trim()) params.set("search", String(search).trim());
    if (sort) params.set("sort", sort);
    (Array.isArray(categories) ? categories : []).forEach((c) => {
      const s = String(c || "").trim();
      if (s) params.append("category", s);
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
    return request(`/public/education-reviews?${query}`);
  },
};

export const resolvePublicImageUrl = (value) => {
  if (!value) return "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
};

