import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("superadmin@gazi.edu.tr");
  const [password, setPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await loginAdmin(email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate("/admin/dashboard", { replace: true });
  };

  return (
    <section className="admin-auth-page">
      <div className="admin-auth-bg" />
      <div className="admin-auth-shell">
        <aside className="admin-auth-hero">
          <img src="/Gazi_Üniversitesi_logo.png" alt="Gazi Üniversitesi" className="admin-auth-logo" />
          <h1>GAZİ'nin Dijital Yüzü CRM Yönetim Paneli</h1>
          <p>Kurumsal yönetim, içerik planlama ve kullanıcı operasyonlarını tek ekrandan yönetin.</p>
          <ul>
            <li>Rol bazlı güvenli erişim</li>
            <li>Takvim ve eğitim operasyonları</li>
            <li>Aktivite ve hata kayıt takibi</li>
          </ul>
        </aside>

        <form className="admin-auth-card" onSubmit={handleSubmit}>
          <h2>Yönetim Paneli Girişi</h2>
          <p>Yönetim ekranına erişmek için bilgilerinizi girin.</p>
          <label>
            <span>E-Posta</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Şifre</span>
            <div className="admin-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 4.25a.75.75 0 0 1 1.06 0l16 16a.75.75 0 1 1-1.06 1.06l-2.33-2.33A11.05 11.05 0 0 1 12 20c-4.83 0-8.87-3.1-10.39-7.4a.75.75 0 0 1 0-.5 11.2 11.2 0 0 1 4.07-5.49L2.94 5.31A.75.75 0 0 1 3 4.25Zm7.33 7.33a2.5 2.5 0 0 0 3.09 3.09l-3.09-3.09Zm6.22 5.16-1.94-1.94a4 4 0 0 0-5.4-5.4L7.34 7.53a9.69 9.69 0 0 0-4.2 4.82C4.55 15.9 7.98 18.5 12 18.5c1.66 0 3.24-.44 4.55-1.26Zm5.84-4.64a.75.75 0 0 1 0 .5 11.07 11.07 0 0 1-4.04 5.47l-1.14-1.14a9.51 9.51 0 0 0 3.65-4.58C19.45 8.1 16.02 5.5 12 5.5c-1.4 0-2.74.31-3.95.88L6.9 5.23A11.02 11.02 0 0 1 12 4c4.83 0 8.87 3.1 10.39 7.4Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4c4.83 0 8.87 3.1 10.39 7.4a.75.75 0 0 1 0 .5C20.87 16.2 16.83 19.3 12 19.3S3.13 16.2 1.61 11.9a.75.75 0 0 1 0-.5C3.13 7.1 7.17 4 12 4Zm0 1.5c-4.02 0-7.45 2.6-8.86 6.15C4.55 15.2 7.98 17.8 12 17.8s7.45-2.6 8.86-6.15C19.45 8.1 16.02 5.5 12 5.5Zm0 2.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {error && <small className="admin-form-error">{error}</small>}
          <button type="submit" className="btn">
            Giriş Yap
          </button>
        </form>
      </div>
    </section>
  );
}
