import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { categories } from "../data/homeData";
import { useAuth } from "../context/AuthContext";

function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileCoursesOpen, setIsMobileCoursesOpen] = useState(false);
  const { isLoggedIn, user, logout } = useAuth();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileCoursesOpen(false);
  };

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="topbar-contact">
          <a href="tel:+902122832402">
            <i className="fa-solid fa-phone" /> 0 212 283 24 02
          </a>
          <a href="mailto:info@gazi.edu.tr">
            <i className="fa-regular fa-envelope" /> info@gazi.edu.tr
          </a>
        </div>
        <div className="socials">
          <i className="fa-brands fa-facebook-f" />
          <i className="fa-brands fa-linkedin-in" />
          <i className="fa-brands fa-instagram" />
        </div>
      </div>
      <div className="nav">
        <Link to="/">
          <img
            className="site-logo"
            src="/Gazi_Üniversitesi_logo.png"
            alt="Gazi Üniversitesi"
          />
        </Link>
        <nav>
          <div className="dropdown">
            <button className="dropdown-trigger" type="button">
              Eğitimler <i className="fa-solid fa-chevron-down" />
            </button>
            <div className="dropdown-menu">
              {categories.map((item) => (
                <Link
                  key={item}
                  to={item === "Tüm Eğitimler" ? "/tum-egitimler" : `/tum-egitimler?kategori=${encodeURIComponent(item)}`}
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
          <button
            type="button"
            className="icon-btn header-search-btn"
            aria-label="Arama"
            onClick={() => setIsSearchOpen((prev) => !prev)}
          >
            <i className="fa-solid fa-magnifying-glass" />
          </button>
          <button type="button" className="icon-btn desktop-action" aria-label="Sepet">
            <i className="fa-solid fa-cart-shopping" />
          </button>
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
                <NavLink to="/hesabim/siparislerim">Siparişlerim</NavLink>
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
          <a href="tel:+902122832402">
            <i className="fa-solid fa-phone" /> 0 212 283 24 02
          </a>
          <a href="mailto:info@gazi.edu.tr">
            <i className="fa-regular fa-envelope" /> info@gazi.edu.tr
          </a>
        </div>
        <div className="mobile-menu-socials">
          <i className="fa-brands fa-facebook-f" />
          <i className="fa-brands fa-linkedin-in" />
          <i className="fa-brands fa-instagram" />
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
            <div className="mobile-dropdown-menu">
              {categories.map((item) => (
                <Link
                  key={item}
                  to={item === "Tüm Eğitimler" ? "/tum-egitimler" : `/tum-egitimler?kategori=${encodeURIComponent(item)}`}
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
          <button type="button" className="icon-btn" aria-label="Sepet">
            <i className="fa-solid fa-cart-shopping" />
          </button>
          {!isLoggedIn ? (
            <Link className="btn btn-outline mobile-auth-cta" to="/kullanici-islemleri" onClick={closeMobileMenu}>
              Giriş Yap & Üye Ol
            </Link>
          ) : (
            <div className="mobile-account-links">
              <div className="mobile-account-user">{user.fullName}</div>
              <NavLink to="/hesabim/siparislerim" onClick={closeMobileMenu}>
                Siparişlerim
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
      {isSearchOpen && (
        <div className="search-row">
          <input type="search" placeholder="Eğitim arayın..." />
          <button type="button" className="btn btn-search">
            Ara
          </button>
        </div>
      )}
    </header>
  );
}

export default Header;
