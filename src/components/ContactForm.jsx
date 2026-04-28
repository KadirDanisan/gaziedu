import { useEffect, useRef } from "react";

function ContactForm({ className = "contact-form-grid" }) {
  const recaptchaRef = useRef(null);

  useEffect(() => {
    let intervalId;

    const renderRecaptcha = () => {
      if (!recaptchaRef.current || !window.grecaptcha) {
        return false;
      }

      if (recaptchaRef.current.dataset.widgetId) {
        return true;
      }

      const widgetId = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: "6LclPlcnAAAAADqKZsm_wPO6Sum1dKe9mZFCjYeO",
      });

      recaptchaRef.current.dataset.widgetId = String(widgetId);
      return true;
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

  return (
    <form className={className}>
      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="name">Adınız Soyadınız *:</label>
          <input id="name" name="name" required />
        </div>
        <div className="contact-field">
          <label htmlFor="email">E-Posta Adresiniz... *:</label>
          <input id="email" name="email" type="email" required />
        </div>
      </div>

      <div className="contact-field">
        <label htmlFor="phone">Telefon Numaranız:</label>
        <input id="phone" name="phone" />
      </div>

      <div className="contact-field">
        <label htmlFor="message">Mesajınız *:</label>
        <textarea id="message" name="message" rows="5" required />
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

      <button className="btn contact-submit" type="submit">
        Gönder
      </button>
    </form>
  );
}

export default ContactForm;
