import { useAuth } from "../context/AuthContext";

function AccountProfilePage() {
  const { user } = useAuth();

  const rows = [
    { label: "Adınız Soyadınız:", value: user.fullName },
    { label: "E-Posta Adresiniz:", value: user.email },
    { label: "Telefon Numaranız:", value: user.phone || "-" },
    { label: "Mesleğiniz:", value: user.profession || "-" },
    { label: "Cinsiyet:", value: user.gender },
    { label: "Kullanıcı Tipi:", value: user.userType },
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
