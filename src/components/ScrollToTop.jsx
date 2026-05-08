import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Rota değişince tarayıcı kaydırmasını en üste alır (SPA’da varsayılan davranış değil). */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}
