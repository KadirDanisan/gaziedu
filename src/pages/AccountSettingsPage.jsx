import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const genderOptions = [
  { value: "", label: "Seçilmedi" },
  { value: "1", label: "Kadın" },
  { value: "2", label: "Erkek" },
  { value: "3", label: "Belirtmek İstemiyorum" },
];

const customerTypeOptions = [
  { value: "1", label: "Bireysel" },
  { value: "2", label: "Kurumsal" },
];

const countryOptions = [
  { value: "", label: "Bulunduğunuz Ülke" },
  { value: "215", label: "Türkiye" },
  { value: "13", label: "Australia" },
  { value: "38", label: "Canada" },
  { value: "81", label: "Germany" },
  { value: "222", label: "United Kingdom" },
  { value: "223", label: "United States" },
];

const cityOptions = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ankara",
  "Antalya",
  "Bursa",
  "Çanakkale",
  "Eskişehir",
  "Gaziantep",
  "İstanbul",
  "İzmir",
  "Kocaeli",
  "Konya",
  "Mersin",
  "Muğla",
  "Sakarya",
  "Samsun",
  "Şanlıurfa",
  "Tekirdağ",
  "Trabzon",
];

function AccountSettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user.fullName.split(" ")[0] || "",
    surname: user.fullName.split(" ").slice(1).join(" ") || "",
    email: user.email || "",
    phone: user.phone || "",
    job: user.profession || "",
    gender: "",
    customerType: "1",
    identityNumber: "",
    firm: "",
    tax: "",
    taxNumber: "",
    address: "",
    address2: "",
    country: "215",
    city: "",
    suburb: "",
    postCode: "",
  });

  const isCorporate = form.customerType === "2";
  const currentTitle = useMemo(
    () => (isCorporate ? "Kurumsal" : "Bireysel"),
    [isCorporate]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSaved(false);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <div className="account-panel">
      <h3>Bilgilerimi Güncelle</h3>

      <form className="account-form-grid" onSubmit={handleSubmit}>
        <div className="account-form-group">
          <label htmlFor="name">Adınız *:</label>
          <input id="name" name="name" type="text" value={form.name} onChange={handleChange} required />
        </div>

        <div className="account-form-group">
          <label htmlFor="surname">Soyadınız *:</label>
          <input id="surname" name="surname" type="text" value={form.surname} onChange={handleChange} required />
        </div>

        <div className="account-form-group">
          <label htmlFor="email">E-Posta Adresiniz *:</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>

        <div className="account-form-group">
          <label htmlFor="phone">Telefon Numaranız:</label>
          <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={12} />
        </div>

        <div className="account-form-group">
          <label htmlFor="job">Mesleğiniz:</label>
          <input id="job" name="job" type="text" value={form.job} onChange={handleChange} />
        </div>

        <div className="account-form-group">
          <label htmlFor="gender">Cinsiyet:</label>
          <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
            {genderOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="account-form-group account-form-group-full">
          <label htmlFor="customerType">Kullanıcı Tipi:</label>
          <select id="customerType" name="customerType" value={form.customerType} onChange={handleChange}>
            {customerTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="account-form-note">Seçili tip: {currentTitle}</small>
        </div>

        {!isCorporate ? (
          <div className="account-form-group account-form-group-full">
            <label htmlFor="identityNumber">T.C. Kimlik Numaranız:</label>
            <input
              id="identityNumber"
              name="identityNumber"
              type="text"
              minLength={11}
              maxLength={11}
              value={form.identityNumber}
              onChange={handleChange}
            />
          </div>
        ) : (
          <>
            <div className="account-form-group account-form-group-full">
              <label htmlFor="firm">Firma Ünvanı:</label>
              <input id="firm" name="firm" type="text" value={form.firm} onChange={handleChange} />
            </div>

            <div className="account-form-group">
              <label htmlFor="tax">Vergi Dairesi:</label>
              <input id="tax" name="tax" type="text" value={form.tax} onChange={handleChange} />
            </div>

            <div className="account-form-group">
              <label htmlFor="taxNumber">Vergi Numarası:</label>
              <input
                id="taxNumber"
                name="taxNumber"
                type="text"
                minLength={10}
                maxLength={10}
                value={form.taxNumber}
                onChange={handleChange}
              />
            </div>
          </>
        )}

        <div className="account-form-group">
          <label htmlFor="address">Adres 1:</label>
          <textarea
            id="address"
            name="address"
            rows="2"
            placeholder="Açık adresiniz..."
            maxLength={50}
            value={form.address}
            onChange={handleChange}
            required
          />
        </div>

        <div className="account-form-group">
          <label htmlFor="address2">Adres 2:</label>
          <textarea
            id="address2"
            name="address2"
            rows="2"
            placeholder="Adres devamı..."
            maxLength={50}
            value={form.address2}
            onChange={handleChange}
          />
        </div>

        <div className="account-form-group">
          <label htmlFor="country">Ülke:</label>
          <select id="country" name="country" value={form.country} onChange={handleChange} required>
            {countryOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="account-form-group">
          <label htmlFor="city">Şehir:</label>
          <select id="city" name="city" value={form.city} onChange={handleChange} required>
            <option value="">Bulunduğunuz Şehir</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="account-form-group">
          <label htmlFor="suburb">İlçe-Bölge:</label>
          <input id="suburb" name="suburb" type="text" value={form.suburb} onChange={handleChange} required />
        </div>

        <div className="account-form-group">
          <label htmlFor="postCode">Posta Kodu:</label>
          <input id="postCode" name="postCode" type="text" value={form.postCode} onChange={handleChange} required />
        </div>

        <div className="account-form-group account-form-group-full account-submit-wrap">
          <button type="submit" className="btn btn-gradient">
            Bilgilerimi Güncelle
          </button>
          {saved ? <span className="account-success-text">Bilgiler güncellendi.</span> : null}
        </div>
      </form>
    </div>
  );
}

export default AccountSettingsPage;
