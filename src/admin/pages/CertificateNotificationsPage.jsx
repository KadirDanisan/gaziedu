import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import { useAdminAuth } from "../context/AdminAuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const resolveUploadUrl = (path) => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/uploads/")) return `${API_ORIGIN}${raw}`;
  return raw;
};

const formatIstanbul = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const emptyUploadForm = {
  pricedExcelPath: "",
  pricedExcelName: "",
  unpaidExcelPath: "",
  unpaidExcelName: "",
  receiptPdfPath: "",
  receiptPdfName: "",
};

function FileField({ label, accept, valueName, uploading, onPick }) {
  return (
    <label className="cert-notify-file">
      <span className="cert-notify-file__label">{label}</span>
      <span className="cert-notify-file__control">
        <input type="file" accept={accept} disabled={uploading} onChange={onPick} />
        <span className="cert-notify-file__name">{valueName || (uploading ? "Yükleniyor…" : "Dosya seçilmedi")}</span>
      </span>
    </label>
  );
}

function AcceptSignChecks({ acceptChecked, signChecked, onAcceptChange, onSignChange, disabled }) {
  return (
    <div className="cert-notify-checks">
      <label className="admin-checkbox">
        <input type="checkbox" checked={acceptChecked} disabled={disabled} onChange={(e) => onAcceptChange(e.target.checked)} />
        <span>Kabul et</span>
      </label>
      <label className="admin-checkbox">
        <input type="checkbox" checked={signChecked} disabled={disabled} onChange={(e) => onSignChange(e.target.checked)} />
        <span>İmzala</span>
      </label>
    </div>
  );
}

