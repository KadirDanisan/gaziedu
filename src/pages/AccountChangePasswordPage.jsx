import { useMemo, useState } from "react";

function AccountChangePasswordPage() {
  const [form, setForm] = useState({
    password: "",
    passwordRepeat: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const mismatch = useMemo(
    () =>
      form.password.length > 0 &&
      form.passwordRepeat.length > 0 &&
      form.password !== form.passwordRepeat,
    [form.password, form.passwordRepeat]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSubmitted(false);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mismatch) {
      return;
    }
    setSubmitted(true);
    setForm({
      password: "",
      passwordRepeat: "",
    });
  };

  return (
    <div className="account-panel">
      <h3>Şifremi Değiştir</h3>

      <form className="account-form-grid" onSubmit={handleSubmit}>
        <div className="account-form-group">
          <label htmlFor="password">Şifreniz *:</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        <div className="account-form-group">
          <label htmlFor="passwordRepeat">Şifreniz Tekrar *:</label>
          <input
            id="passwordRepeat"
            name="passwordRepeat"
            type="password"
            value={form.passwordRepeat}
            onChange={handleChange}
            required
          />
          {mismatch ? (
            <small className="account-error-text">Yazdığınız şifreler birbiri ile aynı değil.</small>
          ) : null}
        </div>

        <div className="account-form-group account-form-group-full account-submit-wrap">
          <button type="submit" className="btn btn-gradient" disabled={mismatch}>
            Şifremi Değiştir
          </button>
          {submitted ? <span className="account-success-text">Şifreniz güncellendi.</span> : null}
        </div>
      </form>
    </div>
  );
}

export default AccountChangePasswordPage;
