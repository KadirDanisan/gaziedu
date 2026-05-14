const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("adminToken");

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
  getBootstrap: () => request("/admin/bootstrap"),
  getDashboard: () => request("/admin/dashboard"),
  getActivityLogs: (page = 1, pageSize = 100) => request(`/admin/activity-logs?page=${page}&pageSize=${pageSize}`),
  getModule: (moduleName, page = 1, search = "", readStatus = "all") =>
    request(`/admin/${moduleName}?page=${page}&search=${encodeURIComponent(search)}&readStatus=${encodeURIComponent(readStatus)}`),
  createItem: (moduleName, payload) => request(`/admin/${moduleName}`, { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (moduleName, id, payload) => request(`/admin/${moduleName}/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteItem: (moduleName, id) => request(`/admin/${moduleName}/${id}`, { method: "DELETE" }),
  updatePermission: (id, payload) => request(`/admin-role-permissions/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
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
  uploadEducationContentDoc: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/admin/uploads/education-content-doc", { method: "POST", body: formData });
  },
  uploadExamDoc: (file, mode, { targetDifficulty = "medium", poolQuestionCount = 60 } = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("targetDifficulty", targetDifficulty);
    formData.append("poolQuestionCount", String(poolQuestionCount));
    return request("/admin/uploads/exam-doc", { method: "POST", body: formData });
  },
  getExamPortalVisits: (page = 1, search = "") =>
    request(`/admin/exam-portal/visits?page=${page}&search=${encodeURIComponent(search)}`),
  deleteExamPortalVisit: (id) => request(`/admin/exam-portal/visits/${id}`, { method: "DELETE" }),
  getExamPortalLimitExceeded: (page = 1, search = "") =>
    request(`/admin/exam-portal/limit-exceeded?page=${page}&search=${encodeURIComponent(search)}`),
  deleteExamPortalLimitExceeded: (payload) =>
    request("/admin/exam-portal/limit-exceeded", { method: "DELETE", body: JSON.stringify(payload) }),
  getExamResults: ({ page = 1, search = "", educationCode = "", nationalId = "", certificateOnly = false } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (educationCode) params.set("educationCode", educationCode);
    if (nationalId) params.set("nationalId", nationalId);
    if (certificateOnly) params.set("certificateOnly", "1");
    return request(`/admin/exam-results?${params.toString()}`);
  },
  deleteExamResult: (id) => request(`/admin/exam-results/${id}`, { method: "DELETE" }),
  markExamResultPaymentReceived: (id) =>
    request(`/admin/exam-results/${id}/payment-received`, {
      method: "PATCH",
      body: JSON.stringify({ paymentReceived: true }),
    }),
  getMessagingAdmins: () => request("/admin/messaging/admins"),
  getMessagingAnnouncements: (page = 1) => request(`/admin/messaging/announcements?page=${page}`),
  postMessagingAnnouncement: (payload) => request("/admin/messaging/announcements", { method: "POST", body: JSON.stringify(payload) }),
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
