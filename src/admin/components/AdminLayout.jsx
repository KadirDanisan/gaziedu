import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ADMIN_MODULES } from "../modules";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";

function SidebarLink({ item }) {
  return (
    <NavLink to={item.route} className={({ isActive }) => `admin-side-link ${isActive ? "is-active" : ""}`}>
      <i className={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const { session, logout, hasPermission } = useAdminAuth();
  const { loadBootstrap } = useAdminData();
  const location = useLocation();

  useEffect(() => {
    loadBootstrap();
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/Gazi_Üniversitesi_logo.png" alt="Gazi Üniversitesi" style={{ width: 72, height: 72, objectFit: "contain" }} />
          <img src="/yokak_logo.svg" alt="Gazi Üniversitesi" style={{ width: 72, height: 72, objectFit: "contain" , marginLeft: 25}} />
        </div>
        <nav className="admin-side-nav">
          {ADMIN_MODULES.filter((module) => module.key === "activityLogs" || hasPermission(module.key, "canView")).map((module) => (
            <SidebarLink key={module.key} item={module} />
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>Yönetim Paneli</h1>
            <p>{location.pathname}</p>
          </div>
          <div className="admin-profile">
            <div>
              <strong>{session?.user?.firstName} {session?.user?.lastName}</strong>
              <small>{session?.user?.roleName || "Yönetici"}</small>
            </div>
            <button type="button" className="btn btn-outline" onClick={logout}>
              Çıkış
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
