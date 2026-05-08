import { useAuth } from "../context/AuthContext";

function AccountProfilePage() {
  const { user } = useAuth();

  const dash = (v) => (v && String(v).trim() ? String(v).trim() : "—");

  const rows = [
    { label: "Adınız Soyadınız:", value: dash(user.fullName) },
    { label: "E-Posta Adresiniz:", value: dash(user.email) },
    { label: "T.C. Kimlik Numaranız:", value: dash(user.nationalId) },
    { label: "Cinsiyet:", value: dash(user.genderLabel) },
    { label: "Adres:", value: dash(user.addressLine1) },
    { label: "Ülke:", value: dash(user.countryLabel || user.countryCode) },
    { label: "Şehir:", value: dash(user.city) },
    { label: "İlçe / Bölge:", value: dash(user.district) },
    { label: "Posta Kodu:", value: dash(user.postalCode) },
  ];

  return (
    <div className="account-panel">
      <h3>Hesap Bilgilerim</h3>
      {rows.map((row) => (
        <div className="account-info-row" key={row.label}>
          <div className="account-info-label">{row.label}</div>
          <div className="account-info-value">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default AccountProfilePage;
