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
              <a href="tel:+903122022000">0(312) 202 20 00 </a>
            </p>
            <h3>Faks:</h3>
            <p>
              <a href="tel:+903122213202"> 0(312) 221 32 02</a>
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
              <a href="mailto:rimer@gazi.edu.tr"> rimer@gazi.edu.tr</a>
            </p>
           <h3>Kep Adresi:</h3>
            <p>
              <a href="mailto:gaziuniversitesi@hs01.kep.tr"> gaziuniversitesi@hs01.kep.tr</a>
            </p>
          </div>
        </article>

        <article className="contact-card">
          <div className="contact-card-icon">
            <i className="fa-solid fa-location-dot" />
          </div>
          <div>
            <h3>Adres:</h3>
            <p>06560 Emniyet Mahallesi Bandırma Caddesi No:6/1 Yenimahalle - ANKARA</p>
          </div>
        </article>
      </section>

      <section className="contact-main section">
        <div className="contact-map">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1529.5329329202095!2d32.819784523799804!3d39.93991634179287!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14d34edae61efef5%3A0xe92587004616b9f3!2zR2F6aSDDnG5pdmVyc2l0ZXNpIEXEn2l0aW0gRmFrw7xsdGVzaSBEZWthbmzEscSfxLE!5e0!3m2!1str!2str!4v1778483202325!5m2!1str!2str"
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
