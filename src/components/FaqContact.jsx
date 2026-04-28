import { faqItems } from "../data/homeData";
import ContactForm from "./ContactForm";

function FaqContact() {
  return (
    <section className="section split faq-contact-section">
      <div className="faq-column">
        <h2>Sıkça Sorulan Sorular</h2>
        <div className="faq-accordion">
          {faqItems.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                {item.question}
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
      <div className="contact-column">
        <h2>İletişim Formu</h2>
        <ContactForm />
      </div>
    </section>
  );
}

export default FaqContact;
