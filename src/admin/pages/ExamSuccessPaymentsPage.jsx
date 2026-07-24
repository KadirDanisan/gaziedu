import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import AdminDateRangeFilter from "../components/AdminDateRangeFilter";
import { useAdminAuth } from "../context/AdminAuthContext";
import { DEFAULT_DATE_RANGE_PERIOD } from "../utils/dateRangePeriod";

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

export default function ExamSuccessPaymentsPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("examSuccessPayments", "canUpdate");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(DEFAULT_DATE_RANGE_PERIOD);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      const res = await adminApi.getExamSuccessPayments({ page, search, period });
      setRows(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, search, period]);

  useEffect(() => {
    load();
  }, [load]);

  const submitPaymentReceived = async () => {
    const id = paymentConfirmId;
    if (!id) return;
    setBusyPaymentId(id);
    try {
      await adminApi.markExamSuccessPaymentReceived(id);
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
          <h2>Sınav Başarılı Ödemeler</h2>
          <p>
            Sınavdan en az 60 puan alan katılımcılar. Ödeme alındıktan sonra kayıt{" "}
            <strong>Sertifika Çıkartma</strong> listesine düşer. Yetkiler <strong>Rol ve Yetki</strong> içindeki{" "}
            <strong>Sınav Başarılı Ödemeler</strong> modülünden verilir.
          </p>
        </div>
      </div>

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
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Eğitim kodu, T.C. veya ad ara..."
          />
          <button type="button" className="btn btn-outline" onClick={runSearch}>
            Ara
          </button>
        </div>
      </div>

      {loading ? <p>Yükleniyor...</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty-state">
          <i className="fa-solid fa-wallet" />
          <h3>Kayıt bulunamadı</h3>
          <p>Seçili tarih aralığında veya aramada ≥60 puanlı kayıt yok.</p>
        </div>
      ) : !loading ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Eğitim kodu</th>
                  <th>Eğitim adı</th>
                  <th>T.C.</th>
                  <th>En yüksek puan</th>
                  <th>En yüksek puan tarihi</th>
                  <th>Son sınav puanı</th>
                  <th>Son sınav zamanı</th>
                  <th>Ödeme alındı mı</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const paid = Boolean(row.paymentReceived);
                  return (
                    <tr key={row.id}>
                      <td>{row.participantName || "—"}</td>
                      <td>{row.educationCode}</td>
                      <td>{row.educationName || "—"}</td>
                      <td>{row.nationalId}</td>
                      <td>
                        <strong>{row.bestScore != null ? Number(row.bestScore) : "-"}</strong>
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
            aria-labelledby="exam-success-payment-confirm-title"
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
                <h3 id="exam-success-payment-confirm-title" className="admin-modal__title">
                  Ödeme onayı
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Ödemenin alındığından emin misiniz? Onayladığınızda kayıt &quot;Evet&quot; olarak işaretlenecek ve sertifika listesine düşecektir.
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
