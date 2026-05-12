import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import { useAdminAuth } from "../context/AdminAuthContext";

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
    second: "2-digit",
  }).format(date);
};

function PaymentReceivedPill({ paid, interactive, busy, onRequestConfirm }) {
  const track = (
    <span className={`exam-results-payment-pill__track ${paid ? "exam-results-payment-pill__track--evet" : "exam-results-payment-pill__track--hayir"}`}>
      <span className="exam-results-payment-pill__halo" aria-hidden="true">
        <span>Hayır</span>
        <span>Evet</span>
      </span>
      <span
        className={`exam-results-payment-pill__thumb ${paid ? "exam-results-payment-pill__thumb--yes" : "exam-results-payment-pill__thumb--no"}`}
      >
        {paid ? "Evet" : "Hayır"}
      </span>
    </span>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className="exam-results-payment-pill"
        disabled={busy}
        onClick={onRequestConfirm}
        aria-label="Ödeme alındı bilgisini güncelle"
        aria-busy={busy}
      >
        {track}
      </button>
    );
  }

  return (
    <span
      className="exam-results-payment-pill exam-results-payment-pill--static"
      role="status"
      aria-label={paid ? "Ödeme alındı: Evet" : "Ödeme alındı: Hayır"}
    >
      {track}
    </span>
  );
}

export default function ExamResultsPage() {
  const { hasPermission } = useAdminAuth();
  const canDelete = hasPermission("examResults", "canDelete");
  const canUpdate = hasPermission("examResults", "canUpdate");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [certificateOnly, setCertificateOnly] = useState(false);

  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busyPaymentId, setBusyPaymentId] = useState("");
  const [paymentConfirmId, setPaymentConfirmId] = useState(null);

  const runSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getExamResults({
        page,
        search,
        certificateOnly,
      });
      setRows(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, search, certificateOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Bu sınav sonuç özet kaydını silmek istediğinize emin misiniz?")) return;
    setBusyId(id);
    try {
      await adminApi.deleteExamResult(id);
      await load();
    } catch (e) {
      setError(e.message || "Silinemedi.");
    } finally {
      setBusyId("");
    }
  };

  const submitPaymentReceived = async () => {
    const id = paymentConfirmId;
    if (!id) return;
    setBusyPaymentId(id);
    try {
      await adminApi.markExamResultPaymentReceived(id);
      setPaymentConfirmId(null);
      await load();
    } catch (e) {
      setError(e.message || "Güncellenemedi.");
    } finally {
      setBusyPaymentId("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Sınav sonuçları</h2>
          <p>
            Eğitim kodu veya T.C. ile arayın. Kayıt başına en yüksek puan tutulur; 60 ve üzeri sertifika ile uyumludur. Yetkiler
            <strong> Rol ve Yetki</strong> içindeki <strong>Sınav Sonuçları</strong> modülünden verilir.
          </p>
        </div>
      </div>

      <div className="admin-table-tools">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Eğitim kodu veya T.C. ara..."
        />
        <button type="button" className="btn btn-outline" onClick={runSearch}>
          Ara
        </button>
        <select
          value={certificateOnly ? "cert" : "all"}
          onChange={(e) => {
            setCertificateOnly(e.target.value === "cert");
            setPage(1);
          }}
        >
          <option value="all">Tümü</option>
          <option value="cert">Sertifikaya hak kazananlar (≥60)</option>
        </select>
      </div>

      {loading ? <p>Yükleniyor...</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty-state">
          <i className="fa-regular fa-folder-open" />
          <h3>Kayıt bulunamadı</h3>
          <p>Arama metnini veya filtreyi değiştirip tekrar deneyin.</p>
        </div>
      ) : !loading ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Eğitim kodu</th>
                  <th>T.C.</th>
                  <th>En yüksek puan</th>
                  <th>Sertifika (≥60)</th>
                  <th>En yüksek puan tarihi</th>
                  <th>Son sınav puanı</th>
                  <th>Son sınav zamanı</th>
                  <th>Ödeme alındı mı</th>
                  {canDelete ? <th>Aksiyon</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const paid = Boolean(row.paymentReceived);
                  return (
                    <tr key={row.id}>
                      <td>{row.educationCode}</td>
                      <td>{row.nationalId}</td>
                      <td>
                        <strong>{row.bestScore != null ? Number(row.bestScore) : "-"}</strong>
                      </td>
                      <td>
                        {row.certificateEligible ? (
                          <span style={{ color: "#15803d", fontWeight: 600 }}>Evet</span>
                        ) : (
                          <span style={{ opacity: 0.75 }}>Hayır</span>
                        )}
                      </td>
                      <td>{formatIstanbul(row.bestRecordedAt)}</td>
                      <td>{row.lastScore != null ? Number(row.lastScore) : "-"}</td>
                      <td>{formatIstanbul(row.lastAttemptAt)}</td>
                      <td>
                        <PaymentReceivedPill
                          paid={paid}
                          interactive={canUpdate && !paid}
                          busy={busyPaymentId === row.id}
                          onRequestConfirm={() => setPaymentConfirmId(row.id)}
                        />
                      </td>
                      {canDelete ? (
                        <td>
                          <div className="admin-actions">
                            <button type="button" disabled={busyId === row.id} onClick={() => handleDelete(row.id)}>
                              {busyId === row.id ? "…" : "Sil"}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Önceki
              </button>
              <span>
                Sayfa {page} / {totalPages}
              </span>
              <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sonraki
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {paymentConfirmId ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyPaymentId) setPaymentConfirmId(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 420, width: "min(420px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exam-payment-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={28} height={28}>
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 14h2v2h-2v-2Zm0-8h2v6h-2V8Z"
                  />
                </svg>
              </div>
              <div className="admin-modal__header-text">
                <h3 id="exam-payment-confirm-title" className="admin-modal__title">
                  Ödeme onayı
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Ödemenin alındığından emin misiniz? Onayladığınızda kayıt &quot;Evet&quot; olarak işaretlenecek.
                </p>
              </div>
              <button
                type="button"
                className="admin-modal__close"
                onClick={() => !busyPaymentId && setPaymentConfirmId(null)}
                aria-label="Vazgeç"
                disabled={Boolean(busyPaymentId)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path
                    fill="currentColor"
                    d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z"
                  />
                </svg>
              </button>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setPaymentConfirmId(null)}
                  disabled={Boolean(busyPaymentId)}
                >
                  Hayır
                </button>
                <button
                  type="button"
                  className="btn btn--success-fill"
                  onClick={submitPaymentReceived}
                  disabled={Boolean(busyPaymentId)}
                >
                  {busyPaymentId ? "…" : "Evet"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
