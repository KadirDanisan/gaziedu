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

export default function ExamResultsPage() {
  const { hasPermission } = useAdminAuth();
  const canDelete = hasPermission("examResults", "canDelete");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [certificateOnly, setCertificateOnly] = useState(false);

  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

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
                  {canDelete ? <th>Aksiyon</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
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
                    {canDelete ? (
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => handleDelete(row.id)}
                          >
                            {busyId === row.id ? "…" : "Sil"}
                          </button>
                        </div>
                      </td>
                    ) : null}
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
    </section>
  );
}
