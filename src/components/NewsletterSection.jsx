function NewsletterSection() {
  return (
    <section className="newsletter">
      <div className="newsletter-inner">
        <h2>Bülten Üyeliği</h2>
        <p className="newsletter-subtitle">
          Yeni eğitimlerimiz ve güncellemelerimizden haberdar olabilirsiniz.
        </p>
        <form>
          <input type="email" placeholder="E-Posta Adresiniz..." />
          <button className="btn newsletter-btn">KAYIT OL</button>
        </form>
        <p className="newsletter-note">
          Bülten üyeliğinden ayrılmak için iletişim formumuzu kullanabilir veya önceden aldığınız
          bir e-bülten içerisindeki bağlantıyı kullanarak talebilinizi iletebilirsiniz.
        </p>
      </div>
    </section>
  );
}

export default NewsletterSection;
