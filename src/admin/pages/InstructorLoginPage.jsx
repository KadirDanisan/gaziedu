import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function InstructorLoginPage() {
  const navigate = useNavigate();
  const { loginInstructor } = useAdminAuth();
  const [email, setEmail] = useState("egitmen1@gazi.edu.tr");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = loginInstructor(email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate("/admin/dashboard", { replace: true });
  };

  return (
    <section className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <h2>Eğitmen Giriş</h2>
        <p>Kendinize atanmış eğitim ve sınav sorularını yönetin.</p>
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
        <Link to="/admin/giris">Admin girişine git</Link>
      </form>
    </section>
  );
}
