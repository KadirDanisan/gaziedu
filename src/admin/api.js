const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("adminToken");

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

  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Bir hata oluştu.");
  }
  return data;
}

export const adminApi = {
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
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
  uploadExamDoc: (file, mode) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    return request("/admin/uploads/exam-doc", { method: "POST", body: formData });
  },
};
