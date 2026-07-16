import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";
import AdminDateRangeFilter from "../components/AdminDateRangeFilter";
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

export default function CertificateListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(DEFAULT_DATE_RANGE_PERIOD);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmRow, setConfirmRow] = useState(null);
  const [generatingId, setGeneratingId] = useState("");

  const runSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getCertificateList({ page, search, period });
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

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleGenerateCertificate = async () => {
    if (!confirmRow?.id) return;
    setGeneratingId(confirmRow.id);
    setError("");
    try {
      const { blob, fileName } = await adminApi.generateCertificatePdf(confirmRow.id);
      downloadBlob(blob, fileName);
      setConfirmRow(null);
      await load();
    } catch (e) {
      setError(e.message || "Sertifika oluşturulamadı.");
    } finally {
      setGeneratingId("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Sertifika Çıkartma Sistemi</h2>
          <p>
            Ödemesi alınmış ve sınavdan en az 60 puan almış katılımcılar. Her satır için{" "}
            <strong>Sertifika Hazırla</strong> ile GUZEM başarı sertifikası PDF olarak oluşturulur (ad, T.C.,
            eğitim bilgileri, belge numarası ve tamamlama metni).
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
          <i className="fa-solid fa-certificate" />
          <h3>Kayıt bulunamadı</h3>
          <p>Seçili tarih aralığında veya arama kriterinde sertifikaya hak kazanan ödenmiş kayıt yok.</p>
        </div>
      ) : !loading ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>T.C.</th>
                  <th>Eğitim kodu</th>
                  <th>Eğitim adı</th>
                  <th>En yüksek puan</th>
                  <th>En yüksek puan tarihi</th>
                  <th>Sertifika no</th>
                  <th>Ödeme</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.participantName || "—"}</td>
                    <td>{row.nationalId}</td>
                    <td>{row.educationCode}</td>
                    <td>{row.educationName || "—"}</td>
                    <td>
                      <strong>{row.bestScore != null ? Number(row.bestScore) : "-"}</strong>
                    </td>
                    <td>{formatIstanbul(row.bestRecordedAt)}</td>
                    <td>{row.documentNumber || "—"}</td>
                    <td>
                      <span style={{ color: "#15803d", fontWeight: 600 }}>Evet</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={Boolean(generatingId)}
                        onClick={() => setConfirmRow(row)}
                      >
                        Sertifika Hazırla
                      </button>
                    </td>
                  </tr>
                ))}
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

      {confirmRow ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !generatingId) setConfirmRow(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 460, width: "min(460px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="certificate-generate-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <i className="fa-solid fa-certificate" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 id="certificate-generate-title" className="admin-modal__title">
                  Sertifika hazırla
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Sertifika PDF olarak oluşturulacaktır. Onaylıyor musunuz?
                </p>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense" style={{ marginTop: 8 }}>
                  <strong>{confirmRow.participantName || "—"}</strong> · T.C. {confirmRow.nationalId}
                  <br />
                  {confirmRow.educationCode} — {confirmRow.educationName || "Eğitim adı yok"}
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setConfirmRow(null)}
                  disabled={Boolean(generatingId)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--modal-primary"
                  onClick={handleGenerateCertificate}
                  disabled={Boolean(generatingId)}
                >
                  {generatingId ? "Oluşturuluyor…" : "Evet, oluştur"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
