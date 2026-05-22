import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import { makeSlug } from "../data/homeData";

function categoryLinkTo(item) {
  return item === "Tüm Eğitimler" ? "/tum-egitimler" : `/tum-egitimler?kategori=${encodeURIComponent(item)}`;
}

function Header() {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileCoursesOpen, setIsMobileCoursesOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [categoryItems, setCategoryItems] = useState([]);
  const { isLoggedIn, user, logout, favorites, loadFavorites } = useAuth();
  const desktopDropdownRef = useRef(null);
  const favoritesPanelRef = useRef(null);
  const favoritesDesktopBtnRef = useRef(null);
  const favoritesMobileBtnRef = useRef(null);
  const searchSlotRef = useRef(null);
  const searchInputRef = useRef(null);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileCoursesOpen(false);
  };

  const handleDesktopDropdownMouseLeave = () => {
    const activeElement = document.activeElement;
    if (desktopDropdownRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    if (!isSearchOpen) return undefined;
    const onMouseDown = (event) => {
      if (searchSlotRef.current?.contains(event.target)) return;
      closeSearch();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSearchLoading(true);
      publicApi
        .searchTrainings(q)
        .then((data) => {
          if (!cancelled) setSearchResults(Array.isArray(data?.results) ? data.results : []);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery, isSearchOpen]);

  useEffect(() => {
    let active = true;
    publicApi
      .getCourses()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data?.categories) && data.categories.length) {
          const parsed = data.categories.map((item) => (typeof item === "string" ? item : item.name));
          setCategoryItems(parsed.filter(Boolean));
        }
      })
      .catch(() => {
        if (active) setCategoryItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isFavoritesOpen) return undefined;
    const closeIfOutside = (event) => {
      const target = event.target;
      if (favoritesPanelRef.current?.contains(target)) return;
      if (favoritesDesktopBtnRef.current?.contains(target)) return;
      if (favoritesMobileBtnRef.current?.contains(target)) return;
      setIsFavoritesOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [isFavoritesOpen]);

  useEffect(() => {
    if (isFavoritesOpen && isLoggedIn) {
      loadFavorites?.();
    }
  }, [isFavoritesOpen, isLoggedIn, loadFavorites]);

  const toggleFavorites = () => {
    setIsFavoritesOpen((prev) => !prev);
  };

  return (
    <div className="site-header-sticky">
      <div className="topbar">
        <div className="topbar-contact">
          <a href="tel:03122028200">
            <i className="fa-solid fa-phone" /> 0 (312) 202 82 00
          </a>
          <a href="mailto:guzem@gazi.edu.tr">
            <i className="fa-regular fa-envelope" /> guzem@gazi.edu.tr
          </a>
        </div>
        <div className="socials">
        <a href="https://www.facebook.com/GaziUniversitesi.1926" target="_blank"><i className="fa-brands fa-facebook-f" /></a>
        <a href="https://www.linkedin.com/school/gazi-university/" target="_blank"><i className="fa-brands fa-linkedin-in" /></a>
        <a href="https://www.instagram.com/gazi_universitesi/?hl=tr" target="_blank"><i className="fa-brands fa-instagram" /></a>  
        </div>
      </div>
      <header className="site-header">
      <div className="nav">
        <Link to="/" className="site-brand">
          <img
            className="site-logo"
            src="/Guzem-05.png"
            alt="Gazi Üniversitesi"
          />
        </Link>
        <nav>
          <div className="dropdown" ref={desktopDropdownRef} onMouseLeave={handleDesktopDropdownMouseLeave}>
            <button className="dropdown-trigger" type="button">
              Eğitimler <i className="fa-solid fa-chevron-down" />
            </button>
            <div className="dropdown-menu categories-mega-menu" role="menu" aria-label="Eğitim kategorileri">
              {categoryItems.map((item) => (
                <Link
                  key={item}
                  to={categoryLinkTo(item)}
                  role="menuitem"
                  className={item === "Tüm Eğitimler" ? "categories-mega-all" : undefined}
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
          <NavLink to="/egitim-takvimi">Eğitim Takvimi</NavLink>
          <NavLink to="/hakkimizda">Hakkımızda</NavLink>
          <NavLink to="/kurumsal-egitim-cozumleri">Kurumsal Eğitim Çözümleri</NavLink>
          <NavLink to="/iletisim">İletişim</NavLink>
        </nav>
        <div className="header-actions">
          <div className="header-search-slot" ref={searchSlotRef}>
            <div className={`header-search-expand ${isSearchOpen ? "is-open" : ""}`}>
              <input
                ref={searchInputRef}
                type="search"
                className="header-search-input"
                placeholder="Eğitim arayın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const first = searchResults[0];
                  if (!first) return;
                  navigate(`/egitim-detay/${makeSlug(first.title)}`, {
                    state: {
                      course: {
                        id: first.id,
                        title: first.title,
                        image: resolvePublicImageUrl(first.image),
                        sourceType: first.sourceType || "education",
                      },
                    },
                  });
                  closeSearch();
                }}
                aria-label="Eğitim ara"
                autoComplete="off"
              />
              <button
                type="button"
                className={`icon-btn header-search-btn ${isSearchOpen ? "is-active" : ""}`}
                aria-label={isSearchOpen ? "Aramayı kapat" : "Arama"}
                aria-expanded={isSearchOpen}
                onClick={() => {
                  if (isSearchOpen) closeSearch();
                  else setIsSearchOpen(true);
                }}
              >
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            </div>
            {isSearchOpen ? (
              <div className="header-search-results" role="region" aria-label="Arama sonuçları">
                {searchQuery.trim().length < 2 ? (
                  <p className="header-search-hint">Eğitim adı giriniz.</p>
                ) : searchLoading ? (
                  <p className="header-search-hint">Aranıyor…</p>
                ) : searchResults.length === 0 ? (
                  <p className="header-search-hint">Sonuç bulunamadı.</p>
                ) : (
                  <ul className="header-search-result-list">
                    {searchResults.map((item) => (
                      <li key={`${item.sourceType}-${item.id}`}>
                        <Link
                          to={`/egitim-detay/${makeSlug(item.title)}`}
                          state={{
                            course: {
                              id: item.id,
                              title: item.title,
                              image: resolvePublicImageUrl(item.image),
                              sourceType: item.sourceType || "education",
                            },
                          }}
                          className="header-search-result-row"
                          onClick={closeSearch}
                        >
                          <img src={resolvePublicImageUrl(item.image)} alt="" className="header-search-result-thumb" />
                          <span className="header-search-result-main">
                            <span className="header-search-result-title">{item.title}</span>
                            <span className={`header-search-result-badge ${item.sourceType === "calendar" ? "is-calendar" : ""}`}>
                              {item.sourceType === "calendar" ? "Takvim" : "Eğitim"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <div className="favorites-popover desktop-action">
            <button
              ref={favoritesDesktopBtnRef}
              type="button"
              className={`icon-btn favorites-trigger ${isFavoritesOpen ? "is-open" : ""}`}
              aria-label="Favorilerim"
              aria-expanded={isFavoritesOpen}
              aria-haspopup="true"
              onClick={toggleFavorites}
            >
              <i className="fa-regular fa-heart" aria-hidden />
              {isLoggedIn && favorites.length > 0 ? (
                <span className="favorites-count">{favorites.length > 9 ? "9+" : favorites.length}</span>
              ) : null}
            </button>
          </div>
          {!isLoggedIn ? (
            <Link className="btn btn-outline desktop-action" to="/kullanici-islemleri">
              Giriş Yap & Üye Ol
            </Link>
          ) : (
            <div className="account-dropdown desktop-action">
              <button type="button" className="btn btn-outline account-btn">
                <i className="fa-regular fa-user" /> Hesabım
              </button>
              <div className="account-dropdown-menu">
                <div className="account-dropdown-user">{user.fullName}</div>
                <NavLink to="/hesabim/sertifikalarim">Sertifikalarım</NavLink>
                <NavLink to="/hesabim/hesap-bilgilerim">Hesap Ayarlarım</NavLink>
                <button type="button" onClick={logout}>
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="icon-btn mobile-menu-toggle"
            aria-label="Menüyü Aç/Kapat"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <i className={`fa-solid ${isMobileMenuOpen ? "fa-xmark" : "fa-bars"}`} />
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${isMobileMenuOpen ? "is-open" : ""}`}>
        <div className="mobile-menu-contact">
        <a href="tel:03122028200">
            <i className="fa-solid fa-phone" />  0(312) 202 82 00
          </a>
          <a href="mailto:guzem@gazi.edu.tr">
            <i className="fa-regular fa-envelope" /> guzem@gazi.edu.tr
          </a>
        </div>
        <div className="mobile-menu-socials">
        <a href="https://www.facebook.com/gaziuniuzem" target="_blank"><i className="fa-brands fa-facebook-f" /></a>
        <a href="https://www.linkedin.com/school/gazi-university/" target="_blank"><i className="fa-brands fa-linkedin-in" /></a>
        <a href="https://www.instagram.com/gazi_universitesi/?hl=tr" target="_blank"><i className="fa-brands fa-instagram" /></a>  
        </div>
        <nav className="mobile-menu-nav">
          <div className={`mobile-dropdown ${isMobileCoursesOpen ? "is-open" : ""}`}>
            <button
              className="mobile-dropdown-trigger"
              type="button"
              onClick={() => setIsMobileCoursesOpen((prev) => !prev)}
              aria-expanded={isMobileCoursesOpen}
            >
              Eğitimler <i className="fa-solid fa-chevron-down" />
            </button>
            <div className="mobile-dropdown-menu categories-scroll-menu" role="menu" aria-label="Eğitim kategorileri">
              {categoryItems.map((item) => (
                <Link
                  key={item}
                  to={categoryLinkTo(item)}
                  role="menuitem"
                  className={item === "Tüm Eğitimler" ? "categories-mobile-all" : undefined}
                  onClick={closeMobileMenu}
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
          <NavLink to="/egitim-takvimi" onClick={closeMobileMenu}>
            Eğitim Takvimi
          </NavLink>
          <NavLink to="/hakkimizda" onClick={closeMobileMenu}>
            Hakkımızda
          </NavLink>
          <NavLink to="/kurumsal-egitim-cozumleri" onClick={closeMobileMenu}>
            Kurumsal Eğitim Çözümleri
          </NavLink>
          <NavLink to="/iletisim" onClick={closeMobileMenu}>
            İletişim
          </NavLink>
        </nav>
        <div className="mobile-menu-bottom">
          <button
            ref={favoritesMobileBtnRef}
            type="button"
            className={`icon-btn favorites-trigger ${isFavoritesOpen ? "is-open" : ""}`}
            aria-label="Favorilerim"
            aria-expanded={isFavoritesOpen}
            onClick={() => {
              setIsFavoritesOpen((prev) => !prev);
            }}
          >
            <i className="fa-regular fa-heart" aria-hidden />
            {isLoggedIn && favorites.length > 0 ? (
              <span className="favorites-count">{favorites.length > 9 ? "9+" : favorites.length}</span>
            ) : null}
          </button>
          {!isLoggedIn ? (
            <Link className="btn btn-outline mobile-auth-cta" to="/kullanici-islemleri" onClick={closeMobileMenu}>
              Giriş Yap & Üye Ol
            </Link>
          ) : (
            <div className="mobile-account-links">
              <div className="mobile-account-user">{user.fullName}</div>
              <NavLink to="/hesabim/sertifikalarim" onClick={closeMobileMenu}>
                Sertifikalarım
              </NavLink>
              <NavLink to="/hesabim/hesap-bilgilerim" onClick={closeMobileMenu}>
                Hesap Ayarlarım
              </NavLink>
              <button
                type="button"
                className="btn btn-outline mobile-auth-cta"
                onClick={() => {
                  logout();
                  closeMobileMenu();
                }}
              >
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
      {isFavoritesOpen ? (
        <div ref={favoritesPanelRef} className="favorites-panel" role="dialog" aria-label="Favori eğitimler">
          <div className="favorites-panel-head">
            <span>Favorilerim</span>
            <Link to="/hesabim/favorilerim" className="favorites-panel-all" onClick={() => setIsFavoritesOpen(false)}>
              Tümü
            </Link>
          </div>
          <div className="favorites-panel-body">
            {!isLoggedIn ? (
              <p className="favorites-panel-empty">
                <Link to="/kullanici-islemleri" onClick={() => setIsFavoritesOpen(false)}>
                  Giriş yapın
                </Link>
                {" "}
                ve favorilerinizi burada görün.
              </p>
            ) : favorites.length === 0 ? (
              <p className="favorites-panel-empty">Henüz favori eğitiminiz yok.</p>
            ) : (
              <ul className="favorites-panel-list">
                {favorites.slice(0, 6).map((course) => (
                  <li key={`${course.sourceType || "education"}-${course.id}`}>
                    <Link
                      to={`/egitim-detay/${makeSlug(course.title)}`}
                      state={{ course }}
                      className="favorites-panel-item"
                      onClick={() => {
                        setIsFavoritesOpen(false);
                        closeMobileMenu();
                      }}
                    >
                      <img src={resolvePublicImageUrl(course.image)} alt="" />
                      <span>{course.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      </header>
    </div>
  );
}

export default Header;