export default function CertificateNotificationsPage() {
  const { session, hasPermission } = useAdminAuth();
  const roleCode = String(session?.user?.roleCode || "").toLowerCase();
  const canCreate = hasPermission("certificateNotifications", "canCreate");
  const canUpdate = hasPermission("certificateNotifications", "canUpdate");
  const isSuperadmin = roleCode === "superadmin";
  const isYetkili = roleCode === "yetkili";
  const canSubmit = canCreate && (isSuperadmin || roleCode === "admin");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [uploadingKey, setUploadingKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [acceptChecked, setAcceptChecked] = useState(false);
  const [signChecked, setSignChecked] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getCertificateNotifications();
      setRows(res.data || []);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (row) => {
    setDetail(row);
    setAcceptChecked(false);
    setSignChecked(false);
  };

  const closeDetail = () => {
    if (busyId) return;
    setDetail(null);
    setAcceptChecked(false);
    setSignChecked(false);
  };

  const uploadField = async (key, file, pathKey, nameKey) => {
    if (!file) return;
    setUploadingKey(key);
    setError("");
    try {
      const res = await adminApi.uploadCertificateNotificationFile(file);
      setUploadForm((prev) => ({
        ...prev,
        [pathKey]: res.path,
        [nameKey]: res.fileName || file.name,
      }));
    } catch (e) {
      setError(e.message || "Dosya yüklenemedi.");
    } finally {
      setUploadingKey("");
    }
  };

  const submitForApproval = async () => {
    if (!uploadForm.pricedExcelPath || !uploadForm.unpaidExcelPath || !uploadForm.receiptPdfPath) {
      setError("Üç dosyayı da yükleyiniz.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await adminApi.createCertificateNotification(uploadForm);
      setSubmitOpen(false);
      setUploadForm(emptyUploadForm);
      window.dispatchEvent(new Event("certificate-notifications:changed"));
      await load();
    } catch (e) {
      setError(e.message || "Gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const approveSuperadmin = async () => {
    if (!detail?.id || !acceptChecked || !signChecked) return;
    setBusyId(detail.id);
    setError("");
    try {
      await adminApi.approveCertificateNotificationSuperadmin(detail.id);
      setDetail(null);
      window.dispatchEvent(new Event("certificate-notifications:changed"));
      await load();
    } catch (e) {
      setError(e.message || "Onaylanamadı.");
    } finally {
      setBusyId("");
    }
  };

  const acceptYetkili = async () => {
    if (!detail?.id || !acceptChecked || !signChecked) return;
    setBusyId(detail.id);
    setError("");
    try {
      await adminApi.acceptCertificateNotificationYetkili(detail.id);
      setDetail(null);
      window.dispatchEvent(new Event("certificate-notifications:changed"));
      await load();
    } catch (e) {
      setError(e.message || "Kabul edilemedi.");
    } finally {
      setBusyId("");
    }
  };

  const listTitle = isSuperadmin
    ? "Onayınıza sunulmuş veri"
    : isYetkili
      ? "Size iletilen bildirimler"
      : "Gönderdiğiniz bildirimler";

  const listHint = isSuperadmin
    ? "Fiyatlı Excel ve dekont PDF’ini inceleyip onaylayın; kayıt sertifika yetkilisine düşer."
    : isYetkili
      ? "Süper admin onayından sonra gelen kayıtlarda yalnızca fiyatsız Excel’i indirip kabul edin."
      : "E-Devlet sertifika onay paketlerini buradan süper admin onayına gönderebilirsiniz.";

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Sertifika Bildirim</h2>
          <p>{listHint}</p>
        </div>
        {canSubmit ? (
          <button type="button" className="btn" onClick={() => setSubmitOpen(true)}>
            E-Devlet Sertifika Onay
          </button>
        ) : null}
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      <article className="admin-panel-card">
        <h3 style={{ marginTop: 0 }}>{listTitle}</h3>
        {loading ? <p>Yükleniyor...</p> : null}
        {!loading && rows.length === 0 ? (
          <div className="admin-empty-state">
            <i className="fa-solid fa-bell" />
            <h3>Kayıt yok</h3>
            <p>Bu role ait bekleyen bildirim bulunmuyor.</p>
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Gönderen</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatIstanbul(row.submittedAt)}</td>
                    <td>{row.submitterName}</td>
                    <td>
                      {row.status === "pending_superadmin"
                        ? "Süper admin onayı bekliyor"
                        : row.status === "pending_yetkili"
                          ? "Yetkili kabulü bekliyor"
                          : "Tamamlandı"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {isSuperadmin && row.status === "pending_superadmin" ? (
                        <button type="button" className="btn btn-outline btn--sm" onClick={() => openDetail(row)}>
                          İncele / Onayla
                        </button>
                      ) : null}
                      {isYetkili && row.status === "pending_yetkili" ? (
                        <button type="button" className="btn btn--sm" onClick={() => openDetail(row)}>
                          Kabul et
                        </button>
                      ) : null}
                      {!isSuperadmin && !isYetkili ? (
                        <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>{formatIstanbul(row.submittedAt)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      {submitOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting && !uploadingKey) setSubmitOpen(false);
          }}
        >
          <div
            className="admin-modal admin-modal--detail"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 560, width: "min(560px, 94vw)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">E-Devlet Sertifika Onay</h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Fiyatlı / fiyatsız Excel ve dekont PDF’ini yükleyip onaya gönderin.
                </p>
              </div>
            </header>
            <div className="admin-modal__body">
              <FileField
                label="Fiyatlı Excel Tablosu"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                valueName={uploadForm.pricedExcelName}
                uploading={uploadingKey === "priced"}
                onPick={(e) => uploadField("priced", e.target.files?.[0], "pricedExcelPath", "pricedExcelName")}
              />
              <FileField
                label="Fiyatsız Excel Tablosu"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                valueName={uploadForm.unpaidExcelName}
                uploading={uploadingKey === "unpaid"}
                onPick={(e) => uploadField("unpaid", e.target.files?.[0], "unpaidExcelPath", "unpaidExcelName")}
              />
              <FileField
                label="Dekont PDF"
                accept=".pdf,application/pdf"
                valueName={uploadForm.receiptPdfName}
                uploading={uploadingKey === "pdf"}
                onPick={(e) => uploadField("pdf", e.target.files?.[0], "receiptPdfPath", "receiptPdfName")}
              />
            </div>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={Boolean(submitting || uploadingKey)}
                  onClick={() => setSubmitOpen(false)}
                >
                  Vazgeç
                </button>
                <button type="button" className="btn" disabled={Boolean(submitting || uploadingKey)} onClick={submitForApproval}>
                  {submitting ? "Gönderiliyor…" : "Onaya gönder"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {detail && isSuperadmin ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeDetail()}>
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 480, width: "min(480px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden>
                <i className="fa-solid fa-file-shield" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Süper admin onayı</h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Onayınıza sunulmuş veri · {formatIstanbul(detail.submittedAt)}
                </p>
              </div>
            </header>
            <div className="admin-modal__body">
              <ul className="edu-app-docs">
                <li>
                  <span>Fiyatlı Excel</span>
                  {detail.pricedExcelPath ? (
                    <a className="btn btn-outline btn--sm" href={resolveUploadUrl(detail.pricedExcelPath)} target="_blank" rel="noopener noreferrer">
                      İndir
                    </a>
                  ) : (
                    <em>Yok</em>
                  )}
                </li>
                <li>
                  <span>Dekont PDF</span>
                  {detail.receiptPdfPath ? (
                    <a className="btn btn-outline btn--sm" href={resolveUploadUrl(detail.receiptPdfPath)} target="_blank" rel="noopener noreferrer">
                      İndir
                    </a>
                  ) : (
                    <em>Yok</em>
                  )}
                </li>
              </ul>
              <AcceptSignChecks
                acceptChecked={acceptChecked}
                signChecked={signChecked}
                onAcceptChange={setAcceptChecked}
                onSignChange={setSignChecked}
                disabled={Boolean(busyId)}
              />
            </div>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button type="button" className="btn btn-outline btn--modal-secondary" disabled={Boolean(busyId)} onClick={closeDetail}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--success-fill"
                  disabled={!canUpdate || !acceptChecked || !signChecked || Boolean(busyId)}
                  onClick={approveSuperadmin}
                >
                  {busyId ? "…" : "Onayla"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {detail && isYetkili ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeDetail()}>
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 480, width: "min(480px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden>
                <i className="fa-solid fa-certificate" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Yetkili kabulü</h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Fiyatsız Excel’i indirip kabul edin · {formatIstanbul(detail.submittedAt)}
                </p>
              </div>
            </header>
            <div className="admin-modal__body">
              <ul className="edu-app-docs">
                <li>
                  <span>Fiyatsız Excel</span>
                  {detail.unpaidExcelPath ? (
                    <a className="btn btn-outline btn--sm" href={resolveUploadUrl(detail.unpaidExcelPath)} target="_blank" rel="noopener noreferrer">
                      İndir
                    </a>
                  ) : (
                    <em>Yok</em>
                  )}
                </li>
              </ul>
              <AcceptSignChecks
                acceptChecked={acceptChecked}
                signChecked={signChecked}
                onAcceptChange={setAcceptChecked}
                onSignChange={setSignChecked}
                disabled={Boolean(busyId)}
              />
            </div>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button type="button" className="btn btn-outline btn--modal-secondary" disabled={Boolean(busyId)} onClick={closeDetail}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--success-fill"
                  disabled={!canUpdate || !acceptChecked || !signChecked || Boolean(busyId)}
                  onClick={acceptYetkili}
                >
                  {busyId ? "…" : "Kabul et"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
