/**
 * Giriş bilgisi hatırlama: önce localStorage (güvenilir), ek olarak çerez.
 * Aynı origin'de kalmalısınız (ör. hep localhost veya hep 127.0.0.1).
 */
const STORAGE_KEY = "gaziedu_remember_login";
const COOKIE_NAME = "gaziedu_remember_login";
/** 30 gün */
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function writeCookie(payloadObj) {
  const payload = encodeURIComponent(
    JSON.stringify({
      email: String(payloadObj.email ?? ""),
      password: String(payloadObj.password ?? ""),
    }),
  );
  document.cookie = `${COOKIE_NAME}=${payload}; max-age=${MAX_AGE_SEC}; path=/; SameSite=Lax`;
}

function readCookie() {
  const prefix = `${COOKIE_NAME}=`;
  const parts = document.cookie.split(";").map((p) => p.trim());
  const row = parts.find((p) => p.startsWith(prefix));
  if (!row) return null;
  try {
    const raw = decodeURIComponent(row.slice(prefix.length));
    const data = JSON.parse(raw);
    if (!data || typeof data.email !== "string") return null;
    return {
      email: data.email,
      password: typeof data.password === "string" ? data.password : "",
    };
  } catch {
    return null;
  }
}

function eraseCookie() {
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}

export function setRememberLogin({ email, password }) {
  const payload = {
    email: String(email ?? ""),
    password: String(password ?? ""),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // gizli sekme / devre dışı depolama
  }
  try {
    writeCookie(payload);
  } catch {
    // yoksay
  }
}

export function getRememberLogin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.email === "string" && data.email.trim() !== "") {
        return {
          email: data.email,
          password: typeof data.password === "string" ? data.password : "",
        };
      }
    }
  } catch {
    // yoksay
  }
  const fromCookie = readCookie();
  if (fromCookie?.email?.trim()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fromCookie));
    } catch {
      // yoksay
    }
    return fromCookie;
  }
  return null;
}

export function clearRememberLogin() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // yoksay
  }
  eraseCookie();
}

/** Eski import adları */
export const setRememberLoginCookie = setRememberLogin;
export const getRememberLoginCookie = getRememberLogin;
export const clearRememberLoginCookie = clearRememberLogin;
