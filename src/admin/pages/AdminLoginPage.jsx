import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

const FEATURES = [
  { icon: "fa-shield-halved", text: "Rol bazlı güvenli erişim" },
  { icon: "fa-calendar-days", text: "Takvim ve eğitim operasyonları" },
  { icon: "fa-chart-line", text: "Aktivite ve hata kayıt takibi" },
];

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await loginAdmin(email.trim(), password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigate("/admin/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-auth-page">
      <div className="admin-auth-bg" aria-hidden />
      <div className="admin-auth-shell">
        <aside className="admin-auth-hero">
          <span className="admin-auth-badge">
            <i className="fa-solid fa-lock" aria-hidden />
            Yönetim Paneli
          </span>
          <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="admin-auth-logo" />
          <h1>GAZİ&apos;nin Dijital Yüzü CRM Yönetim Paneli</h1>
          <p>Kurumsal yönetim, içerik planlama ve kullanıcı operasyonlarını tek ekrandan yönetin.</p>
          <ul className="admin-auth-features">
            {FEATURES.map((item) => (
              <li key={item.text}>
                <i className={`fa-solid ${item.icon}`} aria-hidden />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </aside>

        <form className="admin-auth-card" onSubmit={handleSubmit} noValidate>
          <div className="admin-auth-card-head">
            <div className="admin-auth-card-icon" aria-hidden>
              <i className="fa-solid fa-user-shield" />
            </div>
            <div>
              <h2>Yönetim Paneli Girişi</h2>
              <p>Yetkili hesabınızla devam edin.</p>
            </div>
          </div>

          <label>
            <span>E-posta</span>
            <div className="admin-auth-input-wrap">
              <i className="fa-regular fa-envelope" aria-hidden />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@gazi.edu.tr"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          </label>

          <label>
            <span>Şifre</span>
            <div className="admin-password-field admin-auth-input-wrap">
              <i className="fa-solid fa-key" aria-hidden />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                <i className={`fa-regular ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden />
              </button>
            </div>
          </label>

          {error ? (
            <p className="admin-auth-alert" role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden />
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn admin-auth-submit" disabled={submitting}>
            {submitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                Giriş yapılıyor…
              </>
            ) : (
              <>
                Giriş Yap
                <i className="fa-solid fa-arrow-right" aria-hidden />
              </>
            )}
          </button>

          <Link to="/" className="admin-auth-back">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Ana siteye dön
          </Link>
        </form>
      </div>
    </section>
  );
}
