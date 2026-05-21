/**
 * reCAPTCHA v2 (Checkbox — "Ben robot değilim")
 * İstemci: Site Key → kök .env → VITE_RECAPTCHA_SITE_KEY
 * Sunucu: Secret Key → backend/.env → RECAPTCHA_SECRET_KEY
 * v3 anahtarları bu entegrasyonda çalışmaz.
 */

const ONLOAD_CALLBACK = "__gazieduRecaptchaV2Onload";

function normalizeEnvValue(raw) {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/\u200b/g, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, "");
}

export function getRecaptchaSiteKey() {
  return normalizeEnvValue(import.meta.env.VITE_RECAPTCHA_SITE_KEY);
}

function ensureOnloadCallback() {
  if (typeof window === "undefined") return;
  if (window[ONLOAD_CALLBACK]) return;
  window.__gazieduRecaptchaV2Queue = window.__gazieduRecaptchaV2Queue || [];
  window[ONLOAD_CALLBACK] = () => {
    const queue = window.__gazieduRecaptchaV2Queue || [];
    window.__gazieduRecaptchaV2Queue = [];
    queue.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  };
}

let scriptLoadPromise = null;

/** Google önerisi: api.js?onload=...&render=explicit */
export function loadRecaptchaV2Script() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tarayıcı ortamı gerekli."));
  }
  if (window.grecaptcha?.render) {
    return Promise.resolve();
  }

  ensureOnloadCallback();

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const done = () => resolve();
      window.__gazieduRecaptchaV2Queue.push(done);

      const existing = document.querySelector("script[data-gaziedu-recaptcha-v2='1']");
      if (existing) {
        existing.addEventListener("load", () => {
          if (window.grecaptcha?.render) resolve();
        }, { once: true });
        existing.addEventListener("error", () => reject(new Error("reCAPTCHA script yüklenemedi.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?onload=${ONLOAD_CALLBACK}&render=explicit&hl=tr`;
      script.async = true;
      script.defer = true;
      script.dataset.gazieduRecaptchaV2 = "1";
      script.onerror = () => reject(new Error("reCAPTCHA script yüklenemedi."));
      document.head.appendChild(script);
    });
  }

  return scriptLoadPromise;
}

export function isRecaptchaWidgetMounted(widgetIdRef) {
  return typeof widgetIdRef.current === "number";
}

/**
 * @param {HTMLElement | null} container
 * @param {{ sitekey?: string, theme?: 'light'|'dark', size?: 'normal'|'compact' }} [options]
 * @returns {number | undefined} widget id (0 dahil geçerli)
 */
export async function renderRecaptchaV2(container, options = {}) {
  const sitekey = options.sitekey || getRecaptchaSiteKey();
  if (!sitekey || !container) return undefined;

  await loadRecaptchaV2Script();

  await new Promise((resolve) => {
    if (window.grecaptcha?.ready) {
      window.grecaptcha.ready(resolve);
    } else {
      resolve();
    }
  });

  if (typeof window.grecaptcha?.render !== "function") {
    throw new Error("reCAPTCHA API hazır değil.");
  }

  return window.grecaptcha.render(container, {
    sitekey,
    theme: options.theme || "light",
    size: options.size || "normal",
  });
}

export function getRecaptchaV2Response(widgetId) {
  if (typeof widgetId !== "number" || !window.grecaptcha?.getResponse) {
    return "";
  }
  return window.grecaptcha.getResponse(widgetId) || "";
}

export function resetRecaptchaV2(widgetId) {
  if (typeof widgetId !== "number" || !window.grecaptcha?.reset) return;
  window.grecaptcha.reset(widgetId);
}
