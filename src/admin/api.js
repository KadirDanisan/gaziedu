const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("adminToken");

const adminFlightCache = new Map();

function adminSingleFlight(key, fetcher) {
  const now = Date.now();
  const cached = adminFlightCache.get(key);
  if (cached) {
    if (cached.promise) return cached.promise;
    if (cached.result !== undefined && now - cached.settledAt < 5000) {
      return Promise.resolve(cached.result);
    }
    adminFlightCache.delete(key);
  }

  const promise = fetcher()
    .then((result) => {
      adminFlightCache.set(key, { result, settledAt: Date.now() });
      return result;
    })
    .catch((error) => {
      adminFlightCache.delete(key);
      throw error;
    });

  adminFlightCache.set(key, { promise });
  return promise;
}

export function invalidateAdminCache(...keys) {
  keys.forEach((key) => adminFlightCache.delete(key));
}

export function invalidateAdminCachePrefix(prefix) {
  for (const key of adminFlightCache.keys()) {
    if (key.startsWith(prefix)) {
      adminFlightCache.delete(key);
    }
  }
}

function moduleListKey(moduleName, page, search, readStatus) {
  return `admin-module:${moduleName}:${page}:${search}:${readStatus}`;
}

/** 502/503/504 veya yanlış URL: gövde HTML olur; response.json() SyntaxError verir. */
async function readJsonBody(response) {
  if (response.status === 204) return null;
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const gateway = response.status === 502 || response.status === 503 || response.status === 504;
    if (gateway || !response.ok) {
      throw new Error(
        "API geçici olarak yanıt veremedi (çoğunlukla 502: Node süreci kapalı, çöküyor veya Nginx upstream zaman aşımı). Sunucuda gaziedu-backend ve proxy loglarına bakın.",
      );
    }
    throw new Error("Sunucu JSON yerine beklenmeyen içerik döndürdü; VITE_API_BASE_URL ve /api proxy yolunu kontrol edin.");
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await readJsonBody(response);
  if (!response.ok) {
    throw new Error(data?.message || "Bir hata oluştu.");
  }
  return data;
}

