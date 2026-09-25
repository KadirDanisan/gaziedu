import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../api";
import AdminDateRangeFilter from "../components/AdminDateRangeFilter";
import { useAdminAuth } from "../context/AdminAuthContext";
import { PAGE_SIZE } from "../modules";
import { DEFAULT_DATE_RANGE_PERIOD } from "../utils/dateRangePeriod";
import { formatPersonName } from "../utils/turkishText";
import { parseBulkApplicationsExcelBuffer } from "../utils/parseBulkUsersExcel";
import { downloadBlob } from "../utils/downloadBlob";

const BULK_CHUNK_SIZE = 100;
const BULK_PAYMENT_METHOD = "toplu";

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
  const [bulk, setBulk] = useState(null);
  const [bulkEducations, setBulkEducations] = useState([]);
  const bulkFileRef = useRef(null);

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

  const openBulk = async () => {
    setBulk({ step: "select", educationId: "", fileName: "", rows: [], error: "", processed: 0, results: [] });
    try {
      const res = await adminApi.getBulkApplicationEducations();
      setBulkEducations(res.data || []);
    } catch (e) {
      setBulk((prev) => (prev ? { ...prev, error: e.message || "Eğitim listesi yüklenemedi." } : prev));
    }
  };

  const closeBulk = () => {
    if (bulk?.step === "uploading") return;
    setBulk(null);
  };

  const downloadBulkTemplate = async () => {
    try {
      downloadBlob(await adminApi.downloadBulkApplicationsTemplate(), "TopluBasvuruFormu.xlsx");
    } catch (e) {
      setBulk((prev) => (prev ? { ...prev, error: e.message || "Şablon indirilemedi." } : prev));
    }
  };

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { rows: parsed, error: parseErr } = parseBulkApplicationsExcelBuffer(await file.arrayBuffer());
    if (parseErr || !parsed.length) {
      setBulk((prev) => ({
        ...prev,
        step: "select",
        fileName: file.name,
        rows: [],
        error: parseErr || "Excel'de başlık altında dolu satır bulunamadı.",
      }));
      return;
    }
    setBulk((prev) => ({ ...prev, step: "ready", fileName: file.name, rows: parsed, error: "", processed: 0, results: [] }));
  };

  const runBulkImport = async () => {
    if (!bulk?.educationId || !bulk.rows.length) return;
    const { educationId: targetEducationId, rows: allRows } = bulk;
    setBulk((prev) => ({ ...prev, step: "uploading", processed: 0, results: [], error: "" }));
    const collected = [];
    try {
      for (let i = 0; i < allRows.length; i += BULK_CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + BULK_CHUNK_SIZE);
        const res = await adminApi.bulkImportEducationApplications(targetEducationId, chunk);
        collected.push(...(res?.results || []));
        setBulk((prev) => ({ ...prev, processed: Math.min(allRows.length, i + chunk.length), results: [...collected] }));
      }
      setBulk((prev) => ({ ...prev, step: "done", results: collected }));
    } catch (e) {
      setBulk((prev) => ({ ...prev, step: "done", results: collected, error: e.message || "Toplu başvuru sırasında hata oluştu." }));
    }
    await Promise.all([load(), loadEducations()]);
  };

  const bulkCount = (status) => (bulk?.results || []).filter((r) => r.status === status).length;
  const bulkNotFound = (bulk?.results || []).filter((r) => r.status === "notFound");
  const bulkSkipped = (bulk?.results || []).filter((r) => r.status === "skipped");

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Eğitim Başvuru Formu</h2>
          <p>Ücretli eğitim başvuruları, belgeler ve ödeme bilgileri.</p>
        </div>
        {canUpdate ? (
          <button type="button" className="btn" onClick={openBulk}>
            Toplu Başvuru Al
          </button>
        ) : null}
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
                  <strong>{detail.paymentMethod === BULK_PAYMENT_METHOD ? "Toplu başvuru" : "Tek Çekim"}</strong>
                </div>
                <div>
                  <span>Başvuru tarihi</span>
                  <strong>{formatIstanbul(detail.createdAt)}</strong>
                </div>
              </div>

              <h4 style={{ margin: "18px 0 10px" }}>Belgeler</h4>
              {detail.paymentMethod === BULK_PAYMENT_METHOD ? (
                <p style={{ margin: 0, opacity: 0.8 }}>Toplu başvuru ile eklendi; belge istenmez.</p>
              ) : (
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
              )}
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

      {bulk ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeBulk()}>
          <div
            className="admin-modal admin-modal--form admin-modal-scrollable"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edu-app-bulk-title"
            style={{ maxWidth: 760, width: "min(760px, 94vw)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">Eğitim Başvuru Formu</p>
                <h3 id="edu-app-bulk-title" className="admin-modal__title">Toplu başvuru al</h3>
                <p className="admin-modal__subtitle">
                  Kayıtlı kullanıcılar seçilen eğitime belge istenmeden, doğrudan <strong>onaylı</strong> başvuru olarak eklenir.
                </p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeBulk} disabled={bulk.step === "uploading"} aria-label="Kapat">
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>

            <div className="admin-modal__body">
              <div className="admin-modal-panel">
                <h4 className="admin-modal-panel__title">1. Eğitim seçin</h4>
                <select
                  value={bulk.educationId}
                  disabled={bulk.step === "uploading"}
                  onChange={(e) => setBulk((prev) => ({ ...prev, educationId: e.target.value }))}
                  aria-label="Başvuru yapılacak eğitim"
                  style={{ width: "100%" }}
                >
                  <option value="">Başvuru yapılacak eğitimi seçin</option>
                  {bulkEducations.map((edu) => (
                    <option key={edu.id} value={edu.id}>
                      {edu.code ? `${edu.code} — ` : ""}
                      {edu.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-modal-panel">
                <h4 className="admin-modal-panel__title">2. Excel şablonu</h4>
                <p style={{ margin: "0 0 10px", lineHeight: 1.55 }}>
                  Toplu başvuru için lütfen aşağıdaki Excel şablonunu indiriniz ve yüklemeyi bu şablona göre yapınız.
                  Sütun sırası sabittir: <strong>1. T.C. Kimlik No</strong>, <strong>2. E-Posta</strong>. İlk satır başlıktır.
                </p>
                <p style={{ margin: "0 0 12px", lineHeight: 1.55, color: "#647086" }}>
                  Yalnızca T.C. kimlik numarası <strong>ve</strong> e-postası aynı kayıtlı kullanıcıyla eşleşen satırlar eklenir;
                  eşleşmeyenler aşağıda listelenir.
                </p>
                <button type="button" className="btn btn-outline" onClick={downloadBulkTemplate}>
                  <i className="fa-solid fa-file-excel" /> Şablonu indir (TopluBasvuruFormu.xlsx)
                </button>
              </div>

              <div className="admin-modal-panel">
                <h4 className="admin-modal-panel__title">3. Excel dosyasını yükleyin</h4>
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  style={{ display: "none" }}
                  onChange={handleBulkFile}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => bulkFileRef.current?.click()}
                    disabled={bulk.step === "uploading" || !bulk.educationId}
                    title={!bulk.educationId ? "Önce eğitim seçin" : undefined}
                  >
                    Dosya seç
                  </button>
                  <span style={{ color: "#647086" }}>
                    {bulk.fileName || (bulk.educationId ? "Henüz dosya seçilmedi." : "Dosya seçmeden önce eğitim seçin.")}
                  </span>
                </div>
                {bulk.step === "ready" && bulk.rows.length > 0 ? (
                  <p style={{ margin: "12px 0 0" }}>
                    <strong>{bulk.rows.length}</strong> satır okundu. Başlatmak için “Başvuruları yükle” butonuna basın.
                  </p>
                ) : null}
                {bulk.step === "uploading" ? (
                  <p style={{ margin: "12px 0 0" }}>
                    Yükleniyor… <strong>{bulk.processed}</strong> / {bulk.rows.length}
                  </p>
                ) : null}
                {bulk.error ? <p className="admin-form-error" style={{ marginTop: 12 }}>{bulk.error}</p> : null}
              </div>

              {bulk.step === "done" || bulk.results.length ? (
                <div className="admin-modal-panel">
                  <h4 className="admin-modal-panel__title">Sonuç</h4>
                  <p style={{ margin: "0 0 10px" }}>
                    <span style={{ color: "#16a34a" }}>Eklenen: <strong>{bulkCount("created")}</strong></span>
                    {" · "}
                    <span style={{ color: "#0d47a1" }}>Bekleyen başvurusu onaylanan: <strong>{bulkCount("approved")}</strong></span>
                    {" · "}
                    <span style={{ color: "#b45309" }}>Atlanan: <strong>{bulkSkipped.length}</strong></span>
                    {" · "}
                    <span style={{ color: "#dc2626" }}>Kayıtlı olmayan: <strong>{bulkNotFound.length}</strong></span>
                  </p>

                  {bulkNotFound.length ? (
                    <>
                      <h5 style={{ margin: "14px 0 8px" }}>Kayıtlı olmayan kullanıcılar (eklenmedi)</h5>
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Satır</th>
                              <th>T.C. Kimlik No</th>
                              <th>E-Posta</th>
                              <th>Neden</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkNotFound.map((r, index) => (
                              <tr key={`nf-${r.sheetRow}-${index}`}>
                                <td>{r.sheetRow ?? "-"}</td>
                                <td>{r.nationalId || "-"}</td>
                                <td>{r.email || "-"}</td>
                                <td style={{ color: "#dc2626" }}>{r.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}

                  {bulkSkipped.length ? (
                    <>
                      <h5 style={{ margin: "14px 0 8px" }}>Atlanan satırlar</h5>
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Satır</th>
                              <th>Ad Soyad</th>
                              <th>T.C. Kimlik No</th>
                              <th>E-Posta</th>
                              <th>Neden</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkSkipped.map((r, index) => (
                              <tr key={`sk-${r.sheetRow}-${index}`}>
                                <td>{r.sheetRow ?? "-"}</td>
                                <td>{r.fullName ? formatPersonName(r.fullName) : "-"}</td>
                                <td>{r.nationalId || "-"}</td>
                                <td>{r.email || "-"}</td>
                                <td style={{ color: "#b45309" }}>{r.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={closeBulk} disabled={bulk.step === "uploading"}>
                  {bulk.step === "done" ? "Kapat" : "İptal"}
                </button>
                {bulk.step !== "done" ? (
                  <button
                    type="button"
                    className="btn btn--modal-primary"
                    onClick={runBulkImport}
                    disabled={bulk.step !== "ready" || !bulk.educationId}
                  >
                    {bulk.step === "uploading" ? "Yükleniyor…" : "Başvuruları yükle"}
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
