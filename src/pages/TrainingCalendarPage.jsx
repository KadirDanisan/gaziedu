import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "../components/CourseCardThumb";
import { makeSlug } from "../data/homeData";
import { useAuth } from "../context/AuthContext";

function TrainingCalendarPage() {
  const [calendarCourses, setCalendarCourses] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([{ id: "", name: "Tüm Eğitimler" }]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const paginatedCourses = useMemo(() => calendarCourses, [calendarCourses]);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getCalendarCourses({
        page: currentPage,
        pageSize: itemsPerPage,
        categoryId: selectedCategoryId,
        dateFrom,
        dateTo,
        sort: sortOrder,
        search: query,
      })
      .then((data) => {
        if (!active) return;
        const parsedCategories = Array.isArray(data?.categories)
          ? data.categories.map((item) =>
              typeof item === "string" ? { id: item === "Tüm Eğitimler" ? "" : item, name: item } : item
            )
          : [{ id: "", name: "Tüm Eğitimler" }];
        setCategoryOptions(parsedCategories.length ? parsedCategories : [{ id: "", name: "Tüm Eğitimler" }]);
        const items = Array.isArray(data?.educationCalendar) ? data.educationCalendar : [];
        setCalendarCourses(
          items.map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
            attendees: "Sınırsız Kayıt",
            mode: "Uzaktan Eğitim",
          }))
        );
        setTotalPages(data?.pagination?.totalPages || 1);
      })
      .catch(() => {
        if (!active) return;
        setCalendarCourses([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, selectedCategoryId, dateFrom, dateTo, sortOrder, query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, dateFrom, dateTo, sortOrder, query]);

  const handleFavoriteClick = async (course) => {
    if (!isLoggedIn) {
      alert("Favorilere eklemek için giriş yapmalısınız.");
      return;
    }
    try {
      await toggleFavorite(course.id, course.sourceType || "education");
    } catch (error) {
      alert(error.message || "Favori işlemi başarısız.");
    }
  };
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
          <form
            className="calendar-search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input
              type="search"
              placeholder="Eğitim arayın.."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <i className="fa-solid fa-magnifying-glass" />
          </form>
        </div>

        <div className="calendar-filters">
          <div className="calendar-filter-field">
            <label>Eğitim Ana Kategorisi</label>
            <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
              {categoryOptions.map((category) => (
                <option key={category.id || "all"} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="calendar-filter-field">
            <label>Sıralama:</label>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="newest">En Yeni</option>
              <option value="oldest">En Eski</option>
            </select>
          </div>

          <div className="calendar-filter-field">
            <label>Başlangıç Tarihi:</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>

          <div className="calendar-filter-field">
            <label>Bitiş Tarihi:</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="calendar-list-section">
        {isLoading && (
          <article className="calendar-item">
            <div className="calendar-item-content">
              <h3>Yükleniyor...</h3>
            </div>
          </article>
        )}
        {paginatedCourses.map((course) => (
          <article className="calendar-item" key={`${course.sourceType || "education"}-${course.id || course.title}`}>
            <div className="calendar-item-image">
              <CourseCardThumb course={course} variant="calendar" />
              <button
                type="button"
                className={`card-favorite-btn${isFavorite(course) ? " is-active" : ""}`}
                aria-label={isFavorite(course) ? "Favorilerden çıkar" : "Favorilere ekle"}
                onClick={() => handleFavoriteClick(course)}
              >
                <i className={`${isFavorite(course) ? "fa-solid" : "fa-regular"} fa-heart`} aria-hidden />
              </button>
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
              <div className="calendar-date">{String(course.date || "").slice(0, 2)} MAYIS</div>
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

        {!isLoading && !paginatedCourses.length && (
          <article className="calendar-item">
            <div className="calendar-item-content">
              <h3>Filtreye uygun eğitim bulunamadı.</h3>
            </div>
          </article>
        )}

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
