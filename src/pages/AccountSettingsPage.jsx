import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { userApi } from "../api/userApi";

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
  const { user, refreshProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
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

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: user.firstName || user.fullName?.split(" ")?.[0] || "",
      surname: user.lastName || user.fullName?.split(" ")?.slice(1)?.join(" ") || "",
      email: user.email || "",
      gender: user.gender != null ? String(user.gender) : "",
      customerType: user.customerType || "1",
      identityNumber: user.nationalId || "",
      address: user.addressLine1 || "",
      address2: user.addressLine2 || "",
      country: user.countryCode || "215",
      city: user.city || "",
      suburb: user.district || "",
      postCode: user.postalCode || "",
    }));
  }, [
    user.firstName,
    user.lastName,
    user.fullName,
    user.email,
    user.gender,
    user.customerType,
    user.nationalId,
    user.addressLine1,
    user.addressLine2,
    user.countryCode,
    user.city,
    user.district,
    user.postalCode,
  ]);

  const isCorporate = form.customerType === "2";
  const currentTitle = useMemo(
    () => (isCorporate ? "Kurumsal" : "Bireysel"),
    [isCorporate]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSaved(false);
    setSaveError("");
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaved(false);
    setSaveError("");
    try {
      await userApi.updateMe({
        firstName: form.name.trim(),
        lastName: form.surname.trim(),
        email: form.email.trim(),
        nationalId: form.identityNumber.trim() || null,
        gender: form.gender,
        customerType: form.customerType,
        addressLine1: form.address.trim(),
        addressLine2: form.address2.trim() || null,
        countryCode: form.country.trim(),
        city: form.city.trim(),
        district: form.suburb.trim(),
        postalCode: form.postCode.trim(),
      });
      await refreshProfile();
      setSaved(true);
    } catch (error) {
      setSaveError(error.message || "Kayıt sırasında hata oluştu.");
    }
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
          <label htmlFor="identityNumber">T.C. Kimlik Numaranız:</label>
          <input
            id="identityNumber"
            name="identityNumber"
            type="text"
            inputMode="numeric"
            maxLength={11}
            placeholder="11 hane"
            value={form.identityNumber}
            onChange={handleChange}
          />
        </div>

        {isCorporate ? (
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
        ) : null}

        <div className="account-form-group">
          <label htmlFor="address">Adres:</label>
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
          {saveError ? <span className="account-error-text">{saveError}</span> : null}
          {saved ? <span className="account-success-text">Bilgiler güncellendi.</span> : null}
        </div>
      </form>
    </div>
  );
}

export default AccountSettingsPage;
