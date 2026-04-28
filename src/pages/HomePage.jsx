import Hero from "../components/Hero";
import UpcomingCourses from "../components/UpcomingCourses";
import FaqContact from "../components/FaqContact";
import Partners from "../components/Partners";
import NewsletterSection from "../components/NewsletterSection";

function HomePage() {
  return (
    <>
      <Hero />
      <section className="section about" id="hakkimizda">
        <div className="about-media">
          <img
            src="/main1.png"
            alt="Hakkımızda"
          />
        </div>
        <div className="about-content">
          <span className="about-badge">Hakkımızda</span>
          <h2>Gazi Üniversitesi olarak,</h2>
          <p>
            Gelecekte birey, kurum ve toplumların şekillenmesinde en belirleyici etkenin bilgi
            olacağının farkındayız. Bu sebeptendir ki, Türkiye&apos;nin en seçkin üniversiteleri ile
            çeşitli eğitim konularında işbirliğimiz bulunmaktadır. Amacımız İş dünyasıyla akademik
            dünya arasında köprü olmak; uygulanabilir bilgi sağlayan, davranış değişikliği yaratan
            eğitimler hazırlamak; birey ve kurumların modern eğitim metodolojileri bağlamında eğitim
            almalarını sağlamaktır.
          </p>
          <a className="btn about-btn" href="#">
            Detaylı Bilgi
          </a>
        </div>
      </section>
      <UpcomingCourses />
      <FaqContact />
      <Partners />
      <NewsletterSection />
    </>
  );
}

export default HomePage;
