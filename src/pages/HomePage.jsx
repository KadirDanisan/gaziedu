import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import UpcomingCourses from "../components/UpcomingCourses";
import FollowerCourses from "../components/followerCourses";
import AboutMediaCarousel from "../components/AboutMediaCarousel";
import FaqContact from "../components/FaqContact";
import Partners from "../components/Partners";
import NewsletterSection from "../components/NewsletterSection";

const ABOUT_VALUES = [
  "Yenilikçilik",
  "Şeffaflık",
  "Erişilebilirlik",
  "Güvenirlik",
  "Kapsayıcılık",
  "Esneklik",
];

function HomePage() {
  return (
    <>
      <Hero />
      <FollowerCourses />
      <section className="section about" id="hakkimizda">
        <AboutMediaCarousel />
        <div className="about-content about-content-enter">
          <span className="about-badge">Hakkımızda</span>
          <h2>GUZEM Olarak,</h2>
          <p>
            Öğrenci memnuniyetini temel ilke edinen GUZEM, en güncel ve etkin uzaktan eğitim yöntem ve teknolojilerini kullanarak öğrencilerine konusunda seçkin öğretim elemanları, uzaktan eğitimde uzman yönetim ve çalışma ekibi ve deneyimli personeli ile en kaliteli ve doyurucu eğitim hizmetini sunmayı hedef edinmiştir.
          </p>
          <div className="about-values">
            <h2>Değerler</h2>
            <ul className="about-values-list">
              {ABOUT_VALUES.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </div>
          <Link className="btn about-btn" to="/hakkimizda">
            Detaylı Bilgi
          </Link>
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
