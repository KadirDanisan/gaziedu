import { useEffect, useRef, useState } from "react";
import {
  getRecaptchaSiteKey,
  getRecaptchaV2Response,
  isRecaptchaWidgetMounted,
  loadRecaptchaV2Script,
  renderRecaptchaV2,
  resetRecaptchaV2,
} from "../lib/recaptchaV2";

/**
 * reCAPTCHA v2 checkbox widget — container ref'e mount eder.
 */
export function useRecaptchaV2({ theme = "light", size = "normal" } = {}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(undefined);
  const [loadError, setLoadError] = useState("");
  const siteKey = getRecaptchaSiteKey();

  useEffect(() => {
    if (!siteKey) return undefined;

    let cancelled = false;

    const mount = async () => {
      try {
        setLoadError("");
        await loadRecaptchaV2Script();
        if (cancelled || !containerRef.current || isRecaptchaWidgetMounted(widgetIdRef)) return;
        widgetIdRef.current = await renderRecaptchaV2(containerRef.current, { theme, size });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.message || "reCAPTCHA yüklenemedi.");
        }
      }
    };

    mount();
    const intervalId = window.setInterval(() => {
      if (isRecaptchaWidgetMounted(widgetIdRef) || cancelled) {
        window.clearInterval(intervalId);
        return;
      }
      if (containerRef.current) mount();
    }, 300);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [siteKey, theme, size]);

  return {
    containerRef,
    siteKeyConfigured: Boolean(siteKey),
    loadError,
    getResponse: () => {
      if (!isRecaptchaWidgetMounted(widgetIdRef)) return "";
      return getRecaptchaV2Response(widgetIdRef.current);
    },
    reset: () => {
      if (isRecaptchaWidgetMounted(widgetIdRef)) {
        resetRecaptchaV2(widgetIdRef.current);
      }
    },
  };
}
