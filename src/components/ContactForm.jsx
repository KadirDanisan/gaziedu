import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

/** .env tırnak / görünmez boşluk / yanlış kopyala-yapıştır sitekey hatalarını azaltır. */
function normalizeRecaptchaSiteKey(raw) {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/\u200b/g, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, "");
}

const RECAPTCHA_SITE_KEY = normalizeRecaptchaSiteKey(import.meta.env.VITE_RECAPTCHA_SITE_KEY);

/** grecaptcha.render ilk widget için 0 dönebilir; !ref ile kontrol etmek hataya yol açar. */
function hasRecaptchaWidget(widgetIdRef) {
  return typeof widgetIdRef.current === "number";
}

function loadRecaptchaScriptOnce() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.grecaptcha) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-app-recaptcha='1']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA script")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.dataset.appRecaptcha = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("reCAPTCHA script"));
    document.head.appendChild(s);
  });
}

function ContactForm({ className = "contact-form-grid" }) {
  const recaptchaContainerRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(undefined);
  const [registerAcceptKvkk, setRegisterAcceptKvkk] = useState(false);
  const [registerAcceptTerms, setRegisterAcceptTerms] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return undefined;

    let cancelled = false;

    const mountWidget = async () => {
      try {
        await loadRecaptchaScriptOnce();
        if (cancelled || !recaptchaContainerRef.current || hasRecaptchaWidget(recaptchaWidgetIdRef)) return;
        await new Promise((r) => {
          if (window.grecaptcha?.ready) window.grecaptcha.ready(r);
          else r();
        });
        if (cancelled || !recaptchaContainerRef.current || hasRecaptchaWidget(recaptchaWidgetIdRef)) return;
        const renderFn = window.grecaptcha?.render;
        if (typeof renderFn !== "function") return;
        recaptchaWidgetIdRef.current = renderFn(recaptchaContainerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          theme: "light",
          hl: "tr",
        });
      } catch {
        // script veya render hatası — form yine de gönderilebilir; backend secret yoksa geçer
      }
    };

    const tryMount = () => {
      if (recaptchaContainerRef.current && !hasRecaptchaWidget(recaptchaWidgetIdRef)) {
        mountWidget();
      }
    };

    tryMount();
    const intervalId = window.setInterval(() => {
      if (hasRecaptchaWidget(recaptchaWidgetIdRef)) {
        window.clearInterval(intervalId);
        return;
      }
      tryMount();
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      let recaptchaToken = "";
      if (RECAPTCHA_SITE_KEY) {
        const wid = recaptchaWidgetIdRef.current;
        recaptchaToken =
          typeof wid === "number" && window.grecaptcha && typeof window.grecaptcha.getResponse === "function"
            ? window.grecaptcha.getResponse(wid) || ""
            : "";
        if (!recaptchaToken) {
          setStatus({
            type: "error",
            message: 'Lütfen "Ben robot değilim" doğrulamasını tamamlayın.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch(`${API_BASE_URL}/contact-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken: recaptchaToken || undefined }),
      });
      const raw = await response.text();
      let result = null;
      if (raw) {
        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error("Sunucu yanıtı okunamadı.");
        }
      }
      if (!response.ok) {
        throw new Error(result?.message || "Gönderim sırasında hata oluştu.");
      }

      setForm({
        fullName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
      if (RECAPTCHA_SITE_KEY && typeof recaptchaWidgetIdRef.current === "number" && window.grecaptcha?.reset) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
      setStatus({ type: "success", message: "Mesajınız başarıyla gönderildi." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Bir hata oluştu." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="name">Adınız Soyadınız *:</label>
          <input id="name" name="fullName" value={form.fullName} onChange={handleChange} required />
        </div>
        <div className="contact-field">
          <label htmlFor="email">E-Posta Adresiniz... *:</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
      </div>

      <div className="contact-field">
        <label htmlFor="phone">Telefon Numaranız:</label>
        <input id="phone" name="phone" value={form.phone} onChange={handleChange} />
      </div>

      <div className="contact-field">
        <label htmlFor="subject">Konu:</label>
        <input id="subject" name="subject" value={form.subject} onChange={handleChange} />
      </div>

      <div className="contact-field">
        <label htmlFor="message">Mesajınız *:</label>
        <textarea id="message" name="message" rows="5" value={form.message} onChange={handleChange} required />
      </div>

      <div className="auth-consent" role="group" aria-label="Yasal onaylar">
        <label className="auth-check auth-check--wrap">
          <input
            type="checkbox"
            checked={registerAcceptKvkk}
            onChange={(event) => setRegisterAcceptKvkk(event.target.checked)}
          />
          <span>
            <Link to="/kvkk-aydinlatma-metni" target="_blank" rel="noopener noreferrer">
              Kişisel Verilerin Korunması Hakkında Aydınlatma Metni
            </Link>
            &apos;ni okudum ve kabul ediyorum.
          </span>
        </label>
        <label className="auth-check auth-check--wrap">
          <input
            type="checkbox"
            checked={registerAcceptTerms}
            onChange={(event) => setRegisterAcceptTerms(event.target.checked)}
          />
          <span>
            <Link to="/kullanim-kurallari-ve-gizlilik" target="_blank" rel="noopener noreferrer">
              Web Sitesi Kullanım Kuralları ve Gizlilik Sözleşmesi
            </Link>
            &apos;ni okudum ve kabul ediyorum.
          </span>
        </label>
      </div>

      {!RECAPTCHA_SITE_KEY ? (
        <p className="admin-form-error" style={{ fontSize: "0.9rem", maxWidth: "42rem" }}>
          reCAPTCHA bu sitede yapılandırılmamış. Sunucuda <code>RECAPTCHA_SECRET_KEY</code> varsa, site anahtarını
          proje <strong>kökündeki</strong> <code>.env</code> dosyasına <code>VITE_RECAPTCHA_SITE_KEY=...</code> olarak
          yazıp <code>npm run build</code> ile yeniden derleyin (yalnızca backend <code>.env</code> yeterli değildir).
        </p>
      ) : (
        <>
          <div ref={recaptchaContainerRef} className="contact-recaptcha" />
          {import.meta.env.DEV ? (
            <p className="contact-recaptcha-hint" style={{ fontSize: "0.85rem", opacity: 0.85, maxWidth: "42rem" }}>
              Google &quot;Geçersiz site anahtarı&quot; veriyorsa: konsolda <strong>reCAPTCHA v2 — Checkbox</strong> kaydı
              açın; <strong>Site Key</strong> → kök <code>.env</code> <code>VITE_RECAPTCHA_SITE_KEY</code>,{" "}
              <strong>Secret Key</strong> → <code>backend/.env</code> <code>RECAPTCHA_SECRET_KEY</code> (yer
              değiştirmeyin). v3 anahtarı bu formda çalışmaz.
            </p>
          ) : null}
        </>
      )}

      <button className="btn contact-submit" type="submit" disabled={isSubmitting}>
        Gönder
      </button>
      {status.message && (
        <p className={status.type === "error" ? "admin-form-error" : ""}>{status.message}</p>
      )}
    </form>
  );
}

export default ContactForm;
