import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isResetMode, setIsResetMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState("");

  const passwordMismatch =
    registerPasswordRepeat.length > 0 && registerPassword !== registerPasswordRepeat;

  const handleLogin = (event) => {
    event.preventDefault();
    login({
      email: loginEmail || "kadir@fadestudio.com.tr",
      fullName: "kadir danışan",
    });
    navigate("/hesabim/hesap-bilgilerim");
  };

  return (
    <section className="auth-page section">
      <div className="auth-grid">
        <div>
          {!isResetMode ? (
            <div className="auth-card">
              <h3>Giriş Yap</h3>
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="auth-field">
                  <label htmlFor="login-email">E-Posta Adresiniz *</label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="login-password">Şifreniz *</label>
                  <input id="login-password" type="password" required />
                </div>

                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" />
                    <span>Beni Hatırla</span>
                  </label>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => setIsResetMode(true)}
                  >
                    Şifremi Unuttum
                  </button>
                </div>

                <button type="submit" className="btn auth-submit-btn">
                  Giriş Yap <i className="fa-solid fa-arrow-right" />
                </button>
              </form>
            </div>
          ) : (
            <div className="auth-card">
              <h3>Şifremi Sıfırla</h3>
              <form className="auth-form">
                <div className="auth-field">
                  <label htmlFor="reset-email">E-Posta Adresiniz *</label>
                  <input id="reset-email" type="email" required />
                </div>

                <div className="auth-row auth-row-end">
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => setIsResetMode(false)}
                  >
                    Giriş Yap
                  </button>
                </div>

                <button type="submit" className="btn auth-submit-btn">
                  Şifremi Sıfırla <i className="fa-solid fa-arrow-right" />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="auth-card">
          <h3>Hesap Oluştur</h3>
          <form className="auth-form">
            <div className="auth-two-col">
              <div className="auth-field">
                <label htmlFor="register-name">Adınız *</label>
                <input id="register-name" type="text" required />
              </div>
              <div className="auth-field">
                <label htmlFor="register-surname">Soyadınız *</label>
                <input id="register-surname" type="text" required />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">E-Posta Adresiniz *</label>
              <input id="register-email" type="email" required />
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Şifreniz *</label>
              <input
                id="register-password"
                type="password"
                required
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-password-repeat">Şifreniz Tekrar *</label>
              <input
                id="register-password-repeat"
                type="password"
                required
                value={registerPasswordRepeat}
                onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
              />
              {passwordMismatch && (
                <small className="auth-error">Yazdığınız şifreler birbiri ile aynı değil.</small>
              )}
            </div>

            <button type="submit" className="btn auth-submit-btn" disabled={passwordMismatch}>
              Üye Ol <i className="fa-solid fa-arrow-right" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default AuthPage;
