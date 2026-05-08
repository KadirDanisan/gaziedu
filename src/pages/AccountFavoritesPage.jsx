import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { makeSlug } from "../data/homeData";
import CourseCardThumb from "../components/CourseCardThumb";

function AccountFavoritesPage() {
  const { favorites } = useAuth();

  return (
    <div className="account-panel">
      <h3>Favorilerim</h3>
      {!favorites.length ? (
        <p className="account-empty">Henüz favori eğitim eklemediniz.</p>
      ) : (
        <div className="upcoming-grid">
          {favorites.map((course) => (
            <article key={`${course.sourceType || "education"}-${course.id}`} className="upcoming-card">
              <div className="upcoming-card-media">
                <CourseCardThumb course={course} variant="upcoming" />
              </div>
              <div className="upcoming-card-body">
                <h3>{course.title}</h3>
                <p>{course.duration}</p>
                <Link className="upcoming-card-cta" to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                  Eğitimi İncele <i className="fa-solid fa-arrow-right" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountFavoritesPage;
