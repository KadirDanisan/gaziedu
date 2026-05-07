import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Kayıt sırasında hata oluştu.");
      }

      setEmail("");
      setStatus({ type: "success", message: "Bülten kaydınız başarıyla alındı." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Bir hata oluştu." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="newsletter">
      <div className="newsletter-inner">
        <h2>Bülten Üyeliği</h2>
        <p className="newsletter-subtitle">
          Yeni eğitimlerimiz ve güncellemelerimizden haberdar olabilirsiniz.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="E-Posta Adresiniz..."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="btn newsletter-btn" type="submit" disabled={isSubmitting}>
            KAYIT OL
          </button>
        </form>
        {status.message && <p className={status.type === "error" ? "admin-form-error" : ""}>{status.message}</p>}
        <p className="newsletter-note">
          Bülten üyeliğinden ayrılmak için iletişim formumuzu kullanabilir veya önceden aldığınız
          bir e-bülten içerisindeki bağlantıyı kullanarak talebilinizi iletebilirsiniz.
        </p>
      </div>
    </section>
  );
}

export default NewsletterSection;
