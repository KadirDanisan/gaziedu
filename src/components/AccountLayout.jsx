import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AccountLayout() {
  const { isLoggedIn, user, logout } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/kullanici-islemleri" replace />;
  }

  return (
    <section className="account-page section">
      <div className="account-grid">
        <aside className="account-sidebar">
          <div className="account-sidebar-title">Merhaba, {user.fullName}</div>

          <nav className="account-nav">
            <NavLink to="/hesabim/hesap-bilgilerim">
              <i className="fa-solid fa-house" />
              <span>Hesap Bilgilerim</span>
            </NavLink>
            <NavLink to="/hesabim/siparislerim">
              <i className="fa-solid fa-bag-shopping" />
              <span>Siparişlerim</span>
            </NavLink>
          </nav>

          <div className="account-sidebar-subtitle">Hesap</div>
          <nav className="account-nav">
            <NavLink to="/hesabim/hesap-ayarlarim">
              <i className="fa-solid fa-gear" />
              <span>Hesap Ayarlarım</span>
            </NavLink>
            <NavLink to="/hesabim/sifremi-degistir">
              <i className="fa-solid fa-key" />
              <span>Şifremi Değiştir</span>
            </NavLink>
            <button type="button" className="account-logout" onClick={logout}>
              <i className="fa-solid fa-right-from-bracket" />
              <span>Çıkış Yap</span>
            </button>
          </nav>
        </aside>

        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </section>
  );
}

export default AccountLayout;
