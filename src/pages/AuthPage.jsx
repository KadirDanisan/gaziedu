import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isValidTurkishNationalId, normalizeTurkishNationalId } from "../utils/turkishNationalId";
import {
  clearRememberLogin,
  getRememberLogin,
  setRememberLogin,
} from "../utils/rememberLoginCookie";

function AuthPage() {
  const navigate = useNavigate();
  const { loginUser, registerUser } = useAuth();
  const [isResetMode, setIsResetMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordRepeat, setShowRegisterPasswordRepeat] = useState(false);
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerNationalId, setRegisterNationalId] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState("");
  const [registerAcceptKvkk, setRegisterAcceptKvkk] = useState(false);
  const [registerAcceptTerms, setRegisterAcceptTerms] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);

  useEffect(() => {
    const saved = getRememberLogin();
    if (saved?.email?.trim()) {
      setLoginEmail(saved.email);
      setLoginPassword(saved.password || "");
      setRememberMe(true);
      setHasSavedLogin(true);
    }
  }, []);

  /** Beni Hatırla açıkken e-posta / şifre değiştikçe localStorage + çerez güncellenir */
  useEffect(() => {
    if (!rememberMe) return;
    const t = window.setTimeout(() => {
      if (loginEmail.trim() && loginPassword.length > 0) {
        setRememberLogin({ email: loginEmail.trim(), password: loginPassword });
        setHasSavedLogin(true);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [rememberMe, loginEmail, loginPassword]);

  const passwordMismatch =
    registerPasswordRepeat.length > 0 && registerPassword !== registerPasswordRepeat;

  const handleClearSavedLogin = () => {
    clearRememberLogin();
    setRememberMe(false);
    setHasSavedLogin(false);
    setLoginEmail("");
    setLoginPassword("");
  };

  const registerTcDigits = normalizeTurkishNationalId(registerNationalId);
  const registerTcValid =
    registerTcDigits.length === 11 && isValidTurkishNationalId(registerNationalId);
  const registerTcShowInvalid = registerTcDigits.length === 11 && !registerTcValid;

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoadingLogin(true);
    setLoginError("");
    try {
      await loginUser({ email: loginEmail, password: loginPassword });
      if (rememberMe) {
        setRememberLogin({ email: loginEmail.trim(), password: loginPassword });
        setHasSavedLogin(true);
      } else {
        clearRememberLogin();
        setHasSavedLogin(false);
      }
      navigate("/hesabim/hesap-bilgilerim");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!registerAcceptKvkk || !registerAcceptTerms) {
      setRegisterError(
        "Hesap oluşturmak için KVKK aydınlatma metni ile web sitesi kullanım ve gizlilik koşullarını okuyup onaylamanız gerekir.",
      );
      return;
    }
    if (passwordMismatch || !registerTcValid) return;
    setLoadingRegister(true);
    setRegisterError("");
    setRegisterSuccess("");
    const savedEmail = registerEmail;
    try {
      await registerUser({
        firstName: registerFirstName,
        lastName: registerLastName,
        email: registerEmail,
        password: registerPassword,
        nationalId: registerTcDigits,
      });
      setRegisterSuccess("Hesabınız oluşmuştur, giriş yapabilirsiniz.");
      setRegisterFirstName("");
      setRegisterLastName("");
      setRegisterEmail("");
      setRegisterNationalId("");
      setRegisterPassword("");
      setRegisterPasswordRepeat("");
      setRegisterAcceptKvkk(false);
      setRegisterAcceptTerms(false);
      setLoginEmail(savedEmail);
    } catch (error) {
      setRegisterError(error.message);
    } finally {
      setLoadingRegister(false);
    }
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
                    autoComplete="username"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="login-password">Şifreniz *</label>
                  <div className="auth-password-wrap">
                    <input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showLoginPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                    >
                      <i className={`fa-solid ${showLoginPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden />
                    </button>
                  </div>
                </div>
                {loginError ? <small className="auth-error">{loginError}</small> : null}

                <div className="auth-row">
                  <label className="auth-check">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRememberMe(checked);
                        if (!checked) {
                          clearRememberLogin();
                          setHasSavedLogin(false);
                          return;
                        }
                        if (loginEmail.trim() && loginPassword.length > 0) {
                          setRememberLogin({ email: loginEmail.trim(), password: loginPassword });
                          setHasSavedLogin(true);
                        }
                      }}
                    />
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

                <button type="submit" className="btn auth-submit-btn" disabled={loadingLogin}>
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
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-two-col">
              <div className="auth-field">
                <label htmlFor="register-name">Adınız *</label>
                <input
                  id="register-name"
                  type="text"
                  required
                  value={registerFirstName}
                  onChange={(event) => setRegisterFirstName(event.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="register-surname">Soyadınız *</label>
                <input
                  id="register-surname"
                  type="text"
                  required
                  value={registerLastName}
                  onChange={(event) => setRegisterLastName(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">E-Posta Adresiniz *</label>
              <input
                id="register-email"
                type="email"
                required
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-tc">T.C. Kimlik Numaranız *</label>
              <input
                id="register-tc"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={11}
                placeholder="11 hane"
                value={registerNationalId}
                onChange={(event) => setRegisterNationalId(event.target.value.replace(/\D/g, "").slice(0, 11))}
              />
              {registerTcShowInvalid ? (
                <small className="auth-error">Geçerli bir T.C. kimlik numarası giriniz.</small>
              ) : null}
              {registerTcDigits.length > 0 && registerTcDigits.length < 11 ? (
                <small className="auth-error">T.C. kimlik numarası 11 hanedir.</small>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Şifreniz *</label>
              <div className="auth-password-wrap">
                <input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showRegisterPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                >
                  <i className={`fa-solid ${showRegisterPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden />
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password-repeat">Şifreniz Tekrar *</label>
              <div className="auth-password-wrap">
                <input
                  id="register-password-repeat"
                  type={showRegisterPasswordRepeat ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={registerPasswordRepeat}
                  onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showRegisterPasswordRepeat ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowRegisterPasswordRepeat((prev) => !prev)}
                >
                  <i
                    className={`fa-solid ${showRegisterPasswordRepeat ? "fa-eye-slash" : "fa-eye"}`}
                    aria-hidden
                  />
                </button>
              </div>
              {passwordMismatch && (
                <small className="auth-error">Yazdığınız şifreler birbiri ile aynı değil.</small>
              )}
            </div>

            <div className="auth-consent" role="group" aria-label="Yasal onaylar">
              <label className="auth-check auth-check--wrap">
                <input
                  type="checkbox"
                  checked={registerAcceptKvkk}
                  onChange={(event) => setRegisterAcceptKvkk(event.target.checked)}
                />
                <span>
                  <Link to="/kvkk-aydinlatma-metni" target="_blank" rel="noopener noreferrer">
                    Kişisel Verilerin Korunması Hakkında Aydınlatma Metni
                  </Link>
                  &apos;ni okudum ve kabul ediyorum.
                </span>
              </label>
              <label className="auth-check auth-check--wrap">
                <input
                  type="checkbox"
                  checked={registerAcceptTerms}
                  onChange={(event) => setRegisterAcceptTerms(event.target.checked)}
                />
                <span>
                  <Link to="/kullanim-kurallari-ve-gizlilik" target="_blank" rel="noopener noreferrer">
                    Web Sitesi Kullanım Kuralları ve Gizlilik Sözleşmesi
                  </Link>
                  &apos;ni okudum ve kabul ediyorum.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn auth-submit-btn"
              disabled={
                passwordMismatch ||
                !registerTcValid ||
                loadingRegister ||
                !registerAcceptKvkk ||
                !registerAcceptTerms
              }
            >
              {loadingRegister ? "Kaydediliyor..." : "Üye Ol"} <i className="fa-solid fa-arrow-right" />
            </button>
            {registerError ? <small className="auth-error">{registerError}</small> : null}
            {registerSuccess ? <small className="account-success-text">{registerSuccess}</small> : null}
          </form>
        </div>
      </div>
    </section>
  );
}

export default AuthPage;
