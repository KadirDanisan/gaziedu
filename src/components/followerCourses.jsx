import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { makeSlug } from "../data/homeData";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "./CourseCardThumb";
import { useAuth } from "../context/AuthContext";

function FollowerCourses() {
  const [topRatedCourses, setTopRatedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getEducationsCatalog({ page: 1, pageSize: 3, sort: "most_reviews" })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.data) ? data.data : [];
        setTopRatedCourses(
          items.slice(0, 3).map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
            attendees: course.attendees || "Sınırsız Kayıt",
            mode: course.mode || "Uzaktan Eğitim",
          }))
        );
      })
      .catch(() => {
        if (!active) return;
        setTopRatedCourses([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const coursesToShow = useMemo(() => topRatedCourses, [topRatedCourses]);

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
          <span className="upcoming-kicker">Katılımcıların Tercihi</span>
          <h2>En Çok Tercih Edilen Eğitimler</h2>
        </div>
        <Link className="upcoming-link" to="/tum-egitimler?sort=most_reviews">
          Tüm Eğitimleri İncele <i className="fa-solid fa-arrow-right-long" />
        </Link>
      </div>
      <div className="upcoming-grid">
        {isLoading && <p>Yükleniyor...</p>}
        {coursesToShow.map((course) => {
          const reviewCount = Number(course.ratingCount ?? 0) || 0;
          const hasRating = reviewCount > 0 && course.rating;

          return (
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
                {hasRating ? (
                  <div className="upcoming-date-badge upcoming-rating-badge">
                    <i className="fa-solid fa-star" />
                    <span>
                      {course.rating} · {reviewCount} değerlendirme
                    </span>
                  </div>
                ) : null}
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
                  {course.category ? (
                    <p className="upcoming-meta-item">
                      <i className="fa-solid fa-layer-group" />
                      <span>{course.category}</span>
                    </p>
                  ) : null}
                </div>
                <h3>
                  <Link to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                    {course.title}
                  </Link>
                </h3>
                <div className="upcoming-bottom">
                  <p className="upcoming-rating">
                    {hasRating ? (
                      <>
                        <i className="fa-solid fa-star" />
                        <strong>{course.rating}</strong>
                        <span className="upcoming-rating-count">({reviewCount} değerlendirme)</span>
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
          );
        })}
        {!isLoading && !coursesToShow.length && (
          <p>Henüz değerlendirilmiş eğitim bulunamadı. İlk yorumu siz bırakabilirsiniz.</p>
        )}
      </div>
    </section>
  );
}

export default FollowerCourses;
