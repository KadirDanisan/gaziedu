import { useEffect, useState } from "react";
import { userApi } from "../api/userApi";

const STEPS = [
  { id: "account", label: "Kayıt / Giriş" },
  { id: "email", label: "E-posta Doğrulama" },
  { id: "approval", label: "Admin Onayı" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Türk Eğitim Sen İşbirliği eğitimleri: giriş yapmış kullanıcı e-postasını doğrulama için gönderir,
 * admin panelinde "Eğitmen Doğrulama" listesinden onaylanınca eğitim içeriği açılır.
 */
function InstructorVerificationModal({ open, onClose, course, user, onStatusChange }) {
  const [status, setStatus] = useState("loading");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError("");
    setStatus("loading");
    setEmail(String(user?.email || "").trim());
    userApi
      .getInstructorVerification()
      .then((res) => {
        if (cancelled) return;
        setStatus(res?.status || "verification_required");
        if (res?.verification?.verificationEmail) setEmail(res.verification.verificationEmail);
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("verification_required");
        setError(e?.message || "Doğrulama durumu alınamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.email]);

  if (!open) return null;

  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setError("Geçerli bir e-posta adresi giriniz.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await userApi.submitInstructorVerification({ email: value, educationId: course?.id });
      const next = res?.status || "verification_pending";
      setStatus(next);
      onStatusChange?.(next);
    } catch (e) {
      setError(e?.message || "Doğrulama talebi gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = status === "verified" ? 3 : status === "verification_pending" ? 2 : 1;
  const canSubmit = status === "verification_required" || status === "verification_rejected";

  return (
    <div
      className="paid-apply-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose?.()}
    >
      <div className="paid-apply-modal" role="dialog" aria-modal="true" aria-labelledby="instructor-verify-title">
        <div className="paid-apply-modal__head">
          <div>
            <h2 id="instructor-verify-title">Eğitmen Doğrulama</h2>
            <p className="paid-apply-modal__subtitle">
              {course?.title || "Türk Eğitim Sen İşbirliği"}
              {course?.code ? ` · ${course.code}` : ""}
            </p>
          </div>
          <button type="button" className="paid-apply-modal__close" aria-label="Kapat" onClick={onClose} disabled={submitting}>
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <ol className="paid-apply-steps" aria-label="Doğrulama adımları">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={`paid-apply-steps__item${index === stepIndex ? " is-active" : ""}${index < stepIndex ? " is-done" : ""}`}
            >
              <span className="paid-apply-steps__index">{index + 1}</span>
              <span className="paid-apply-steps__label">{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="paid-apply-modal__body">
          {status === "loading" ? <p>Yükleniyor…</p> : null}

          {canSubmit ? (
            <div className="paid-apply-form-grid">
              {status === "verification_rejected" ? (
                <p className="paid-apply-error" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  Önceki doğrulama talebiniz onaylanmadı. E-posta adresinizi kontrol edip tekrar gönderebilirsiniz.
                </p>
              ) : null}
              <label className="paid-apply-field" style={{ gridColumn: "1 / -1" }}>
                <span>Doğrulanacak e-posta adresi *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !submitting && submit()}
                  autoComplete="email"
                  disabled={submitting}
                />
                <p className="paid-apply-result__muted">
                  E-posta adresiniz yönetici onayına gönderilir. Onaylandıktan sonra Türk Eğitim Sen İşbirliği eğitimlerinin
                  video, PDF ve doküman içeriklerine erişip sınava girebilirsiniz.
                </p>
              </label>
            </div>
          ) : null}

          {status === "verification_pending" ? (
            <div className="paid-apply-result">
              <p>
                <i className="fa-regular fa-clock" aria-hidden /> Doğrulama talebiniz alındı:{" "}
                <strong>{email}</strong>
              </p>
              <p className="paid-apply-result__muted">
                Yönetici onayından sonra eğitim içeriği bu hesapla giriş yaptığınızda otomatik olarak açılır.
              </p>
            </div>
          ) : null}

          {status === "verified" ? (
            <div className="paid-apply-result">
              <p>
                <i className="fa-solid fa-circle-check" aria-hidden style={{ color: "#16a34a" }} /> Eğitmen doğrulamanız
                tamamlandı. Eğitim içeriğine erişebilirsiniz.
              </p>
            </div>
          ) : null}

          {error ? <p className="paid-apply-error">{error}</p> : null}
        </div>

        <div className="paid-apply-modal__footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            {canSubmit ? "İptal" : "Kapat"}
          </button>
          {canSubmit ? (
            <button type="button" className="btn" onClick={submit} disabled={submitting}>
              {submitting ? "Gönderiliyor…" : "Doğrulamaya Gönder"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default InstructorVerificationModal;
