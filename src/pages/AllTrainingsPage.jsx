import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "../components/CourseCardThumb";
import { makeSlug } from "../data/homeData";
import { useAuth } from "../context/AuthContext";

function CourseRatingStars({ value, max = 5 }) {
  const v = Math.min(max, Math.max(0, Number(value) || 0));
  const stars = [];
  for (let i = 1; i <= max; i += 1) {
    const diff = v - (i - 1);
    if (diff >= 1) {
      stars.push(<i key={i} className="fa-solid fa-star" aria-hidden />);
    } else if (diff >= 0.5) {
      stars.push(<i key={i} className="fa-solid fa-star-half-stroke" aria-hidden />);
    } else {
      stars.push(<i key={i} className="fa-regular fa-star" aria-hidden />);
    }
  }
  return <span className="course-rating-stars-row course-rating-stars-row--card">{stars}</span>;
}

function courseCardStarValue(course) {
  const cnt = Number(course.ratingCount ?? 0) || 0;
  const avg = course.ratingAverage;
  if (cnt <= 0 || avg == null || Number.isNaN(Number(avg))) return 0;
  return Number(avg);
}

function categoriesKey(arr) {
  return [...arr].sort().join("\u0001");
}

function sameCategorySelection(a, b) {
  return categoriesKey(a) === categoriesKey(b);
}

const defaultPagination = { page: 1, pageSize: 9, total: 0, totalPages: 1 };

function AllTrainingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState("grid");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [listItems, setListItems] = useState([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const itemsPerPage = 9;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategories, sortBy]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getEducationsCatalog({
        page: currentPage,
        pageSize: itemsPerPage,
        search: debouncedSearch,
        categories: selectedCategories,
        sort: sortBy,
      })
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        setListItems(
          rows.map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
            attendees: course.attendees || "Sınırsız Kayıt",
            mode: course.mode || "Uzaktan Eğitim",
          })),
        );
        if (data?.pagination) {
          const next = {
            page: data.pagination.page || 1,
            pageSize: data.pagination.pageSize || itemsPerPage,
            total: data.pagination.total ?? 0,
            totalPages: Math.max(1, data.pagination.totalPages || 1),
          };
          setPagination((prev) =>
            prev.page === next.page &&
            prev.pageSize === next.pageSize &&
            prev.total === next.total &&
            prev.totalPages === next.totalPages
              ? prev
              : next,
          );
        } else {
          setPagination((prev) => (prev.total === 0 && prev.totalPages === 1 ? prev : defaultPagination));
        }
        if (Array.isArray(data?.categories) && data.categories.length) {
          const categoryNames = data.categories
            .map((item) => (typeof item === "string" ? item : item.name))
            .filter((item) => item && item !== "Tüm Eğitimler");
          setAvailableCategories((prev) =>
            prev.length === categoryNames.length && prev.every((v, i) => v === categoryNames[i])
              ? prev
              : categoryNames,
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setListItems([]);
        setPagination((prev) => (prev.total === 0 && prev.totalPages === 1 ? prev : defaultPagination));
        setAvailableCategories((prev) => (prev.length === 0 ? prev : []));
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, debouncedSearch, selectedCategories, sortBy, itemsPerPage]);

  useEffect(() => {
    const raw = searchParams.get("kategori");
    if (!raw || !raw.trim()) {
      setSelectedCategories((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    if (!availableCategories.length) return;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const valid = parts.filter((p) => availableCategories.includes(p));
    const next = valid.length ? valid : [];
    setSelectedCategories((prev) => (sameCategorySelection(prev, next) ? prev : next));
  }, [searchParams, availableCategories]);

  useEffect(() => {
    if (currentPage <= pagination.totalPages) return;
    setCurrentPage(pagination.totalPages);
  }, [currentPage, pagination.totalPages]);

  const totalCount = pagination.total;

  const toggleCategory = (category) => {
    setSelectedCategories((prev) => {
      const nextCategories = prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category];
      const nextParams = new URLSearchParams(searchParams);
      if (nextCategories.length) {
        nextParams.set("kategori", nextCategories.join(","));
      } else {
        nextParams.delete("kategori");
      }
      setSearchParams(nextParams, { replace: true });
      return nextCategories;
    });
  };

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

  const totalPages = pagination.totalPages;

  const pageButtons = useMemo(() => Array.from({ length: totalPages }, (_, idx) => idx + 1), [totalPages]);

  const filterHead = useMemo(() => {
    const cats = [...selectedCategories].sort((a, b) => a.localeCompare(b, "tr"));
    const hasSearch = Boolean(debouncedSearch);
    const hasCats = cats.length > 0;

    if (!hasCats && !hasSearch) {
      return {
        title: "Tüm Eğitimler",
        showAllTrainingsCrumb: false,
        currentCrumb: null,
      };
    }

    const catLabel = hasCats ? (cats.length === 1 ? cats[0] : cats.join(", ")) : null;
    let currentCrumb = "";
    if (hasCats && hasSearch) {
      currentCrumb = `${catLabel} · “${debouncedSearch}”`;
    } else if (hasCats) {
      currentCrumb = catLabel;
    } else {
      currentCrumb = `“${debouncedSearch}”`;
    }

    let title = "Tüm Eğitimler";
    if (hasCats && hasSearch) {
      title = `${catLabel} — “${debouncedSearch}”`;
    } else if (hasCats) {
      title = cats.length === 1 ? cats[0] : catLabel;
    } else if (hasSearch) {
      title = `Arama: “${debouncedSearch}”`;
    }

    return {
      title,
      showAllTrainingsCrumb: true,
      currentCrumb,
    };
  }, [selectedCategories, debouncedSearch]);

  const resultsLine = useMemo(() => {
    const n = totalCount;
    const cats = [...selectedCategories].sort((a, b) => a.localeCompare(b, "tr"));
    if (debouncedSearch && cats.length) {
      return `${n} eğitim bulundu (${cats.join(", ")} · “${debouncedSearch}”).`;
    }
    if (debouncedSearch) {
      return `${n} eğitim bulundu (“${debouncedSearch}”).`;
    }
    if (cats.length === 1) {
      return `${n} eğitim bulundu (${cats[0]}).`;
    }
    if (cats.length > 1) {
      return `${n} eğitim bulundu (${cats.length} kategori).`;
    }
    return `${n} eğitim bulundu.`;
  }, [totalCount, selectedCategories, debouncedSearch]);

  return (
    <>
      <section className="all-trainings-hero">
        <div className="all-trainings-hero-inner">
          <div>
            <ul className="all-trainings-breadcrumb">
              <li>
                <Link to="/">Anasayfa</Link>
              </li>
              <li aria-hidden>
                <i className="fa-solid fa-chevron-right" />
              </li>
              {filterHead.showAllTrainingsCrumb ? (
                <>
                  <li>
                    <Link to="/tum-egitimler">Tüm Eğitimler</Link>
                  </li>
                  <li aria-hidden>
                    <i className="fa-solid fa-chevron-right" />
                  </li>
                  <li>{filterHead.currentCrumb}</li>
                </>
              ) : (
                <li>Tüm Eğitimler</li>
              )}
            </ul>
            <h1>{filterHead.title}</h1>
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
            <span className="course-index">{resultsLine}</span>
          </div>

          <div className="all-trainings-sort">
            <label htmlFor="all-trainings-sort">Sıralama:</label>
            <select
              id="all-trainings-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
              <option value="rating">Değerlendirme</option>
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
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <i className="fa-solid fa-magnifying-glass" />
            </div>
          </div>

          <div className="sidebar-widget">
            <h4>Kategoriler</h4>
            <div className="sidebar-check-list">
              {availableCategories.map((category) => (
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
        </aside>

        <div className={`all-trainings-grid ${layout === "list" ? "list" : ""}`}>
          {isLoading && (
            <article className="all-training-card">
              <div className="all-training-card-body">
                <h3>Yükleniyor...</h3>
              </div>
            </article>
          )}
          {!isLoading &&
            listItems.map((course) => (
              <article className="all-training-card" key={`${course.sourceType || "education"}-${course.id}`}>
                <div className="all-training-card-image">
                  <CourseCardThumb course={course} variant="grid" />
                  <button
                    type="button"
                    className={`card-favorite-btn${isFavorite(course) ? " is-active" : ""}`}
                    aria-label={isFavorite(course) ? "Favorilerden çıkar" : "Favorilere ekle"}
                    onClick={() => handleFavoriteClick(course)}
                  >
                    <i className={`${isFavorite(course) ? "fa-solid" : "fa-regular"} fa-heart`} aria-hidden />
                  </button>
                </div>
                <div className="all-training-card-body">
                  <p className="all-training-rating" aria-label="Değerlendirme puanı">
                    <CourseRatingStars value={courseCardStarValue(course)} />
                    <span>{course.ratingCount > 0 && course.rating ? course.rating : "—"}</span>
                  </p>
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
          {!isLoading && !listItems.length && (
            <article className="all-training-card">
              <div className="all-training-card-body">
                <h3>Filtreye uygun eğitim bulunamadı.</h3>
              </div>
            </article>
          )}
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
            {pageButtons.map((page) => (
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
