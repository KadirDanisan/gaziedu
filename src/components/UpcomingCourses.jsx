import { Link } from "react-router-dom";
import { makeSlug, upcomingCourses } from "../data/homeData";

function UpcomingCourses() {
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
        {upcomingCourses.map((course) => (
          <article key={course.title} className="upcoming-card">
            <div className="upcoming-card-media">
              <img src={course.image} alt={course.title} />
              <div className="upcoming-media-overlay" />
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
      </div>
    </section>
  );
}

export default UpcomingCourses;
