import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { categories, makeSlug, upcomingCourses } from "../data/homeData";

const trainingTypes = ["Hibrit Eğitim", "Uzaktan Eğitim", "Yüzyüze Eğitim"];

function AllTrainingsPage() {
  const [layout, setLayout] = useState("grid");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("onerilen");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const allCourses = useMemo(
    () =>
      [...upcomingCourses, ...upcomingCourses].slice(0, 12).map((course, idx) => ({
        ...course,
        id: `${course.title}-${idx}`,
        category: categories[(idx % (categories.length - 1)) + 1],
      })),
    []
  );

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = allCourses.filter((course) => {
      const matchesQuery = !q || course.title.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(course.category);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(course.mode);
      return matchesQuery && matchesCategory && matchesType;
    });

    if (sortBy === "degerlendirme") {
      items = [...items].sort((a, b) => {
        const aScore = Number.parseInt(String(a.rating || "").replace(/\D/g, ""), 10) || 0;
        const bScore = Number.parseInt(String(b.rating || "").replace(/\D/g, ""), 10) || 0;
        return bScore - aScore;
      });
    }

    return items;
  }, [allCourses, query, selectedCategories, selectedTypes, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedCategories, selectedTypes, sortBy]);

  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCourses.slice(start, start + itemsPerPage);
  }, [currentPage, filteredCourses]);

  const toggleCategory = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  return (
    <>
      <section className="all-trainings-hero">
        <div className="all-trainings-hero-inner">
          <div>
            <ul className="all-trainings-breadcrumb">
              <li>Anasayfa</li>
              <li>
                <i className="fa-solid fa-chevron-right" />
              </li>
              <li>Tüm Eğitimler</li>
            </ul>
            <h1>Tüm Eğitimler</h1>
          </div>
        </div>

        <div className="all-trainings-toolbar">
          <div className="all-trainings-layout">
            <button
              type="button"
              className={`layout-btn ${layout === "grid" ? "active" : ""}`}
              onClick={() => setLayout("grid")}
              aria-label="Grid görünüm"
            >
              <i className="fa-solid fa-border-all" />
            </button>
            <button
              type="button"
              className={`layout-btn ${layout === "list" ? "active" : ""}`}
              onClick={() => setLayout("list")}
              aria-label="Liste görünüm"
            >
              <i className="fa-solid fa-list" />
            </button>
            <span className="course-index">{filteredCourses.length} eğitim bulundu.</span>
          </div>

          <div className="all-trainings-sort">
            <label htmlFor="all-trainings-sort">Sıralama:</label>
            <select
              id="all-trainings-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="onerilen">Önerilen</option>
              <option value="degerlendirme">Değerlendirme</option>
            </select>
          </div>
        </div>
      </section>

      <section className="all-trainings-content section">
        <aside className="all-trainings-sidebar">
          <div className="sidebar-widget">
            <div className="sidebar-search">
              <input
                type="text"
                placeholder="Eğitim Arayın..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <i className="fa-solid fa-magnifying-glass" />
            </div>
          </div>

          <div className="sidebar-widget">
            <h4>Kategoriler</h4>
            <div className="sidebar-check-list">
              {categories.slice(1).map((category) => (
                <label key={category} className="sidebar-check-item">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sidebar-widget">
            <h4>Eğitim Türleri</h4>
            <div className="sidebar-check-list">
              {trainingTypes.map((type) => (
                <label key={type} className="sidebar-check-item">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className={`all-trainings-grid ${layout === "list" ? "list" : ""}`}>
          {paginatedCourses.map((course) => (
            <article className="all-training-card" key={course.id}>
              <div className="all-training-card-image">
                <img src={course.image} alt={course.title} />
              </div>
              <div className="all-training-card-body">
                {!!course.rating && (
                  <p className="all-training-rating">
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <span>({course.rating})</span>
                  </p>
                )}
                <h3>{course.title}</h3>
                <ul className="all-training-meta">
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
                <Link
                  to={`/egitim-detay/${makeSlug(course.title)}`}
                  state={{ course }}
                  className="all-training-link"
                >
                  Egitimi Incele <i className="fa-solid fa-arrow-right-long" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section all-trainings-pagination-wrap">
        {totalPages > 1 && (
          <nav className="calendar-pagination" aria-label="Tüm eğitimler sayfaları">
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

export default AllTrainingsPage;
