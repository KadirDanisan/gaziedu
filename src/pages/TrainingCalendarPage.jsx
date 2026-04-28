import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { makeSlug, upcomingCourses } from "../data/homeData";

function TrainingCalendarPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(upcomingCourses.length / itemsPerPage);

  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return upcomingCourses.slice(start, start + itemsPerPage);
  }, [currentPage]);

  return (
    <>
      <section className="calendar-hero">
        <div className="calendar-hero-inner">
          <div>
            <ul className="calendar-breadcrumb">
              <li>Anasayfa</li>
              <li>/</li>
              <li>Eğitim Takvimi</li>
            </ul>
            <h1>Eğitim Takvimi</h1>
            <p>Yaklaşan eğitimleri ve sınıfları bu sayfada filtreleyebilirsiniz.</p>
          </div>
          <form className="calendar-search">
            <input type="search" placeholder="Eğitim arayın.." />
            <i className="fa-solid fa-magnifying-glass" />
          </form>
        </div>

        <div className="calendar-filters">
          <div className="calendar-filter-field">
            <label>Eğitim Ana Kategorisi</label>
            <select defaultValue="">
              <option value="" disabled>
                Eğitim Ana Kategorisi
              </option>
              <option>Yönetim - Liderlik Eğitimleri</option>
              <option>Teknoloji Eğitimleri</option>
              <option>Finans ve Muhasebe Eğitimleri</option>
              <option>Dijital Pazarlama Eğitimleri</option>
              <option>İletişim Eğitimleri</option>
              <option>İnsan Kaynakları Eğitimleri</option>
            </select>
          </div>

          <div className="calendar-filter-field">
            <label>Eğitim Türü:</label>
            <select defaultValue="">
              <option value="" disabled>
                Eğitim Türü
              </option>
              <option>Uzaktan Eğitim</option>
              <option>Yüzyüze Eğitim</option>
              <option>Hibrit Eğitim</option>
            </select>
          </div>

          <div className="calendar-filter-field">
            <label>Fiyat Aralığı (₺):</label>
            <div className="calendar-price-track" />
            <p className="calendar-price-values">Fiyat: &nbsp; 3000 - 40000</p>
          </div>

          <div className="calendar-filter-action">
            <button className="btn calendar-filter-btn" type="button">
              Filtrele <i className="fa-solid fa-filter" />
            </button>
          </div>
        </div>
      </section>

      <section className="calendar-list-section">
        {paginatedCourses.map((course) => (
          <article className="calendar-item" key={course.title}>
            <div className="calendar-item-image">
              <img src={course.image} alt={course.title} />
            </div>
            <div className="calendar-item-content">
              <h3>{course.title}</h3>
              {!!course.rating && (
                <p className="calendar-stars">
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" /> ({course.rating})
                </p>
              )}
              <ul>
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
            </div>
            <div className="calendar-item-side">
              <div className="calendar-date">{course.date.slice(0, 2)} MAYIS</div>
              <Link
                to={`/egitim-detay/${makeSlug(course.title)}`}
                state={{ course }}
                className="calendar-link"
              >
                Egitimi Incele <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </article>
        ))}

        {totalPages > 1 && (
          <nav className="calendar-pagination" aria-label="Eğitim sayfaları">
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
              <button
                type="button"
                key={page}
                className={`page-btn ${currentPage === page ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </nav>
        )}
      </section>
    </>
  );
}

export default TrainingCalendarPage;
