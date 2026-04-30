import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("superadmin@gazi.edu.tr");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = loginAdmin(email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate("/admin/dashboard", { replace: true });
  };

  return (
    <section className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <h2>Admin Giriş</h2>
        <p>CRM yönetim paneli erişimi.</p>
        <label>
          <span>E-Posta</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          <span>Şifre</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <small className="admin-form-error">{error}</small>}
        <button type="submit" className="btn">
          Giriş Yap
        </button>
        <Link to="/egitmen/giris">Eğitmen girişine git</Link>
      </form>
    </section>
  );
}
