import { useEffect, useState } from "react";
import { useAdminData } from "../context/AdminDataContext";

const moduleLabelMap = {
  normalUsers: "Kayıt Listesi",
  adminUsers: "Yönetim Listesi",
  institutions: "Kurum Listesi",
  educations: "Eğitim Listesi",
  instructors: "Eğitmen Listesi",
  educationCalendar: "Eğitim Takvimi",
  newsletter: "Bülten Kayıtları",
  contactForms: "İletişim Formları",
  examQuestions: "Sınav Soruları",
  roles: "Rol ve Yetki",
};

const actionLabelMap = {
  create: "oluşturuldu",
  update: "güncellendi",
  delete: "silindi",
  permission_update: "yetkileri güncellendi",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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

export default function ActivityLogsPage() {
  const data = useAdminData();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    data.getActivityLogs(page, 100)
      .then((result) => {
        setLogs(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Aktivite Listesi</h2>
          <p>Sistemde yapılan işlemler en yeni kayıt en üstte olacak şekilde listelenir.</p>
        </div>
      </div>

      {loading ? <p>Yükleniyor...</p> : null}
      {error ? <p className="admin-form-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <article className="admin-panel-card">
            <ul className="admin-activity-list">
              {logs.map((log) => {
                const moduleLabel = moduleLabelMap[log.moduleName] || log.moduleName || "Kayıt";
                const actionLabel = actionLabelMap[log.action] || (log.action || "işlem");
                const actor = log.adminFirstName || log.adminLastName
                  ? `${log.adminFirstName || ""} ${log.adminLastName || ""}`.trim()
                  : log.adminEmail || "Sistem";
                return (
                  <li key={log.id}>
                    <strong>{moduleLabel}</strong>
                    <span>{`${actor} tarafından ${actionLabel}.`}</span>
                    <small>{formatDate(log.createdAt)}</small>
                  </li>
                );
              })}
            </ul>
          </article>
          <div className="admin-pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>
              Önceki
            </button>
            <span>
              Sayfa {page} / {totalPages}
            </span>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((prev) => prev + 1)}>
              Sonraki
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
