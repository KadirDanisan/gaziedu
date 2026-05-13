import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ADMIN_MODULES } from "../modules";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { adminApi } from "../api";

function SidebarLink({ item }) {
  return (
    <NavLink to={item.route} className={({ isActive }) => `admin-side-link ${isActive ? "is-active" : ""}`}>
      <i className={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const { session, logout, hasPermission, updateAdminSession } = useAdminAuth();
  const { loadBootstrap } = useAdminData();
  const location = useLocation();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!settingsOpen || !session?.user) return;
    setFirstName(session.user.firstName || "");
    setLastName(session.user.lastName || "");
    setEmail(session.user.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setNewPassword2("");
    setSettingsError("");
  }, [settingsOpen, session?.user]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSettingsError("");
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim().toLowerCase();
    if (!fn || !ln || !em) {
      setSettingsError("Ad, soyad ve e-posta zorunludur.");
      return;
    }
    const origEmail = (session?.user?.email || "").trim().toLowerCase();
    const emailChanged = em !== origEmail;
    const pwdChange = newPassword.length > 0;
    if ((emailChanged || pwdChange) && !currentPassword) {
      setSettingsError("E-posta veya şifre değiştiriyorsanız mevcut şifrenizi girin.");
      return;
    }
    if (pwdChange) {
      if (newPassword.length < 6) {
        setSettingsError("Yeni şifre en az 6 karakter olmalıdır.");
        return;
      }
      if (newPassword !== newPassword2) {
        setSettingsError("Yeni şifre ile tekrarı eşleşmiyor.");
        return;
      }
    }
    setSettingsSaving(true);
    try {
      const payload = { firstName: fn, lastName: ln, email: em };
      if (pwdChange) {
        payload.newPassword = newPassword;
        payload.currentPassword = currentPassword;
      } else if (emailChanged) {
        payload.currentPassword = currentPassword;
      }
      const res = await adminApi.patchAdminProfile(payload);
      updateAdminSession({ token: res.token, user: res.user });
      setSettingsOpen(false);
    } catch (err) {
      setSettingsError(err.message || "Kaydedilemedi.");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/Gazi_Üniversitesi_logo.png" alt="Gazi Üniversitesi" style={{ width: 72, height: 72, objectFit: "contain" }} />
          <img src="/yokak_logo.svg" alt="Gazi Üniversitesi" style={{ width: 72, height: 72, objectFit: "contain", marginLeft: 25 }} />
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
              <strong>
                {session?.user?.firstName} {session?.user?.lastName}
              </strong>
              <small>{session?.user?.roleName || "Yönetici"}</small>
            </div>
            <div className="admin-profile-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSettingsOpen(true)}>
                Ayarlar
              </button>
              <button type="button" className="btn btn-outline" onClick={logout}>
                Çıkış
              </button>
            </div>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      {settingsOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !settingsSaving && setSettingsOpen(false)}>
          <div
            className="admin-modal admin-modal--detail admin-settings-modal"
            style={{ maxWidth: 480 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-settings-title"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 id="admin-settings-title" className="admin-modal__title">
                  Hesap ayarları
                </h3>
                <p className="admin-modal__subtitle">Ad, soyad ve e-postanızı güncelleyebilirsiniz. E-posta veya şifre değişikliğinde mevcut şifreniz istenir.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => !settingsSaving && setSettingsOpen(false)} aria-label="Kapat" disabled={settingsSaving}>
                ×
              </button>
            </header>
            <form id="admin-settings-form" className="admin-modal__body" onSubmit={saveSettings}>
              {settingsError ? <p className="admin-form-error">{settingsError}</p> : null}
              <div className="admin-form-grid admin-form-grid-single">
                <label>
                  Ad
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" disabled={settingsSaving} required />
                </label>
                <label>
                  Soyad
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" disabled={settingsSaving} required />
                </label>
                <label>
                  E-posta
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={settingsSaving} required />
                </label>
                <label>
                  Mevcut şifre <small className="admin-settings-hint">(e-posta veya şifre değişince zorunlu)</small>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={settingsSaving}
                  />
                </label>
                <label>
                  Yeni şifre <small className="admin-settings-hint">(isteğe bağlı)</small>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={settingsSaving}
                  />
                </label>
                {newPassword ? (
                  <label>
                    Yeni şifre (tekrar)
                    <input
                      type="password"
                      value={newPassword2}
                      onChange={(e) => setNewPassword2(e.target.value)}
                      autoComplete="new-password"
                      disabled={settingsSaving}
                    />
                  </label>
                ) : null}
              </div>
            </form>
            <footer className="admin-modal__footer">
              <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => !settingsSaving && setSettingsOpen(false)}>
                Vazgeç
              </button>
              <button type="submit" form="admin-settings-form" className="btn btn--modal-primary" disabled={settingsSaving}>
                {settingsSaving ? "…" : "Kaydet"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
