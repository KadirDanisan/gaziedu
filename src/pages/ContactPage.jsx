import ContactForm from "../components/ContactForm";

function ContactPage() {
  return (
    <>
      <section className="contact-page-hero">
        <div className="contact-page-hero-inner">
          <span className="about-badge">İletişim</span>
          <h1>İletişim Bilgilerimiz</h1>
        </div>
      </section>

      <section className="contact-cards section">
        <article className="contact-card">
          <div className="contact-card-icon">
            <i className="fa-solid fa-headphones" />
          </div>
          <div>
            <h3>Telefon:</h3>
            <p>
              <a href="tel:+902122832402">0 212 283 24 02</a>
            </p>
          </div>
        </article>

        <article className="contact-card">
          <div className="contact-card-icon">
            <i className="fa-regular fa-envelope" />
          </div>
          <div>
            <h3>E-Mail:</h3>
            <p>
              <a href="mailto:info@gazi.edu.tr">info@gazi.edu.tr</a>
            </p>
          </div>
        </article>

        <article className="contact-card">
          <div className="contact-card-icon">
            <i className="fa-solid fa-location-dot" />
          </div>
          <div>
            <h3>Adres:</h3>
            <p>Büyükdere Cad. No:119 Nevtron Plaza Kat 4 Esentepe - Şişli - İstanbul</p>
          </div>
        </article>
      </section>

      <section className="contact-main section">
        <div className="contact-map">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3008.0610582056643!2d29.002056076524077!3d41.06765797134231!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14cab6686125ac93%3A0x7d4e2f97e5dc5071!2zxLBzdGFuYnVsIMSwbnN0aXR1dGU!5e0!3m2!1str!2str!4v1689753339244!5m2!1str!2str"
            width="100%"
            height="605"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Gazi Üniversitesi harita konumu"
          />
        </div>

        <div className="contact-form-panel">
          <h3>İletişim Formu</h3>
          <ContactForm className="contact-page-form" />
        </div>
      </section>
    </>
  );
}

export default ContactPage;
