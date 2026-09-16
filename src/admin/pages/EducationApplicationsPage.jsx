import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import AdminDateRangeFilter from "../components/AdminDateRangeFilter";
import { useAdminAuth } from "../context/AdminAuthContext";
import { PAGE_SIZE } from "../modules";
import { DEFAULT_DATE_RANGE_PERIOD } from "../utils/dateRangePeriod";
import { formatPersonName } from "../utils/turkishText";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const formatIstanbul = (value) => {
  if (!value) return "-";
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

const formatMoneyTry = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
};

const formatPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10) return value || "—";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
};

const resolveUploadUrl = (path) => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/uploads/")) return `${API_ORIGIN}${raw}`;
  return raw;
};

const statusLabel = (status) => {
  if (status === "approved") return "Onaylandı";
  return "Beklemede";
};

export default function EducationApplicationsPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("educationApplications", "canUpdate");

  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState(DEFAULT_DATE_RANGE_PERIOD);
  const [educationId, setEducationId] = useState("");
  const [nationalIdInput, setNationalIdInput] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [status, setStatus] = useState("");
  const [educations, setEducations] = useState([]);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [detail, setDetail] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null);

  const loadEducations = useCallback(async () => {
    try {
      const res = await adminApi.getEducationApplicationEducations();
      setEducations(res.data || []);
    } catch {
      setEducations([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getEducationApplications({
        page,
        pageSize: PAGE_SIZE,
        period,
        educationId,
        nationalId,
        status,
      });
      setRows(res.data || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, period, educationId, nationalId, status]);

  useEffect(() => {
    loadEducations();
  }, [loadEducations]);

  useEffect(() => {
    load();
  }, [load]);

  const runNationalSearch = () => {
    setNationalId(nationalIdInput.replace(/\D/g, ""));
    setPage(1);
  };

  const submitApprove = async () => {
    const id = approveConfirm?.id;
    if (!id) return;
    setBusyId(id);
    setError("");
    try {
      await adminApi.approveEducationApplication(id);
      setApproveConfirm(null);
      await load();
      setDetail((prev) => (prev?.id === id ? { ...prev, status: "approved" } : prev));
    } catch (e) {
      setError(e.message || "Onaylanamadı.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Eğitim Başvuru Formu</h2>
          <p>Ücretli eğitim başvuruları, belgeler ve ödeme bilgileri.</p>
        </div>
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      <div className="admin-table-tools admin-table-tools--stacked">
        <AdminDateRangeFilter
          value={period}
          disabled={loading}
          onChange={(next) => {
            setPeriod(next);
            setPage(1);
          }}
        />
        <div className="admin-table-tools__row">
          <select
            value={educationId}
            disabled={loading}
            onChange={(e) => {
              setEducationId(e.target.value);
              setPage(1);
            }}
            aria-label="Eğitim filtresi"
          >
            <option value="">Tüm eğitimler</option>
            {educations.map((edu) => (
              <option key={edu.id} value={edu.id}>
                {edu.code ? `${edu.code} — ` : ""}
                {edu.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            disabled={loading}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Durum filtresi"
          >
            <option value="">Tüm durumlar</option>
            <option value="pending">Beklemede</option>
            <option value="approved">Onaylandı</option>
          </select>
          <input
            type="search"
            placeholder="T.C. kimlik no"
            value={nationalIdInput}
            disabled={loading}
            onChange={(e) => setNationalIdInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => {
              if (e.key === "Enter") runNationalSearch();
            }}
            inputMode="numeric"
            maxLength={11}
            aria-label="T.C. kimlik no filtresi"
          />
          <button type="button" className="btn btn-outline" disabled={loading} onClick={runNationalSearch}>
            Ara
          </button>
        </div>
      </div>

      <article className="admin-panel-card">
        {loading ? <p>Yükleniyor...</p> : null}
        {!loading && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Eğitim</th>
                  <th>Ad Soyad</th>
                  <th>T.C.</th>
                  <th>Telefon</th>
                  <th>Ödenen</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Kayıt yok.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatIstanbul(row.createdAt)}</td>
                      <td>
                        <div>{row.educationName || "—"}</div>
                        {row.educationCode ? <small style={{ opacity: 0.75 }}>{row.educationCode}</small> : null}
                      </td>
                      <td>{formatPersonName(`${row.firstName || ""} ${row.lastName || ""}`)}</td>
                      <td>{row.nationalId || "—"}</td>
                      <td>{formatPhone(row.phone)}</td>
                      <td>{formatMoneyTry(row.payableAmount)}</td>
                      <td>
                        <span className={`edu-app-status edu-app-status--${row.status === "approved" ? "ok" : "wait"}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="btn btn-outline btn--sm" onClick={() => setDetail(row)}>
                          Detay
                        </button>{" "}
                        {canUpdate && row.status !== "approved" ? (
                          <button
                            type="button"
                            className="btn btn--sm"
                            disabled={Boolean(busyId)}
                            onClick={() => setApproveConfirm(row)}
                          >
                            Başvuruyu onayla
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading ? (
          <div className="admin-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
              Önceki
            </button>
            <span>
              Sayfa {page} / {totalPages}
              {total > 0 ? ` · ${total} kayıt` : ""}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
              Sonraki
            </button>
          </div>
        ) : null}
      </article>

      {detail ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setDetail(null);
          }}
        >
          <div className="admin-modal admin-modal--detail" role="dialog" aria-modal="true" style={{ maxWidth: 720, width: "min(720px, 94vw)" }}>
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Başvuru detayı</h3>
                <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                  {detail.educationName}
                  {detail.educationCode ? ` · ${detail.educationCode}` : ""}
                </p>
              </div>
            </header>
            <div className="admin-modal__body">
              <div className="edu-app-detail-grid">
                <div>
                  <span>Ad Soyad</span>
                  <strong>{formatPersonName(`${detail.firstName || ""} ${detail.lastName || ""}`)}</strong>
                </div>
                <div>
                  <span>E-posta</span>
                  <strong>{detail.email || "—"}</strong>
                </div>
                <div>
                  <span>T.C.</span>
                  <strong>{detail.nationalId || "—"}</strong>
                </div>
                <div>
                  <span>Telefon</span>
                  <strong>{formatPhone(detail.phone)}</strong>
                </div>
                <div>
                  <span>Doğum tarihi</span>
                  <strong>{detail.birthDate ? String(detail.birthDate).slice(0, 10) : "—"}</strong>
                </div>
                <div>
                  <span>Durum</span>
                  <strong>{statusLabel(detail.status)}</strong>
                </div>
                <div>
                  <span>Ödenen tutar</span>
                  <strong>
                    {formatMoneyTry(detail.payableAmount ?? detail.price)}
                    {detail.hasDiscount && detail.discountRate ? ` · %${detail.discountRate} indirim` : ""}
                  </strong>
                </div>
                <div>
                  <span>Ödeme türü</span>
                  <strong>Tek Çekim</strong>
                </div>
                <div>
                  <span>Başvuru tarihi</span>
                  <strong>{formatIstanbul(detail.createdAt)}</strong>
                </div>
              </div>

              <h4 style={{ margin: "18px 0 10px" }}>Belgeler</h4>
              <ul className="edu-app-docs">
                {[
                  { label: "Mezuniyet Belgesi", path: detail.graduationDocPath },
                  { label: "KVKK Aydınlatma Onay Formu", path: detail.kvkkDocPath },
                  { label: "Kurum / Anabilim Dalı Belgesi", path: detail.institutionDocPath },
                ].map((doc) => {
                  const href = resolveUploadUrl(doc.path);
                  return (
                    <li key={doc.label}>
                      <span>{doc.label}</span>
                      {href ? (
                        <a href={href} className="btn btn-outline btn--sm" target="_blank" rel="noopener noreferrer">
                          Görüntüle / indir
                        </a>
                      ) : (
                        <em>Yok</em>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setDetail(null)} disabled={Boolean(busyId)}>
                  Kapat
                </button>
                {canUpdate && detail.status !== "approved" ? (
                  <button type="button" className="btn" disabled={Boolean(busyId)} onClick={() => setApproveConfirm(detail)}>
                    Başvuruyu onayla
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {approveConfirm ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setApproveConfirm(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 420, width: "min(420px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="edu-app-approve-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <i className="fa-solid fa-circle-check" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 id="edu-app-approve-title" className="admin-modal__title">
                  Başvuru onayı
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Bu başvuruyu onaylamak istediğinize emin misiniz?
                </p>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense" style={{ marginTop: 8 }}>
                  <strong>
                    {formatPersonName(`${approveConfirm.firstName || ""} ${approveConfirm.lastName || ""}`)}
                  </strong>{" "}
                  · T.C. {approveConfirm.nationalId || "—"}
                  <br />
                  {approveConfirm.educationCode ? `${approveConfirm.educationCode} — ` : ""}
                  {approveConfirm.educationName || "Eğitim"}
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setApproveConfirm(null)}
                  disabled={Boolean(busyId)}
                >
                  Hayır
                </button>
                <button type="button" className="btn btn--success-fill" onClick={submitApprove} disabled={Boolean(busyId)}>
                  {busyId ? "…" : "Evet"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
