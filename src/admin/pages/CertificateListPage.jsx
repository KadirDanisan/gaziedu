import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "../api";
import AdminDateRangeFilter from "../components/AdminDateRangeFilter";
import { DEFAULT_DATE_RANGE_PERIOD } from "../utils/dateRangePeriod";
import { downloadEdevletCertificateExcel } from "../utils/buildEdevletCertificateExcel";
import { downloadCertificateAcquisitionReportExcel, downloadEdevletIssuedCertificateExcel } from "../utils/buildCertificateAcquisitionReportExcel";

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

function EdevletProcessedPill({ processed, interactive, busy, onRequestConfirm }) {
  const track = (
    <span
      className={`exam-results-payment-pill__track ${
        processed ? "exam-results-payment-pill__track--evet" : "exam-results-payment-pill__track--hayir"
      }`}
    >
      <span className="exam-results-payment-pill__halo" aria-hidden="true">
        <span>Hayır</span>
        <span>Evet</span>
      </span>
      <span
        className={`exam-results-payment-pill__thumb ${
          processed ? "exam-results-payment-pill__thumb--yes" : "exam-results-payment-pill__thumb--no"
        }`}
      >
        {processed ? "Evet" : "Hayır"}
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
        aria-label="E-devlete işlendi bilgisini güncelle"
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
      aria-label={processed ? "E-devlete işlendi: Evet" : "E-devlete işlendi: Hayır"}
    >
      {track}
    </span>
  );
}

