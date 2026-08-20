import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "../components/CourseCardThumb";
import { makeSlug } from "../data/homeData";
import { SALES_FILTERS, normalizeSalesFilter, salesFilterLabel } from "../constants/salesFilters";
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

function joinWithComma(values) {
  return values.join(", ");
}

const defaultPagination = { page: 1, pageSize: 9, total: 0, totalPages: 1 };

function AllTrainingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState("grid");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSalesFilters, setSelectedSalesFilters] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [listItems, setListItems] = useState([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, isFavorite, toggleFavorite } = useAuth();
  const itemsPerPage = 9;
  const navigate = useNavigate();
  const lastDebouncedSearchRef = useRef("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (lastDebouncedSearchRef.current !== nextSearch) {
        lastDebouncedSearchRef.current = nextSearch;
        setDebouncedSearch(nextSearch);
        setCurrentPage(1);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    publicApi
      .getCategories()
      .then((data) => {
        if (!active) return;
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
        if (active) setAvailableCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getAllTrainings({
        page: currentPage,
        pageSize: itemsPerPage,
        search: debouncedSearch,
        categories: selectedCategories,
        salesFilters: selectedSalesFilters,
        sort: sortBy,
      })
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray(data?.courses) ? data.courses : [];
        setListItems(
          rows.map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
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
  }, [currentPage, debouncedSearch, selectedCategories, selectedSalesFilters, sortBy, itemsPerPage]);

  useEffect(() => {
    const sortParam = String(searchParams.get("sort") || "").toLowerCase();
    const allowed = new Set(["newest", "oldest", "rating", "most_reviews"]);
    if (!allowed.has(sortParam)) return;
    setSortBy(sortParam);
    setCurrentPage(1);
  }, [searchParams]);

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
    const raw = searchParams.get("tur");
    const next = String(raw || "")
      .split(",")
      .map((part) => normalizeSalesFilter(part))
      .filter(Boolean);
    setSelectedSalesFilters((prev) => (sameCategorySelection(prev, next) ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    if (currentPage <= pagination.totalPages) return;
    setCurrentPage(pagination.totalPages);
  }, [currentPage, pagination.totalPages]);

  const totalCount = pagination.total;

  const toggleCategory = (category) => {
    setCurrentPage(1);
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

  const toggleSalesFilter = (key) => {
    setCurrentPage(1);
    setSelectedSalesFilters((prev) => {
      const nextFilters = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      const nextParams = new URLSearchParams(searchParams);
      if (nextFilters.length) {
        nextParams.set("tur", nextFilters.join(","));
      } else {
        nextParams.delete("tur");
      }
      setSearchParams(nextParams, { replace: true });
      return nextFilters;
    });
  };

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

  const totalPages = pagination.totalPages;

  const pageButtons = useMemo(() => Array.from({ length: totalPages }, (_, idx) => idx + 1), [totalPages]);

  const activeFilterLabels = useMemo(() => {
    const cats = [...selectedCategories].sort((a, b) => a.localeCompare(b, "tr"));
    const types = selectedSalesFilters.map((key) => salesFilterLabel(key)).filter(Boolean);
    return [...types, ...cats];
  }, [selectedCategories, selectedSalesFilters]);

  const filterHead = useMemo(() => {
    const hasSearch = Boolean(debouncedSearch);
    const hasFilters = activeFilterLabels.length > 0;

    if (!hasFilters && !hasSearch) {
      return {
        title: "Tüm Eğitimler",
        showAllTrainingsCrumb: false,
        currentCrumb: null,
      };
    }

    const filterLabel = hasFilters ? joinWithComma(activeFilterLabels) : null;
    let currentCrumb = "";
    if (hasFilters && hasSearch) {
      currentCrumb = `${filterLabel} · “${debouncedSearch}”`;
    } else if (hasFilters) {
      currentCrumb = filterLabel;
    } else {
      currentCrumb = `“${debouncedSearch}”`;
    }

    let title = "Tüm Eğitimler";
    if (hasFilters && hasSearch) {
      title = `${filterLabel} — “${debouncedSearch}”`;
    } else if (hasFilters) {
      title = filterLabel;
    } else if (hasSearch) {
      title = `Arama: “${debouncedSearch}”`;
    }

    return {
      title,
      showAllTrainingsCrumb: true,
      currentCrumb,
    };
  }, [activeFilterLabels, debouncedSearch]);

  const resultsLine = useMemo(() => {
    const n = totalCount;
    const hasFilters = activeFilterLabels.length > 0;
    if (debouncedSearch && hasFilters) {
      return `${n} eğitim bulundu (${joinWithComma(activeFilterLabels)} · “${debouncedSearch}”).`;
    }
    if (debouncedSearch) {
      return `${n} eğitim bulundu (“${debouncedSearch}”).`;
    }
    if (activeFilterLabels.length === 1) {
      return `${n} eğitim bulundu (${activeFilterLabels[0]}).`;
    }
    if (hasFilters) {
      return `${n} eğitim bulundu (${activeFilterLabels.length} filtre).`;
    }
    return `${n} eğitim bulundu.`;
  }, [totalCount, activeFilterLabels, debouncedSearch]);

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
              onChange={(event) => {
                setSortBy(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
              <option value="rating">En yüksek puan</option>
              <option value="most_reviews">En çok değerlendirilen</option>
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
            <h4>Program Türü</h4>
            <div className="sidebar-check-list">
              {SALES_FILTERS.map((option) => (
                <label key={option.key} className="sidebar-check-item">
                  <input
                    type="checkbox"
                    checked={selectedSalesFilters.includes(option.key)}
                    onChange={() => toggleSalesFilter(option.key)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
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
