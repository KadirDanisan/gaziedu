import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api";

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

export default function ExamPortalAccessPage() {
  const [visitPage, setVisitPage] = useState(1);
  const [limitPage, setLimitPage] = useState(1);
  const [visitInput, setVisitInput] = useState("");
  const [visitFilter, setVisitFilter] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [limitFilter, setLimitFilter] = useState("");
  const [visits, setVisits] = useState([]);
  const [limits, setLimits] = useState([]);
  const [visitTotalPages, setVisitTotalPages] = useState(1);
  const [limitTotalPages, setLimitTotalPages] = useState(1);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busyLimitKey, setBusyLimitKey] = useState("");

  const loadVisits = useCallback(async () => {
    setLoadingVisits(true);
    setError("");
    try {
      const res = await adminApi.getExamPortalVisits(visitPage, visitFilter);
      setVisits(res.data || []);
      setVisitTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoadingVisits(false);
    }
  }, [visitPage, visitFilter]);

  const loadLimits = useCallback(async () => {
    setLoadingLimits(true);
    setError("");
    try {
      const res = await adminApi.getExamPortalLimitExceeded(limitPage, limitFilter);
      setLimits(res.data || []);
      setLimitTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoadingLimits(false);
    }
  }, [limitPage, limitFilter]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    loadLimits();
  }, [loadLimits]);

  const handleDeleteVisit = async (id) => {
    if (!window.confirm("Bu portal giriş kaydını silmek istediğinize emin misiniz?")) return;
    setBusyId(id);
    try {
      await adminApi.deleteExamPortalVisit(id);
      await loadVisits();
    } catch (e) {
      setError(e.message || "Silinemedi.");
    } finally {
      setBusyId("");
    }
  };

  const handleResetLimit = async (row) => {
    if (
      !window.confirm(
        `${row.educationCode} / ${row.nationalId} için tüm sınav oturumları (${row.startCount} kayıt) silinecek. Devam?`,
      )
    ) {
      return;
    }
    const key = `${row.educationCode}-${row.nationalId}`;
    setBusyLimitKey(key);
    try {
      await adminApi.deleteExamPortalLimitExceeded({ educationCode: row.educationCode, nationalId: row.nationalId });
      await loadLimits();
      await loadVisits();
    } catch (e) {
      setError(e.message || "Silinemedi.");
    } finally {
      setBusyLimitKey("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Sınav portalı erişimi</h2>
          <p>Portal giriş kayıtları ve aynı T.C. + eğitim kodunda 5 oturum limitine takılanlar bu sayfada listelenir. Sınav sonuçları için menüden Sınav Sonuçları sayfasını kullanın.</p>
        </div>
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      <article className="admin-panel-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, flex: "1 1 200px" }}>Sınav portalına giriş yapmış hesaplar</h3>
          <input
            type="search"
            className="admin-input"
            placeholder="URL, eğitim kodu veya T.C. ara..."
            value={visitInput}
            onChange={(e) => setVisitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setVisitFilter(visitInput.trim());
                setVisitPage(1);
              }
            }}
            style={{ minWidth: 220 }}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setVisitFilter(visitInput.trim());
              setVisitPage(1);
            }}
          >
            Ara
          </button>
        </div>
        {loadingVisits ? <p>Yükleniyor...</p> : null}
        {!loadingVisits && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Portal URL</th>
                  <th>Eğitim kodu</th>
                  <th>T.C.</th>
                  <th>Tarih</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Kayıt yok.</td>
                  </tr>
                ) : (
                  visits.map((row) => (
                    <tr key={row.id}>
                      <td style={{ maxWidth: 360, wordBreak: "break-all" }}>{row.portalUrl || "-"}</td>
                      <td>{row.educationCode || "-"}</td>
                      <td>{row.nationalId || "-"}</td>
                      <td>{formatIstanbul(row.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busyId === row.id}
                          onClick={() => handleDeleteVisit(row.id)}
                        >
                          {busyId === row.id ? "…" : "Sil"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {visitTotalPages > 1 ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-outline" disabled={visitPage <= 1} onClick={() => setVisitPage((p) => p - 1)}>
              Önceki
            </button>
            <span>
              Sayfa {visitPage} / {visitTotalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline"
              disabled={visitPage >= visitTotalPages}
              onClick={() => setVisitPage((p) => p + 1)}
            >
              Sonraki
            </button>
          </div>
        ) : null}
      </article>

      <article className="admin-panel-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, flex: "1 1 200px" }}>Sınav hakkı dolmuş (5 oturum)</h3>
          <input
            type="search"
            className="admin-input"
            placeholder="Eğitim kodu veya T.C. ara..."
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setLimitFilter(limitInput.trim());
                setLimitPage(1);
              }
            }}
            style={{ minWidth: 220 }}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setLimitFilter(limitInput.trim());
              setLimitPage(1);
            }}
          >
            Ara
          </button>
        </div>
        {loadingLimits ? <p>Yükleniyor...</p> : null}
        {!loadingLimits && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Eğitim kodu</th>
                  <th>T.C.</th>
                  <th>Oturum sayısı</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {limits.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Kayıt yok.</td>
                  </tr>
                ) : (
                  limits.map((row) => {
                    const key = `${row.educationCode}-${row.nationalId}`;
                    return (
                      <tr key={key}>
                        <td>{row.educationCode}</td>
                        <td>{row.nationalId}</td>
                        <td>{row.startCount}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={busyLimitKey === key}
                            onClick={() => handleResetLimit(row)}
                          >
                            {busyLimitKey === key ? "…" : "Oturumları sil (hak iadesi)"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {limitTotalPages > 1 ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-outline" disabled={limitPage <= 1} onClick={() => setLimitPage((p) => p - 1)}>
              Önceki
            </button>
            <span>
              Sayfa {limitPage} / {limitTotalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline"
              disabled={limitPage >= limitTotalPages}
              onClick={() => setLimitPage((p) => p + 1)}
            >
              Sonraki
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}
