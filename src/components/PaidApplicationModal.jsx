import { useEffect, useMemo, useState } from "react";
import { userApi } from "../api/userApi";
import { isValidTurkishNationalId, normalizeTurkishNationalId } from "../utils/turkishNationalId";

const STEPS = [
  { id: "personal", label: "Kişisel Bilgiler" },
  { id: "documents", label: "Başvuru formu" },
  { id: "payment", label: "Ödeme Bilgileri" },
  { id: "result", label: "Kayıt Sonuç" },
];

const DOC_FIELDS = [
  {
    key: "graduationDoc",
    pathKey: "graduationDocPath",
    nameKey: "graduationDocName",
    label: "Mezuniyet Belgesi *",
    hint: "PDF, Word veya görsel (en fazla 15 MB)",
  },
  {
    key: "kvkkDoc",
    pathKey: "kvkkDocPath",
    nameKey: "kvkkDocName",
    label: "KVKK Aydınlatma Onaylandı Formu *",
    hint: "İmzalı onay formunu yükleyin",
  },
  {
    key: "institutionDoc",
    pathKey: "institutionDocPath",
    nameKey: "institutionDocName",
    label: "Bağlı olduğu kurum veya anabilim dalını gösteren belge *",
    hint: "Kurum / anabilim dalı belgesi",
  },
];

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  nationalId: "",
  phone: "",
  birthDate: "",
  graduationDocPath: "",
  graduationDocName: "",
  kvkkDocPath: "",
  kvkkDocName: "",
  institutionDocPath: "",
  institutionDocName: "",
  infoConfirmed: false,
  paymentMethod: "tek-cekim",
};

const HALKBANK_PAYMENT_URL = "https://sanalpos.halkbank.com.tr/fim/est3Dgate";

const formatMoneyTry = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "Belirtilmedi";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
};

/** (507) 020 45 78 */
const formatPhoneDisplay = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 8) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
};

const phoneDigits = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
};