export default function CertificateListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(DEFAULT_DATE_RANGE_PERIOD);
  const [completion, setCompletion] = useState("all");
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmRow, setConfirmRow] = useState(null);
  const [generatingId, setGeneratingId] = useState("");
  const [exportingEdevlet, setExportingEdevlet] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [busyEdevletId, setBusyEdevletId] = useState("");
  const [edevletConfirmId, setEdevletConfirmId] = useState(null);
  const [excelExportConfirm, setExcelExportConfirm] = useState(null);
  const [bulkPdfProgress, setBulkPdfProgress] = useState(null);
  const [exportingAcquisitionReport, setExportingAcquisitionReport] = useState(false);
  const [exportingEdevletIssuedList, setExportingEdevletIssuedList] = useState(false);

  const runSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
    setSelectedIds(new Set());
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getCertificateList({ page, search, period, completion });
      setRows(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      setError(e.message || "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, search, period, completion]);

  useEffect(() => {
    load();
  }, [load]);

  const pageIds = useMemo(() => rows.map((row) => String(row.id)), [rows]);
  const selectedCount = selectedIds.size;
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const allFilteredSelected = total > 0 && selectedCount >= total;

  const toggleRow = (id) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = async () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectingAll(true);
    setError("");
    try {
      const res = await adminApi.getCertificateListEdevletExport({ search, period, completion });
      const exportRows = res.data || [];
      setSelectedIds(new Set(exportRows.map((row) => String(row.id))));
      if (!exportRows.length) {
        setError("Seçili filtrede kayıt bulunamadı.");
      }
    } catch (e) {
      setError(e.message || "Tüm kayıtlar seçilemedi.");
    } finally {
      setSelectingAll(false);
    }
  };

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

  const handleExportEdevletExcel = async () => {
    if (!selectedCount) {
      setError("Excel için en az bir kayıt seçin.");
      return;
    }
    setError("");
    try {
      const res = await adminApi.getCertificateListEdevletExport({ search, period, completion });
      const selectedRows = (res.data || []).filter((row) => selectedIds.has(String(row.id)));
      if (!selectedRows.length) {
        setError("Seçili kayıtlardan dışa aktarılacak veri bulunamadı. Filtreyi veya seçimi kontrol edin.");
        return;
      }
      const alreadyExported = selectedRows.filter((row) => row.edevletExcelExported);
      const pendingRows = selectedRows.filter((row) => !row.edevletExcelExported);
      if (!pendingRows.length) {
        setError("Seçili kayıtların tümü daha önce Excel raporuna alınmış. Yeni satır oluşturulmaz.");
        return;
      }
      setExcelExportConfirm({
        pendingIds: pendingRows.map((row) => String(row.id)),
        skippedCount: alreadyExported.length,
        pendingCount: pendingRows.length,
      });
    } catch (e) {
      setError(e.message || "E-devlet Excel dosyası oluşturulamadı.");
    }
  };

  const confirmExportEdevletExcel = async () => {
    if (!excelExportConfirm?.pendingIds?.length) {
      setExcelExportConfirm(null);
      return;
    }
    setExportingEdevlet(true);
    setError("");
    try {
      const prepared = await adminApi.prepareCertificateListEdevletExport(excelExportConfirm.pendingIds);
      const exportRows = prepared.rows || [];
      if (!exportRows.length) {
        setError("Dışa aktarılacak yeni kayıt kalmadı (daha önce Excel raporu oluşturulmuş olabilir).");
        setExcelExportConfirm(null);
        return;
      }
      const stamp = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      downloadEdevletCertificateExcel(exportRows, `edevlet-sertifika-${stamp}.xlsx`);
      setExcelExportConfirm(null);
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      setError(e.message || "E-devlet Excel dosyası oluşturulamadı.");
    } finally {
      setExportingEdevlet(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!confirmRow?.id) return;
    if (confirmRow.edevletProcessed) {
      setError("Bu sertifika E-devlete işlenmiş. Tekrar hazırlanamaz.");
      setConfirmRow(null);
      return;
    }
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

  const handleBulkDownloadCertificates = async () => {
    if (!selectedCount) {
      setError("Toplu sertifika için en az bir kayıt seçin.");
      return;
    }
    setError("");
    const ids = [...selectedIds];
    setBulkPdfProgress({ current: 0, total: ids.length, label: "Sunucuda PDF’ler hazırlanıyor…" });
    try {
      const { blob, fileName, successCount, failedCount, skippedCount, summary } =
        await adminApi.downloadCertificateBulkZip(ids);
      downloadBlob(blob, fileName || "24-07.zip");
      await load();

      const notes = [];
      if (skippedCount) notes.push(`${skippedCount} kayıt E-devlete işlendiği için atlandı`);
      if (failedCount) {
        const detail = (summary?.failures || [])
          .slice(0, 2)
          .map((item) => item.message)
          .filter(Boolean)
          .join(" · ");
        notes.push(detail ? `${failedCount} kayıtta hata: ${detail}` : `${failedCount} kayıtta hata oluştu`);
      }
      if (notes.length) {
        setError(`Toplu indirme tamamlandı (${successCount} PDF). ${notes.join("; ")}.`);
      }
    } catch (e) {
      setError(e.message || "Toplu sertifika indirilemedi.");
    } finally {
      setBulkPdfProgress(null);
    }
  };

  const handleExportAcquisitionReport = async () => {
    if (!selectedCount) {
      setError("Sertifika alım raporu için en az bir kayıt seçin.");
      return;
    }
    setExportingAcquisitionReport(true);
    setError("");
    try {
      const res = await adminApi.getCertificateListEdevletExport({ search, period, completion });
      const exportRows = (res.data || []).filter((row) => selectedIds.has(String(row.id)));
      if (!exportRows.length) {
        setError("Seçili kayıtlardan rapora aktarılacak veri bulunamadı.");
        return;
      }
      const stamp = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      downloadCertificateAcquisitionReportExcel(exportRows, `sertifika-alim-raporu-${stamp}.xlsx`);
    } catch (e) {
      setError(e.message || "Sertifika alım raporu oluşturulamadı.");
    } finally {
      setExportingAcquisitionReport(false);
    }
  };

  const handleExportEdevletIssuedList = async () => {
    if (!selectedCount) {
      setError("E-devlet sertifikası verilenler listesi için en az bir kayıt seçin.");
      return;
    }
    setExportingEdevletIssuedList(true);
    setError("");
    try {
      const res = await adminApi.getCertificateListEdevletExport({ search, period, completion });
      const exportRows = (res.data || []).filter(
        (row) => selectedIds.has(String(row.id)) && Boolean(row.edevletProcessed),
      );
      if (!exportRows.length) {
        setError("Seçili kayıtlar arasında E-devlete işlenmiş sertifika bulunamadı.");
        return;
      }
      const stamp = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      downloadEdevletIssuedCertificateExcel(exportRows, `edevlet-sertifikasi-verilenler-${stamp}.xlsx`);
    } catch (e) {
      setError(e.message || "E-devlet sertifikası verilenler listesi oluşturulamadı.");
    } finally {
      setExportingEdevletIssuedList(false);
    }
  };

  const submitEdevletProcessed = async () => {
    const id = edevletConfirmId;
    if (!id) return;
    setBusyEdevletId(id);
    setError("");
    try {
      await adminApi.markCertificateEdevletProcessed(id);
      setEdevletConfirmId(null);
      await load();
    } catch (e) {
      setError(e.message || "E-devlet durumu güncellenemedi.");
    } finally {
      setBusyEdevletId("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head certificate-page-head">
        <div className="certificate-page-head__intro">
          <h2>Sertifika Çıkartma Sistemi</h2>
          <p>
            Ödemesi alınmış ve sınavdan en az 60 puan almış katılımcılar. E-devlete işlenen kayıtlar için{" "}
            <strong>Sertifika Hazırla</strong> kilitlenir.
          </p>
        </div>
        <div className="certificate-action-panels">
          <div className="certificate-action-panel certificate-action-panel--edevlet">
            <div className="certificate-action-panel__head">
              <span className="certificate-action-panel__icon" aria-hidden>
                <i className="fa-solid fa-cloud-arrow-up" />
              </span>
              <div>
                <span className="certificate-action-panel__label">E-devlet yükleme</span>
                <p className="certificate-action-panel__hint">PDF hazırla ve işlem Excel’i çıkar</p>
              </div>
            </div>
            <div className="certificate-action-panel__buttons">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleBulkDownloadCertificates}
                disabled={
                  loading ||
                  exportingEdevlet ||
                  exportingAcquisitionReport ||
                  exportingEdevletIssuedList ||
                  selectingAll ||
                  Boolean(generatingId) ||
                  Boolean(bulkPdfProgress) ||
                  !selectedCount
                }
              >
                <i className="fa-solid fa-file-zipper" aria-hidden />
                <span>
                  {bulkPdfProgress
                    ? "Hazırlanıyor…"
                    : selectedCount
                      ? `Toplu sertifika (${selectedCount})`
                      : "Toplu sertifika indir"}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExportEdevletExcel}
                disabled={
                  loading ||
                  exportingEdevlet ||
                  exportingAcquisitionReport ||
                  exportingEdevletIssuedList ||
                  selectingAll ||
                  Boolean(generatingId) ||
                  Boolean(bulkPdfProgress) ||
                  !selectedCount
                }
              >
                <i className="fa-solid fa-file-excel" aria-hidden />
                <span>
                  {exportingEdevlet
                    ? "Hazırlanıyor…"
                    : selectedCount
                      ? `İşlem Excel (${selectedCount})`
                      : "E-devlet işlem Excel"}
                </span>
              </button>
            </div>
          </div>
          <div className="certificate-action-panel certificate-action-panel--reports">
            <div className="certificate-action-panel__head">
              <span className="certificate-action-panel__icon" aria-hidden>
                <i className="fa-solid fa-chart-simple" />
              </span>
              <div>
                <span className="certificate-action-panel__label">Raporlar</span>
                <p className="certificate-action-panel__hint">Alım ve verilenler listelerini indir</p>
              </div>
            </div>
            <div className="certificate-action-panel__buttons">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExportAcquisitionReport}
                disabled={
                  loading ||
                  exportingEdevlet ||
                  exportingAcquisitionReport ||
                  exportingEdevletIssuedList ||
                  selectingAll ||
                  Boolean(generatingId) ||
                  Boolean(bulkPdfProgress) ||
                  !selectedCount
                }
              >
                <i className="fa-solid fa-file-arrow-down" aria-hidden />
                <span>
                  {exportingAcquisitionReport
                    ? "Hazırlanıyor…"
                    : selectedCount
                      ? `Alım raporu (${selectedCount})`
                      : "Sertifika alım raporu"}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExportEdevletIssuedList}
                disabled={
                  loading ||
                  exportingEdevlet ||
                  exportingAcquisitionReport ||
                  exportingEdevletIssuedList ||
                  selectingAll ||
                  Boolean(generatingId) ||
                  Boolean(bulkPdfProgress) ||
                  !selectedCount
                }
              >
                <i className="fa-solid fa-list-check" aria-hidden />
                <span>
                  {exportingEdevletIssuedList
                    ? "Hazırlanıyor…"
                    : selectedCount
                      ? `Verilenler (${selectedCount})`
                      : "E-devlet verilenler"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-table-tools admin-table-tools--stacked">
        <AdminDateRangeFilter
          value={period}
          disabled={loading}
          onChange={(next) => {
            setPeriod(next);
            setPage(1);
            setSelectedIds(new Set());
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
          <select
            value={completion}
            disabled={loading}
            onChange={(e) => {
              setCompletion(e.target.value);
              setPage(1);
              setSelectedIds(new Set());
            }}
            aria-label="Sertifika tamamlanma filtresi"
          >
            <option value="all">Tümü</option>
            <option value="completed">Tamamlanan sertifikalar</option>
            <option value="incomplete">Tamamlanmamış sertifikalar</option>
          </select>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleSelectAllFiltered}
            disabled={loading || selectingAll || Boolean(generatingId) || total === 0}
          >
            {selectingAll ? "Seçiliyor…" : allFilteredSelected ? "Seçimi kaldır" : "Tümünü seç"}
          </button>
          {selectedCount ? (
            <span style={{ fontSize: 13, color: "#475569" }}>
              {selectedCount} kayıt seçili
              {total ? ` / ${total}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? <p>Yükleniyor...</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty-state">
          <i className="fa-solid fa-certificate" />
          <h3>Kayıt bulunamadı</h3>
          <p>Seçili tarih aralığında, arama veya tamamlanma filtresinde kayıt yok.</p>
        </div>
      ) : !loading ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allPageSelected && somePageSelected;
                      }}
                      onChange={togglePage}
                      aria-label="Bu sayfadakileri seç"
                      title="Bu sayfadakileri seç"
                    />
                  </th>
                  <th>Ad Soyad</th>
                  <th>T.C.</th>
                  <th>Eğitim kodu</th>
                  <th>Eğitim adı</th>
                  <th>En yüksek puan</th>
                  <th>En yüksek puan tarihi</th>
                  <th>Sertifika no</th>
                  <th>Ödeme</th>
                  <th>E-devlete işlendi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = String(row.id);
                  const checked = selectedIds.has(id);
                  const processed = Boolean(row.edevletProcessed);
                  return (
                    <tr key={id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(id)}
                          aria-label={`${row.participantName || row.nationalId} seç`}
                        />
                      </td>
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
                        <EdevletProcessedPill
                          processed={processed}
                          interactive={!processed}
                          busy={busyEdevletId === row.id}
                          onRequestConfirm={() => setEdevletConfirmId(row.id)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={Boolean(generatingId) || processed}
                          title={processed ? "E-devlete işlenmiş; tekrar hazırlanamaz" : "Sertifika PDF hazırla"}
                          onClick={() => setConfirmRow(row)}
                        >
                          {processed ? "Tamamlandı" : "Sertifika Hazırla"}
                        </button>
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
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
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

      {edevletConfirmId ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyEdevletId) setEdevletConfirmId(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 420, width: "min(420px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="certificate-edevlet-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <i className="fa-solid fa-building-columns" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 id="certificate-edevlet-confirm-title" className="admin-modal__title">
                  E-devlet onayı
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Sertifika E-devlete işlendi olarak işaretlensin mi? Onayladığınızda kayıt tamamlanır ve sertifika
                  tekrar hazırlanamaz.
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setEdevletConfirmId(null)}
                  disabled={Boolean(busyEdevletId)}
                >
                  Hayır
                </button>
                <button
                  type="button"
                  className="btn btn--success-fill"
                  onClick={submitEdevletProcessed}
                  disabled={Boolean(busyEdevletId)}
                >
                  {busyEdevletId ? "…" : "Evet"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {excelExportConfirm ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !exportingEdevlet) setExcelExportConfirm(null);
          }}
        >
          <div
            className="admin-modal admin-modal--confirm"
            style={{ maxWidth: 480, width: "min(480px, 94vw)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="certificate-excel-export-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <i className="fa-solid fa-file-excel" style={{ fontSize: "1.5rem", color: "#0d47a1" }} />
              </div>
              <div className="admin-modal__header-text">
                <h3 id="certificate-excel-export-title" className="admin-modal__title">
                  E-devlet Excel çıkart
                </h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  {excelExportConfirm.skippedCount > 0 ? (
                    <>
                      Daha önce Excel raporu oluşturduğunuz <strong>{excelExportConfirm.skippedCount}</strong> kayıt
                      listenizden çıkartılacak; yeni ID verilmeyecek.
                      <br />
                      <br />
                    </>
                  ) : null}
                  Excel&apos;e <strong>{excelExportConfirm.pendingCount}</strong> yeni kayıt eklenecek. Devam etmek
                  istiyor musunuz?
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button
                  type="button"
                  className="btn btn-outline btn--modal-secondary"
                  onClick={() => setExcelExportConfirm(null)}
                  disabled={exportingEdevlet}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--modal-primary"
                  onClick={confirmExportEdevletExcel}
                  disabled={exportingEdevlet}
                >
                  {exportingEdevlet ? "Excel hazırlanıyor…" : "Evet, Excel çıkart"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
