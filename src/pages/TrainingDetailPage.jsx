import { Link, useLocation, useParams } from "react-router-dom";
import { makeSlug, upcomingCourses } from "../data/homeData";

const defaultHighlights = [
  "Proje yönetiminin temel kavramları ve süreç grupları",
  "PMI metodolojisine uygun planlama, yürütme ve kontrol teknikleri",
  "Gerçek vaka örnekleri, soru setleri ve uygulamalı çalışmalar",
];

const defaultReviews = [
  {
    name: "Veli A.",
    text: "Guzel ve faydali bir egitimdi.",
  },
  {
    name: "Tolgahan K.",
    text: "Egitmenler cok yetkin, programdan bekledigimden fazlasini aldim.",
  },
  {
    name: "Serdar I.",
    text: "Is hayatinda kullanabilecegim sistematik bir bakis acisi kazandirdI.",
  },
];

const sectionTabs = [
  { id: "genel-bilgi", label: "Genel Bilgi" },
  { id: "egitim-icerigi", label: "Egitim Icerigi" },
  { id: "kayit-bilgileri", label: "Kayit Bilgileri" },
  { id: "yorumlar", label: "Yorumlar" },
];

function TrainingDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const stateCourse = location.state?.course;
  const matchedCourse = upcomingCourses.find((item) => makeSlug(item.title) === slug);
  const course = stateCourse || matchedCourse || upcomingCourses[0];

  return (
    <>
      <section className="training-detail-hero">
        <div className="training-detail-hero-inner section">
          <ul className="calendar-breadcrumb">
            <li>
              <Link to="/">Anasayfa</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/tum-egitimler">Egitimler</Link>
            </li>
            <li>/</li>
            <li>{course.title}</li>
          </ul>
          <h1>{course.title}</h1>
          <p className="training-detail-description">
            Gazi Universitesi surekli egitim vizyonu ile hazirlanan bu programda teorik altyapi,
            uygulamali icerik ve guncel sektor deneyimi birlikte sunulur.
          </p>
          <p className="training-detail-linkline">
            ATP Onay linki: <strong>Authorized Training Partner - Credly</strong>
          </p>
          <ul className="rbt-meta training-detail-meta">
            <li>
              <i className="fa-regular fa-user" /> {course.attendees}
            </li>
            <li>
              <i className="fa-regular fa-calendar" /> {course.date}
            </li>
            <li>
              <i className="fa-regular fa-clock" /> {course.duration}
            </li>
            <li>
              <i className="fa-solid fa-globe" /> {course.mode}
            </li>
          </ul>
          <p className="training-detail-code">
            <strong>Course Identifier:</strong> 100202
            <br />
            <strong>PMI Assigned Claim Code:</strong> 4292P16AZS
          </p>
          <div className="training-detail-badges">
            <div className="training-badge">PMI</div>
            <div className="training-badge">ATP</div>
          </div>
        </div>
      </section>

      <section className="training-detail-content section">
        <div className="training-detail-main">
          <div className="training-detail-cover rbt-shadow-box">
            <img src={course.image} alt={course.title} />
          </div>

          <nav className="training-detail-tabs">
            {sectionTabs.map((tab) => (
              <a key={tab.id} href={`#${tab.id}`} className="training-detail-tab">
                {tab.label}
              </a>
            ))}
          </nav>

          <div id="genel-bilgi" className="training-detail-box rbt-shadow-box">
            <h3>Egitimin Amaci ve Katilim Sartlari</h3>
            <div className="training-detail-inline-title">Egitimin Amaci</div>
            <p>
              Bu program, proje yonetimi alaninda sistematik bilgi kazanmak isteyen katilimcilara;
              kapsam, zaman, maliyet, kalite ve risk yonetimi basliklarinda uygulamaya donuk bir
              cerceve sunar.
            </p>
            <ul>
              {defaultHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div id="egitim-icerigi" className="training-detail-box rbt-shadow-box">
            <h3>Egitim Icerigi</h3>
            <p>
              Program; proje yonetimine giris, surec gruplari, bilgi alanlari, paydas yonetimi ve
              sinav hazirlik modullerinden olusur. Icerik, guncel ornekler ve olcu-degerlendirme
              adimlari ile desteklenir.
            </p>
          </div>

          <div id="kayit-bilgileri" className="training-detail-box rbt-shadow-box">
            <h3>Kayit Bilgileri</h3>
            <p>
              Egitim ucreti ve odeme planini gormek icin sisteme uye olabilirsiniz. Kaydinizi online
              tamamlayabilir veya danisman destegiyle telefon uzerinden basvuru yapabilirsiniz.
            </p>
          </div>

          <div id="yorumlar" className="training-detail-box rbt-shadow-box">
            <h3>Katilimci Yorumlari</h3>
            <div className="training-detail-reviews">
              {defaultReviews.map((review) => (
                <article key={review.name} className="training-detail-review">
                  <strong>{review.name}</strong>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="training-detail-sidebar rbt-shadow-box">
          <div className="training-detail-side-image">
            <img src={course.image} alt={course.title} />
            <p>{course.title}</p>
          </div>
          <div className="training-detail-price">20.000,00 TL</div>
          <Link className="btn training-detail-btn" to="/kullanici-islemleri">
            Sepete Ekle
          </Link>
          <Link className="btn btn-outline training-detail-btn" to="/iletisim">
            Bilgi Talep Et
          </Link>
          <ul className="training-detail-side-list">
            <li>
              <span>Egitim Tarihi</span>
              <strong>{course.date}</strong>
            </li>
            <li>
              <span>Egitim Suresi</span>
              <strong>{course.duration}</strong>
            </li>
            <li>
              <span>Kontenjan</span>
              <strong>{course.attendees}</strong>
            </li>
            <li>
              <span>Egitim Turu</span>
              <strong>{course.mode}</strong>
            </li>
          </ul>
          <div className="training-detail-socials">
            <i className="fa-brands fa-facebook-f" />
            <i className="fa-brands fa-linkedin-in" />
            <i className="fa-brands fa-instagram" />
          </div>
          <div className="training-detail-contact">
            <p>Egitimle ilgili detaylar icin</p>
            <a href="tel:+902122832402">0 212 283 24 02</a>
          </div>
        </aside>
      </section>
    </>
  );
}

export default TrainingDetailPage;
