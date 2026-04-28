import { Link } from "react-router-dom";
import { makeSlug, upcomingCourses } from "../data/homeData";

function UpcomingCourses() {
  return (
    <section className="section upcoming-section">
      <div className="section-head upcoming-head">
        <h2>Yaklaşan Eğitimler</h2>
        <a className="upcoming-link" href="#">
          Tüm Eğitimleri İncele
        </a>
      </div>
      <div className="upcoming-grid">
        {upcomingCourses.map((course) => (
          <article key={course.title} className="upcoming-card">
            <img src={course.image} alt={course.title} />
            <div className="upcoming-card-body">
              <div className="upcoming-meta-row">
                <div className="upcoming-meta-chip">
                  <i className="fa-regular fa-user" />
                  <span>{course.attendees}</span>
                </div>
                <div className="upcoming-meta-chip">
                  <i className="fa-regular fa-calendar" />
                  <span>{course.date}</span>
                </div>
              </div>
              <div className="upcoming-meta-list">
                <p className="upcoming-meta-item">
                  <i className="fa-regular fa-clock" />
                  <span>{course.duration}</span>
                </p>
                <p className="upcoming-meta-item">
                  <i className="fa-solid fa-globe" />
                  <span>{course.mode}</span>
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
                    <span />
                  )}
                </p>
                <Link to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                  Egitimi Incele
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
