const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const TOKEN_KEY = "qualityEducationToken";

const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || "Bir hata oluştu.");
    error.code = data?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function requestBlob(path) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "İçerik dosyası alınamadı.");
  }
  return response.blob();
}

export const qualityApi = {
  tokenKey: TOKEN_KEY,
  hasToken: () => Boolean(getToken()),
  logout: () => localStorage.removeItem(TOKEN_KEY),
  getAuthStatus: () => request("/quality/auth/status"),
  login: async ({ username, password }) => {
    const result = await request("/quality/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  me: () => request("/quality/me"),
  getCourses: () => request("/quality/courses"),
  getCourse: (educationId) => request(`/quality/courses/${encodeURIComponent(educationId)}`),
  getMedia: (moduleId, resourceId) =>
    requestBlob(`/quality/media/${encodeURIComponent(moduleId)}/${encodeURIComponent(resourceId)}`),
  saveProgress: (educationId, payload) =>
    request(`/quality/courses/${encodeURIComponent(educationId)}/progress`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getExamLink: (educationId) =>
    request(`/quality/courses/${encodeURIComponent(educationId)}/exam-link`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
