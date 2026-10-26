import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { formatPersonName } from "../utils/turkishText";

const STATUS_VIEW = {
  pending: { label: "Bekliyor", tone: "wait" },
  verified: { label: "Doğrulandı", tone: "ok" },
  rejected: { label: "Reddedildi", tone: "wait" },
};

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

export default function InstructorVerificationsPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("instructorVerifications", "canUpdate");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getInstructorVerifications({ page, status, search });
      setRows(res.data || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
      setPendingCount(res.pendingCount || 0);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const runSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const submitConfirm = async () => {
    if (!confirm?.row?.id) return;
    const { row, action } = confirm;
    setBusyId(row.id);
    setError("");
    try {
      if (action === "verify") {
        await adminApi.verifyInstructorVerification(row.id);
      } else {
        await adminApi.rejectInstructorVerification(row.id);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e.message || "İşlem yapılamadı.");
      setConfirm(null);
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Eğitmen Doğrulama</h2>
          <p>
            Türk Eğitim Sen İşbirliği eğitimleri için gelen e-posta doğrulama talepleri. Doğrulanan kullanıcılar bu
            eğitimlerin modül içeriklerine ve sınavına erişebilir.
            {pendingCount > 0 ? (
              <>
                {" "}
                <strong>{pendingCount}</strong> talep onay bekliyor.
              </>
            ) : null}
          </p>
        </div>
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      <div className="admin-table-tools">
        <select
          value={status}
          disabled={loading}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Durum filtresi"
        >
          <option value="pending">Bekleyenler</option>
          <option value="verified">Doğrulananlar</option>
          <option value="rejected">Reddedilenler</option>
          <option value="">Tümü</option>
        </select>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Ad, e-posta veya T.C. ara..."
        />
        <button type="button" className="btn btn-outline" disabled={loading} onClick={runSearch}>
          Ara
        </button>
      </div>

      <article className="admin-panel-card">
        {loading ? <p>Yükleniyor...</p> : null}
        {!loading && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Talep Tarihi</th>
                  <th>Ad Soyad</th>
                  <th>Doğrulanacak E-posta</th>
                  <th>Hesap E-postası</th>
                  <th>T.C.</th>
                  <th>Talep Edilen Eğitim</th>
                  <th>Durum</th>
                  {canUpdate ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canUpdate ? 8 : 7}>Kayıt yok.</td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const view = STATUS_VIEW[row.status] || STATUS_VIEW.pending;
                    return (
                      <tr key={row.id}>
                        <td>{formatIstanbul(row.updatedAt || row.createdAt)}</td>
                        <td>{formatPersonName(`${row.firstName} ${row.lastName}`)}</td>
                        <td>
                          <strong>{row.verificationEmail || "—"}</strong>
                        </td>
                        <td>{row.accountEmail || "—"}</td>
                        <td>{row.nationalId || "—"}</td>
                        <td>
                          <div>{row.educationName || "—"}</div>
                          {row.educationCode ? <small style={{ opacity: 0.75 }}>{row.educationCode}</small> : null}
                        </td>
                        <td>
                          <span className={`edu-app-status edu-app-status--${view.tone}`}>{view.label}</span>
                          {row.status === "verified" && row.verifiedAt ? (
                            <div>
                              <small style={{ opacity: 0.75 }}>{formatIstanbul(row.verifiedAt)}</small>
                            </div>
                          ) : null}
                        </td>
                        {canUpdate ? (
                          <td style={{ whiteSpace: "nowrap" }}>
                            {row.status !== "verified" ? (
                              <button
                                type="button"
                                className="btn btn--sm"
                                disabled={Boolean(busyId)}
                                onClick={() => setConfirm({ row, action: "verify" })}
                              >
                                Doğrula
                              </button>
                            ) : null}{" "}
                            {row.status !== "rejected" ? (
                              <button
                                type="button"
                                className="btn btn-outline btn--sm"
                                disabled={Boolean(busyId)}
                                onClick={() => setConfirm({ row, action: "reject" })}
                              >
                                {row.status === "verified" ? "Doğrulamayı Kaldır" : "Reddet"}
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
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

      {confirm ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setConfirm(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 440, width: "min(440px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="instructor-verify-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <i
                  className={`fa-solid ${confirm.action === "verify" ? "fa-user-check" : "fa-user-xmark"}`}
                  style={{ fontSize: "1.4rem", color: confirm.action === "verify" ? "#16a34a" : "#dc2626" }}
                />
              </div>
              <div className="admin-modal__header-text">
                <h3 id="instructor-verify-confirm-title" className="admin-modal__title">
                  {confirm.action === "verify" ? "Eğitmeni doğrula" : "Doğrulamayı reddet"}
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  <strong>{formatPersonName(`${confirm.row.firstName} ${confirm.row.lastName}`)}</strong>
                  <br />
                  {confirm.row.verificationEmail}
                </p>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense" style={{ marginTop: 8 }}>
                  {confirm.action === "verify"
                    ? "Doğrulanan kullanıcı Türk Eğitim Sen İşbirliği eğitimlerinin içeriklerine ve sınavına erişebilecek."
                    : "Kullanıcı bu eğitimlerin içeriklerine erişemeyecek; isterse tekrar doğrulama talebi gönderebilir."}
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setConfirm(null)}
                  disabled={Boolean(busyId)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={confirm.action === "verify" ? "btn btn--success-fill" : "btn btn--modal-primary"}
                  onClick={submitConfirm}
                  disabled={Boolean(busyId)}
                >
                  {busyId ? "…" : confirm.action === "verify" ? "Evet, doğrula" : "Evet, reddet"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
