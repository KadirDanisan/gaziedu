import { useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function ContactForm({ className = "contact-form-grid" }) {
  const recaptchaRef = useRef(null);
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
    let intervalId;

    const renderRecaptcha = () => {
      if (!recaptchaRef.current) {
        return false;
      }

      if (recaptchaRef.current.dataset.widgetId) {
        return true;
      }

      const renderFn = window.grecaptcha && typeof window.grecaptcha.render === "function" ? window.grecaptcha.render : null;
      if (!renderFn) {
        return false;
      }

      try {
        const widgetId = renderFn(recaptchaRef.current, {
          sitekey: "6LclPlcnAAAAADqKZsm_wPO6Sum1dKe9mZFCjYeO",
        });
        recaptchaRef.current.dataset.widgetId = String(widgetId);
        return true;
      } catch {
        return false;
      }
    };

    if (!renderRecaptcha()) {
      intervalId = window.setInterval(() => {
        if (renderRecaptcha()) {
          window.clearInterval(intervalId);
        }
      }, 250);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
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
      const response = await fetch(`${API_BASE_URL}/contact-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Gönderim sırasında hata oluştu.");
      }

      setForm({
        fullName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
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

      <label className="check-line">
        <input type="checkbox" required />
        <span>Gazi Üniversitesi gizlilik politikasını ve KVKK Aydınlatma Metnini okudum.</span>
      </label>

      <label className="check-line">
        <input type="checkbox" required />
        <span>Gazi Üniversitesi tarafından bilgilendirme e-postası almayı kabul ediyorum.</span>
      </label>

      <div ref={recaptchaRef} className="contact-recaptcha" />

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
