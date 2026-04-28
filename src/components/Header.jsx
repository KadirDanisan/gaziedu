import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { categories } from "../data/homeData";
import { useAuth } from "../context/AuthContext";

function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isLoggedIn, user, logout } = useAuth();

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
            src="https://istanbulinstitute.com/site/images/logo.svg"
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
            className="icon-btn"
            aria-label="Arama"
            onClick={() => setIsSearchOpen((prev) => !prev)}
          >
            <i className="fa-solid fa-magnifying-glass" />
          </button>
          <button type="button" className="icon-btn" aria-label="Sepet">
            <i className="fa-solid fa-cart-shopping" />
          </button>
          {!isLoggedIn ? (
            <Link className="btn btn-outline" to="/kullanici-islemleri">
              Giriş Yap & Üye Ol
            </Link>
          ) : (
            <div className="account-dropdown">
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
