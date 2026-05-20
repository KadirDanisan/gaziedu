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
        <div className="about-media about-media-enter">
          <img
            src="/rektorluk.jpg"
            alt="Hakkımızda"
          />
        </div>
        <div className="about-content about-content-enter">
          <span className="about-badge">Hakkımızda</span>
          <h2>GUZEM Olarak,</h2>
          <p>
            Öğrenci memnuniyetini temel ilke edinen GUZEM, en güncel ve etkin uzaktan eğitim yöntem ve teknolojilerini kullanarak öğrencilerine konusunda seçkin öğretim elemanları, uzaktan eğitimde uzman yönetim ve çalışma ekibi ve deneyimli personeli ile en kaliteli ve doyurucu eğitim hizmetini sunmayı hedef edinmiştir.
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
