import { useState } from "react";
import { Link } from "react-router-dom";
import { useRecaptchaV2 } from "../hooks/useRecaptchaV2";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function ContactForm({ className = "contact-form-grid" }) {
  const {
    containerRef: recaptchaContainerRef,
    siteKeyConfigured,
    loadError: recaptchaLoadError,
    getResponse: getRecaptchaResponse,
    reset: resetRecaptcha,
  } = useRecaptchaV2({ theme: "light", size: "normal" });

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      if (siteKeyConfigured) {
        if (recaptchaLoadError) {
          throw new Error(recaptchaLoadError);
        }
        const recaptchaToken = getRecaptchaResponse();
        if (!recaptchaToken) {
          setStatus({
            type: "error",
            message: 'Lütfen "Ben robot değilim" kutusunu işaretleyin.',
          });
          setIsSubmitting(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/contact-forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, recaptchaToken }),
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
      } else {
        const response = await fetch(`${API_BASE_URL}/contact-forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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
      }

      setForm({
        fullName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
      resetRecaptcha();
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

      <div className="contact-recaptcha-block">
        <span className="contact-recaptcha-label">Güvenlik doğrulaması</span>
        {!siteKeyConfigured ? (
          <p className="contact-recaptcha-warn">
            reCAPTCHA yapılandırılmamış. Kök dizinde <code>.env</code> dosyasına{" "}
            <code>VITE_RECAPTCHA_SITE_KEY</code> (Site Key), <code>backend/.env</code> içine{" "}
            <code>RECAPTCHA_SECRET_KEY</code> (Secret Key) ekleyin; ardından dev sunucusunu yeniden başlatın.
          </p>
        ) : (
          <>
            <div ref={recaptchaContainerRef} className="contact-recaptcha" />
            {recaptchaLoadError ? (
              <p className="admin-form-error contact-recaptcha-warn">{recaptchaLoadError}</p>
            ) : null}
          </>
        )}
      </div>

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