export const adminApi = {
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  patchAdminProfile: (payload) => request("/auth/admin/me", { method: "PATCH", body: JSON.stringify(payload) }),
  getMyPermissions: () => adminSingleFlight("admin-my-permissions", () => request("/admin/my-permissions")),
  getAllPermissions: () => adminSingleFlight("admin-all-permissions", () => request("/admin/permissions")),
  getFormOptions: () => adminSingleFlight("admin-form-options", () => request("/admin/form-options")),
  getDashboard: () => adminSingleFlight("admin-dashboard", () => request("/admin/dashboard")),
  getActivityLogs: (page = 1, pageSize = 100) => {
    const key = `admin-activity-logs:${page}:${pageSize}`;
    return adminSingleFlight(key, () => request(`/admin/activity-logs?page=${page}&pageSize=${pageSize}`));
  },
  getModule: (moduleName, page = 1, search = "", readStatus = "all") => {
    const key = moduleListKey(moduleName, page, search, readStatus);
    return adminSingleFlight(key, () =>
      request(`/admin/${moduleName}?page=${page}&search=${encodeURIComponent(search)}&readStatus=${encodeURIComponent(readStatus)}`),
    );
  },
  createItem: (moduleName, payload) => {
    invalidateAdminCachePrefix(`admin-module:${moduleName}:`);
    return request(`/admin/${moduleName}`, { method: "POST", body: JSON.stringify(payload) });
  },
  updateItem: (moduleName, id, payload) => {
    invalidateAdminCachePrefix(`admin-module:${moduleName}:`);
    return request(`/admin/${moduleName}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteItem: (moduleName, id) => {
    invalidateAdminCachePrefix(`admin-module:${moduleName}:`);
    return request(`/admin/${moduleName}/${id}`, { method: "DELETE" });
  },
  updatePermission: (id, payload) => {
    invalidateAdminCache("admin-all-permissions", "admin-my-permissions");
    return request(`/admin-role-permissions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  uploadInstitutionLogo: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/admin/uploads/institution-logo", { method: "POST", body: formData });
  },
  uploadEducationImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/admin/uploads/education-image", { method: "POST", body: formData });
  },
  getEducationModules: (educationId) => {
    const key = `admin-education-modules:${educationId}`;
    return adminSingleFlight(key, () => request(`/admin/education-modules?educationId=${encodeURIComponent(educationId)}`));
  },
  uploadEducationContentDoc: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/admin/uploads/education-content-doc", { method: "POST", body: formData });
  },
  uploadExamDoc: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/admin/uploads/exam-doc", { method: "POST", body: formData });
  },
  getExamPortalVisits: ({ page = 1, search = "", period = "all" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (period && period !== "all") params.set("period", period);
    const query = params.toString();
    const key = `admin-exam-portal-visits:${query}`;
    return adminSingleFlight(key, () => request(`/admin/exam-portal/visits?${query}`));
  },
  deleteExamPortalVisit: (id) => {
    invalidateAdminCachePrefix("admin-exam-portal-visits:");
    invalidateAdminCachePrefix("admin-exam-portal-limit:");
    return request(`/admin/exam-portal/visits/${id}`, { method: "DELETE" });
  },
  getExamPortalLimitExceeded: ({ page = 1, search = "", period = "all" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (period && period !== "all") params.set("period", period);
    const query = params.toString();
    const key = `admin-exam-portal-limit:${query}`;
    return adminSingleFlight(key, () => request(`/admin/exam-portal/limit-exceeded?${query}`));
  },
  deleteExamPortalLimitExceeded: (payload) => {
    invalidateAdminCachePrefix("admin-exam-portal-visits:");
    invalidateAdminCachePrefix("admin-exam-portal-limit:");
    return request("/admin/exam-portal/limit-exceeded", { method: "DELETE", body: JSON.stringify(payload) });
  },
  getExamPortalTestToken: (educationCode) =>
    request("/admin/exam-portal/test-token", { method: "POST", body: JSON.stringify({ educationCode }) }),
  getExamResults: ({ page = 1, search = "", educationCode = "", nationalId = "", certificateOnly = false, period = "all" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (educationCode) params.set("educationCode", educationCode);
    if (nationalId) params.set("nationalId", nationalId);
    if (certificateOnly) params.set("certificateOnly", "1");
    if (period && period !== "all") params.set("period", period);
    const query = params.toString();
    const key = `admin-exam-results:${query}`;
    return adminSingleFlight(key, () => request(`/admin/exam-results?${query}`));
  },
  getCertificateList: ({ page = 1, search = "", period = "all" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (period && period !== "all") params.set("period", period);
    const query = params.toString();
    const key = `admin-certificate-list:${query}`;
    return adminSingleFlight(key, () => request(`/admin/certificate-list?${query}`));
  },
  getCertificateListEdevletExport: ({ search = "", period = "all" } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (period && period !== "all") params.set("period", period);
    const query = params.toString();
    return request(`/admin/certificate-list/edevlet-export?${query}`);
  },
  generateCertificatePdf: async (id) => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/admin/certificate-list/${id}/generate-pdf`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let message = "Sertifika oluşturulamadı.";
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {
        /* PDF veya boş gövde */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] || `sertifika_${id}.pdf`;
    return { blob, fileName };
  },
  deleteExamResult: (id) => {
    invalidateAdminCachePrefix("admin-exam-results:");
    return request(`/admin/exam-results/${id}`, { method: "DELETE" });
  },
  markExamResultPaymentReceived: (id) => {
    invalidateAdminCachePrefix("admin-exam-results:");
    return request(`/admin/exam-results/${id}/payment-received`, {
      method: "PATCH",
      body: JSON.stringify({ paymentReceived: true }),
    });
  },
  getMessagingAdmins: () =>
    adminSingleFlight("admin-messaging-admins", () => request("/admin/messaging/admins")),
  getMessagingAnnouncements: (page = 1) => {
    const key = `admin-messaging-announcements:${page}`;
    return adminSingleFlight(key, () => request(`/admin/messaging/announcements?page=${page}`));
  },
  postMessagingAnnouncement: (payload) => {
    invalidateAdminCachePrefix("admin-messaging-announcements:");
    return request("/admin/messaging/announcements", { method: "POST", body: JSON.stringify(payload) });
  },
  getMessagingDmThreads: () => request("/admin/messaging/dm/threads"),
  getMessagingDmMessages: (peerId) => request(`/admin/messaging/dm/peers/${peerId}/messages`),
  postMessagingDmMessage: (peerId, body) =>
    request(`/admin/messaging/dm/peers/${peerId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  getMessagingGroups: () => request("/admin/messaging/groups"),
  postMessagingGroup: (payload) => request("/admin/messaging/groups", { method: "POST", body: JSON.stringify(payload) }),
  getMessagingGroupMessages: (groupId) => request(`/admin/messaging/groups/${groupId}/messages`),
  postMessagingGroupMessage: (groupId, body) =>
    request(`/admin/messaging/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
};
