import { useEffect, useMemo, useState } from "react"; 
import { NavLink, Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { makeSlug } from "../data/homeData";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "./CourseCardThumb";
import { useAuth } from "../context/AuthContext";

function UpcomingCourses() {
  const [latestCourses, setLatestCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const navigate = UseNavigate();

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getCalendarCourses({ page: 1, pageSize: 3, sort: "newest" })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.educationCalendar) ? data.educationCalendar : [];
        setLatestCourses(
          items.slice(0, 3).map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
            attendees: "Sınırsız Kayıt",
            mode: "Uzaktan Eğitim",
          }))
        );
      })
      .catch(() => {
        if (!active) return;
        setLatestCourses([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const coursesToShow = useMemo(() => latestCourses, [latestCourses]);

  const handleFavoriteClick = async (course) => {
    if (!isLoggedIn) {
      navigate("/kullanici-islemleri");
      return;
    }
    try {
      await toggleFavorite(course.id, course.sourceType || "education");
    } catch (error) {
      console.error(error.message || "Favori işlemi başarısız.");
    }
  };

  return (
    <section className="section upcoming-section">
      <div className="section-head upcoming-head">
        <div>
          <span className="upcoming-kicker">Yeni Dönem Programları</span>
          <h2>Yaklaşan Eğitimler</h2>
        </div>
        <a className="upcoming-link" href="#">
          Tüm Eğitimleri İncele <i className="fa-solid fa-arrow-right-long" />
        </a>
      </div>
      <div className="upcoming-grid">
        {isLoading && <p>Yükleniyor...</p>}
        {coursesToShow.map((course) => (
          <article key={`${course.sourceType || "education"}-${course.id || course.title}`} className="upcoming-card">
            <div className="upcoming-card-media">
              <CourseCardThumb course={course} variant="upcoming" />
              <div className="upcoming-media-overlay" />
              <button
                type="button"
                className={`card-favorite-btn upcoming-card-favorite${isFavorite(course) ? " is-active" : ""}`}
                aria-label={isFavorite(course) ? "Favorilerden çıkar" : "Favorilere ekle"}
                onClick={() => handleFavoriteClick(course)}
              >
                <i className={`${isFavorite(course) ? "fa-solid" : "fa-regular"} fa-heart`} aria-hidden />
              </button>
              <div className="upcoming-date-badge">
                <i className="fa-regular fa-calendar-days" />
                <span>{course.date}</span>
              </div>
            </div>
            <div className="upcoming-card-body">
              <div className="upcoming-meta-row">
                <div className="upcoming-meta-chip upcoming-mode-chip">
                  <i className="fa-solid fa-signal" />
                  <span>{course.mode}</span>
                </div>
                <div className="upcoming-meta-chip">
                  <i className="fa-regular fa-user" />
                  <span>{course.attendees}</span>
                </div>
              </div>
              <div className="upcoming-meta-list">
                <p className="upcoming-meta-item">
                  <i className="fa-regular fa-clock" />
                  <span>{course.duration}</span>
                </p>
              </div>
              <h3>
                <Link to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                  {course.title}
                </Link>
              </h3>
              <div className="upcoming-bottom">
                <p className="upcoming-rating">
                  {course.rating ? (
                    <>
                      <i className="fa-solid fa-star" />
                      <i className="fa-solid fa-star" />
                      <i className="fa-solid fa-star" />
                      <i className="fa-solid fa-star" />
                      <i className="fa-solid fa-star" /> ({course.rating})
                    </>
                  ) : (
                    <span className="upcoming-rating-empty">Henüz değerlendirme yok</span>
                  )}
                </p>
                <Link className="upcoming-card-cta" to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                  Eğitimi İncele <i className="fa-solid fa-arrow-right" />
                </Link>
              </div>
            </div>
          </article>
        ))}
        {!isLoading && !coursesToShow.length && <p>Yaklaşan eğitim bulunamadı.</p>}
      </div>
    </section>
  );
}

export default UpcomingCourses;