function PaidApplicationModal({ open, onClose, course, user, onSubmitted }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setStepIndex(0);
    setError("");
    setSubmitting(false);
    setUploadingKey("");
    setResult(null);
    setForm({
      ...emptyForm,
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      nationalId: user?.nationalId || "",
      birthDate: user?.birthDate || "",
    });

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, user, onClose]);

  const educationTitle = course?.title || "Eğitim";
  const educationCode = course?.code || "";

  const nationalIdDigits = useMemo(
    () => normalizeTurkishNationalId(form.nationalId),
    [form.nationalId],
  );

  const patch = (key, value) => {
    setError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validatePersonal = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Ad ve soyad zorunludur.";
    if (!form.email.trim() || !form.email.includes("@")) return "Geçerli bir e-posta giriniz.";
    if (nationalIdDigits.length !== 11 || !isValidTurkishNationalId(nationalIdDigits)) {
      return "Geçerli bir T.C. kimlik numarası giriniz.";
    }
    if (phoneDigits(form.phone).length !== 10) {
      return "Telefon numarasını (5xx) xxx xx xx formatında giriniz.";
    }
    if (!form.birthDate) return "Doğum tarihi zorunludur.";
    const birth = new Date(form.birthDate);
    if (Number.isNaN(birth.getTime()) || birth > new Date()) {
      return "Geçerli bir doğum tarihi giriniz.";
    }
    return "";
  };

  const validateDocuments = () => {
    if (!form.graduationDocPath) return "Mezuniyet belgesini yükleyiniz.";
    if (!form.kvkkDocPath) return "KVKK Aydınlatma Onaylandı Formunu yükleyiniz.";
    if (!form.institutionDocPath) return "Kurum / anabilim dalı belgesini yükleyiniz.";
    if (!form.infoConfirmed) return "Bilgilerimi Onaylıyorum kutusunu işaretleyiniz.";
    return "";
  };

  const handleDocUpload = async (field, file) => {
    if (!file) return;
    setUploadingKey(field.key);
    setError("");
    try {
      const uploaded = await userApi.uploadEducationApplicationDoc(file);
      setForm((prev) => ({
        ...prev,
        [field.pathKey]: uploaded?.path || "",
        [field.nameKey]: uploaded?.fileName || file.name,
      }));
      if (!uploaded?.path) setError("Dosya yüklendi ancak yol alınamadı. Tekrar deneyin.");
    } catch (err) {
      setError(err?.message || "Dosya yüklenemedi.");
    } finally {
      setUploadingKey("");
    }
  };

  const goNext = () => {
    setError("");
    if (stepIndex === 0) {
      const msg = validatePersonal();
      if (msg) {
        setError(msg);
        return;
      }
      setStepIndex(1);
      return;
    }
    if (stepIndex === 1) {
      const msg = validateDocuments();
      if (msg) {
        setError(msg);
        return;
      }
      setStepIndex(2);
    }
  };

  const goBack = () => {
    setError("");
    if (stepIndex > 0 && stepIndex < 3) setStepIndex((prev) => prev - 1);
  };

  const openPaymentScreen = () => {
    window.open(HALKBANK_PAYMENT_URL, "_blank", "noopener,noreferrer");
  };

  const openPaymentAndSubmit = async () => {
    openPaymentScreen();
    await submitApplication();
  };

  const submitApplication = async () => {
    if (!course?.id) {
      setError("Eğitim bilgisi bulunamadı.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const data = await userApi.submitEducationApplication({
        educationId: course.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        nationalId: nationalIdDigits,
        phone: phoneDigits(form.phone),
        birthDate: form.birthDate,
        graduationDocPath: form.graduationDocPath,
        kvkkDocPath: form.kvkkDocPath,
        institutionDocPath: form.institutionDocPath,
        infoConfirmed: true,
        paymentMethod: "tek-cekim",
        paymentNote: "",
      });
      setResult(data?.application || data);
      setStepIndex(3);
      onSubmitted?.(data?.application || data);
    } catch (err) {
      setError(err?.message || "Başvuru kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const busy = submitting || Boolean(uploadingKey);

  return (
    <div
      className="paid-apply-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div
        className="paid-apply-modal paid-apply-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paid-apply-modal-title"
      >
        <div className="paid-apply-modal__head">
          <div>
            <h2 id="paid-apply-modal-title">Başvuru</h2>
            <p className="paid-apply-modal__subtitle">
              {educationTitle}
              {educationCode ? ` · ${educationCode}` : ""}
            </p>
          </div>
          <button type="button" className="paid-apply-modal__close" aria-label="Kapat" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <ol className="paid-apply-steps paid-apply-steps--4" aria-label="Başvuru adımları">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={`paid-apply-steps__item${index === stepIndex ? " is-active" : ""}${
                index < stepIndex ? " is-done" : ""
              }`}
            >
              <span className="paid-apply-steps__index">{index + 1}</span>
              <span className="paid-apply-steps__label">{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="paid-apply-modal__body">
          {stepIndex === 0 ? (
            <div className="paid-apply-form-grid">
              <label className="paid-apply-field">
                <span>Ad *</span>
                <input value={form.firstName} onChange={(e) => patch("firstName", e.target.value)} autoComplete="given-name" />
              </label>
              <label className="paid-apply-field">
                <span>Soyad *</span>
                <input value={form.lastName} onChange={(e) => patch("lastName", e.target.value)} autoComplete="family-name" />
              </label>
              <label className="paid-apply-field">
                <span>E-posta *</span>
                <input type="email" value={form.email} readOnly autoComplete="email" />
                <p className="paid-apply-result__muted">Müfredat erişimi bu hesap e-postası ile yapılır; değiştirilemez.</p>
              </label>
              <label className="paid-apply-field">
                <span>T.C. Kimlik No *</span>
                <input
                  value={form.nationalId}
                  onChange={(e) => patch("nationalId", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  maxLength={11}
                />
              </label>
              <label className="paid-apply-field">
                <span>Telefon *</span>
                <input
                  value={form.phone}
                  onChange={(e) => patch("phone", formatPhoneDisplay(e.target.value))}
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="(507) 020 45 78"
                  maxLength={16}
                />
              </label>
              <label className="paid-apply-field">
                <span>Doğum Tarihi *</span>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => patch("birthDate", e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>
          ) : null}

          {stepIndex === 1 ? (
            <div className="paid-apply-docs">
              {DOC_FIELDS.map((field) => (
                <div key={field.key} className="paid-apply-doc-card">
                  <span className="paid-apply-doc-card__label">{field.label}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleDocUpload(field, file);
                      event.target.value = "";
                    }}
                  />
                  {uploadingKey === field.key ? <small>Yükleniyor…</small> : null}
                  {form[field.pathKey] ? (
                    <small className="paid-apply-doc-card__file">
                      <i className="fa-regular fa-circle-check" aria-hidden /> {form[field.nameKey] || form[field.pathKey]}
                      <button
                        type="button"
                        className="paid-apply-doc-card__remove"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            [field.pathKey]: "",
                            [field.nameKey]: "",
                          }))
                        }
                      >
                        kaldır
                      </button>
                    </small>
                  ) : (
                    <small className="paid-apply-doc-card__hint">{field.hint}</small>
                  )}
                </div>
              ))}

              <label className="paid-apply-check">
                <input
                  type="checkbox"
                  checked={form.infoConfirmed}
                  onChange={(e) => patch("infoConfirmed", e.target.checked)}
                />
                <span>Bilgilerimi Onaylıyorum</span>
              </label>
            </div>
          ) : null}

          {stepIndex === 2 ? (
            <div className="paid-apply-payment">
              <div className="paid-apply-payment__card">
                <h3>Ödeme özeti</h3>
                <ul>
                  <li>
                    <span>Başvuru Adı</span>
                    <strong>GAZİ ÜNİVERSİTESİ UZAKTAN EĞİTİM MERKEZİ</strong>
                  </li>
                  <li>
                    <span>Açıklama</span>
                    <strong>{educationTitle}</strong>
                  </li>
                  <li>
                    <span>Kimlik / T.C. No</span>
                    <strong>{nationalIdDigits || "—"}</strong>
                  </li>
                  <li>
                    <span>Ad Soyad</span>
                    <strong>
                      {[form.firstName, form.lastName].filter(Boolean).join(" ").trim() || "—"}
                    </strong>
                  </li>
                  <li>
                    <span>Kayıt Ücreti</span>
                    <strong>
                      {formatMoneyTry(course?.price)}
                      {course?.hasDiscount && course?.discountRate ? ` · %${course.discountRate} indirim` : ""}
                    </strong>
                  </li>
                  <li>
                    <span>Ödenecek Tutar</span>
                    <strong>{formatMoneyTry(course?.payableAmount ?? course?.price)}</strong>
                  </li>
                  <li>
                    <span>Ödeme Türü</span>
                    <strong>Tek Çekim</strong>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="btn paid-apply-payment__cta"
                onClick={openPaymentAndSubmit}
                disabled={busy}
              >
                {submitting ? "Kaydediliyor…" : "Ödeme Ekranı"}
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden />
              </button>
              <p className="paid-apply-payment__hint">
                Güvenli ödeme için Halkbank 3D Gate ekranına yönlendirileceksiniz. Ödeme sonrası
                kaydınız alınır.
              </p>
            </div>
          ) : null}

          {stepIndex === 3 ? (
            <div className="paid-apply-result">
              <div className="paid-apply-result__icon" aria-hidden>
                <i className="fa-solid fa-circle-check" />
              </div>
              <h3>Kaydınız alınmıştır</h3>
              <p>
                {educationTitle} başvurusu başarıyla tamamlandı.
                {result?.id ? (
                  <>
                    {" "}
                    Başvuru no: <strong>{String(result.id).slice(0, 8).toUpperCase()}</strong>
                  </>
                ) : null}
              </p>
              <p className="paid-apply-result__muted">
                Ödeme ve belge kontrolünden sonra size e-posta ile bilgilendirme yapılacaktır.
              </p>
            </div>
          ) : null}

          {error ? <p className="paid-apply-error">{error}</p> : null}
        </div>

        <div className="paid-apply-modal__footer">
          {stepIndex < 3 ? (
            <>
              <button type="button" className="btn btn-outline" onClick={stepIndex === 0 ? onClose : goBack} disabled={busy}>
                {stepIndex === 0 ? "İptal" : "Geri"}
              </button>
              {stepIndex < 2 ? (
                <button type="button" className="btn" onClick={goNext} disabled={busy}>
                  {uploadingKey ? "Yükleniyor…" : "Devam"}
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="btn" onClick={onClose}>
              Kapat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaidApplicationModal;
