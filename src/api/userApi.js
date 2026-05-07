const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getUserToken = () => localStorage.getItem("userToken");

async function request(path, options = {}) {
  const token = getUserToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export const userApi = {
  register: (payload) => request("/users/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/users/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/users/me"),
};
