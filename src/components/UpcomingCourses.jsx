import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { makeSlug } from "../data/homeData";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import { SALES_FILTERS } from "../constants/salesFilters";
import CourseCardThumb from "./CourseCardThumb";
import { useAuth } from "../context/AuthContext";

const COURSES_PER_FILTER = 4;

const emptyGroups = SALES_FILTERS.map((item) => ({ key: item.key, label: item.label, total: 0, courses: [] }));

function UpcomingCourses() {
  const [groups, setGroups] = useState(emptyGroups);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getUpcomingCoursesByFilter(COURSES_PER_FILTER)
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray(data?.groups) ? data.groups : [];
        setGroups(
          rows.map((group) => ({
            key: group.key,
            label: group.label,
            total: group.total || 0,
            courses: (Array.isArray(group.courses) ? group.courses : []).map((course, idx) => ({
              ...course,
              id: course.id || `${course.title}-${idx}`,
              image: resolvePublicImageUrl(course.image),
            })),
          })),
        );
      })
      .catch(() => {
        if (!active) return;
        setGroups(emptyGroups);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
          <h2>Eğitimlerimiz</h2>
        </div>
        <Link className="upcoming-link" to="/tum-egitimler">
          Tüm Eğitimleri İncele <i className="fa-solid fa-arrow-right-long" />
        </Link>
      </div>

      {isLoading && <p>Yükleniyor...</p>}

      {groups.map((group) => (
        <div className="upcoming-filter-block" key={group.key}>
          <div className="section-head upcoming-head upcoming-head--filter">
            <div>
              <span className="upcoming-kicker">Eğitim Türü</span>
              <h3>{group.label}</h3>
            </div>
            <Link className="upcoming-link" to={`/tum-egitimler?tur=${encodeURIComponent(group.key)}`}>
              {group.total ? `Tümünü Gör (${group.total})` : "Tümünü Gör"} <i className="fa-solid fa-arrow-right-long" />
            </Link>
          </div>

          <div className="upcoming-grid upcoming-grid--quad">
            {group.courses.map((course) => (
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
            {!isLoading && !group.courses.length && <p>Bu türde eğitim bulunamadı.</p>}
          </div>
        </div>
      ))}
    </section>
  );
}

export default UpcomingCourses;
