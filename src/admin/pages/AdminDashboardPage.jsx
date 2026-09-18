import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { salesFilterLabel } from "../../constants/salesFilters";

const formatIstanbul = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatNumber = (value) => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);

const moduleLabelMap = {
  normalUsers: "Kayıt Listesi",
  adminUsers: "Yönetim Listesi",
  institutions: "Kurum Listesi",
  educationCategories: "Eğitim Kategorisi",
  approvedEducations: "Onaylanmış Eğitim",
  educations: "Eğitim Listesi",
  instructors: "Eğitmen",
  educationCalendar: "Takvim",
  newsletter: "Bülten",
  contactForms: "İletişim",
  examQuestions: "Sınav Soruları",
  examPortalAccess: "Portal Girişleri",
  examResults: "Sınav Sonuçları",
  examSuccessPayments: "Ödemeler",
  certificateList: "Sertifika",
  certificateNotifications: "Sertifika Bildirim",
  adminMessaging: "Sohbet",
  roles: "Rol ve Yetki",
  educationApplications: "Başvurular",
};

const actionLabelMap = {
  create: "oluşturuldu",
  update: "güncellendi",
  delete: "silindi",
  permission_update: "yetki güncellendi",
};

function HeroMetric({ label, value, hint, tone = "default" }) {
  return (
    <article className={`dash-hero-metric dash-hero-metric--${tone}`}>
      <span className="dash-hero-metric__label">{label}</span>
      <strong className="dash-hero-metric__value">{formatNumber(value)}</strong>
      {hint ? <span className="dash-hero-metric__hint">{hint}</span> : null}
    </article>
  );
}

function StatTile({ label, value, icon, to, accent }) {
  const inner = (
    <>
      <div className="dash-stat-tile__icon" style={accent ? { background: accent } : undefined} aria-hidden>
        <i className={icon} />
      </div>
      <div className="dash-stat-tile__body">
        <p>{label}</p>
        <strong>{formatNumber(value)}</strong>
      </div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="dash-stat-tile dash-stat-tile--link">
        {inner}
      </Link>
    );
  }
  return <article className="dash-stat-tile">{inner}</article>;
}

function AttentionCard({ title, count, description, to, icon, tone }) {
  return (
    <Link to={to} className={`dash-attention dash-attention--${tone}`}>
      <span className="dash-attention__icon" aria-hidden>
        <i className={icon} />
      </span>
      <div className="dash-attention__body">
        <div className="dash-attention__top">
          <strong>{title}</strong>
          <span className="dash-attention__count">{formatNumber(count)}</span>
        </div>
        <p>{description}</p>
      </div>
      <i className="fa-solid fa-chevron-right dash-attention__chevron" aria-hidden />
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { getDashboard } = useAdminData();
  const { session, hasPermission } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getDashboard({ force: true })
      .then((data) => {
        if (!active) return;
        setDashboard(data);
      })
      .catch((e) => {
        if (!active) return;
        setDashboard(null);
        setError(e?.message || "Dashboard yüklenemedi.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getDashboard]);

  const stats = dashboard?.stats || {};
  const monthly = dashboard?.monthlyRegistrations || [];
  const maxMonthly = useMemo(() => Math.max(1, ...monthly.map((m) => Number(m.count) || 0)), [monthly]);
  const salesBreakdown = dashboard?.salesBreakdown || [];
  const maxSales = useMemo(() => Math.max(1, ...salesBreakdown.map((s) => Number(s.count) || 0)), [salesBreakdown]);

  const greetingName = session?.user?.firstName || "Yönetici";
  const greeting = useMemo(() => {
    const hour = Number(
      new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "numeric", hour12: false }).format(new Date()),
    );
    if (hour < 12) return "Günaydın";
    if (hour < 18) return "İyi günler";
    return "İyi akşamlar";
  }, []);

  const attentionItems = [
    hasPermission("contactForms", "canView")
      ? {
          title: "Okunmamış formlar",
          count: stats.unreadContacts || 0,
          description: "Yanıt bekleyen iletişim mesajları",
          to: "/admin/iletisim-formlari",
          icon: "fa-solid fa-envelope-open-text",
          tone: "amber",
        }
      : null,
    hasPermission("educationApplications", "canView")
      ? {
          title: "Bekleyen başvurular",
          count: stats.pendingApplications || 0,
          description: "Ücretli eğitim başvuru onayları",
          to: "/admin/egitim-basvuru-formu",
          icon: "fa-solid fa-file-signature",
          tone: "blue",
        }
      : null,
    hasPermission("examSuccessPayments", "canView")
      ? {
          title: "Ödeme bekleyenler",
          count: stats.awaitingPayment || 0,
          description: "≥60 puan, ödeme henüz alınmadı",
          to: "/admin/sinav-basarili-odemeler",
          icon: "fa-solid fa-wallet",
          tone: "green",
        }
      : null,
    hasPermission("certificateList", "canView")
      ? {
          title: "E-devlet bekleyen",
          count: stats.awaitingEdevlet || 0,
          description: "Ödemesi alınmış, e-devlet işlenmedi",
          to: "/admin/sertifika-listesi",
          icon: "fa-solid fa-certificate",
          tone: "navy",
        }
      : null,
    hasPermission("certificateNotifications", "canView")
      ? {
          title: "Sertifika bildirimleri",
          count: (stats.certNotifySuperadmin || 0) + (stats.certNotifyYetkili || 0),
          description: "Onay / kabul kuyruğundaki paketler",
          to: "/admin/sertifika-bildirim",
          icon: "fa-solid fa-bell",
          tone: "red",
        }
      : null,
  ].filter(Boolean);

  if (loading && !dashboard) {
    return (
      <section className="admin-page">
        <div className="admin-page-head">
          <h2>Dashboard</h2>
          <p>Veriler yükleniyor…</p>
        </div>
        <div className="dash-skeleton" aria-hidden>
          <div className="dash-skeleton__hero" />
          <div className="dash-skeleton__grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dash-skeleton__card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page dash-page">
      <div className="dash-hero">
        <div className="dash-hero__copy">
          <p className="dash-hero__eyebrow">{greeting}, {greetingName}</p>
          <h2>Operasyon paneli</h2>
          <p>
            Kayıtlar, sınav akışı, sertifika ve başvuruların anlık özeti. Son güncelleme:{" "}
            {formatIstanbul(dashboard?.generatedAt)}
          </p>
        </div>
        <div className="dash-hero__metrics">
          <HeroMetric label="Bugün yeni kayıt" value={stats.usersToday || 0} hint="İstanbul günü" tone="light" />
          <HeroMetric label="Bugün portal girişi" value={stats.portalVisitsToday || 0} hint="Sınav portalı" tone="light" />
          <HeroMetric label="E-devlet tamamlanan" value={stats.edevletDone || 0} hint="İşlenmiş sertifika" tone="accent" />
        </div>
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      {attentionItems.some((item) => item.count > 0) ? (
        <div className="dash-attention-grid">
          {attentionItems
            .filter((item) => item.count > 0)
            .map((item) => (
              <AttentionCard key={item.to} {...item} />
            ))}
        </div>
      ) : (
        <div className="dash-all-clear">
          <i className="fa-solid fa-circle-check" aria-hidden />
          <div>
            <strong>Kritik kuyruk boş</strong>
            <p>Bekleyen form, başvuru veya sertifika işlemi görünmüyor.</p>
          </div>
        </div>
      )}

      <div className="dash-stat-grid">
        <StatTile label="Kayıtlı kullanıcı" value={stats.normalUsers} icon="fa-solid fa-users" to="/admin/kayit-listesi" accent="#e8f0ff" />
        <StatTile label="Yönetici" value={stats.adminUsers} icon="fa-solid fa-user-shield" to="/admin/yonetim-listesi" accent="#efe9ff" />
        <StatTile label="Kurum" value={stats.institutions} icon="fa-solid fa-building" to="/admin/kurum-listesi" accent="#e7f7ef" />
        <StatTile label="Eğitim" value={stats.educations} icon="fa-solid fa-graduation-cap" to="/admin/egitim-listesi" accent="#fff4e5" />
        <StatTile label="Ücretli eğitim" value={stats.paidEducations} icon="fa-solid fa-coins" to="/admin/egitim-listesi" accent="#fff0f0" />
        <StatTile label="Eğitmen" value={stats.instructors} icon="fa-solid fa-chalkboard-user" to="/admin/egitmen-listesi" accent="#eaf7fb" />
        <StatTile label="Takvim kaydı" value={stats.educationCalendar} icon="fa-solid fa-calendar-days" to="/admin/egitim-takvimi-listesi" accent="#f3f0ff" />
        <StatTile label="Bülten" value={stats.newsletter} icon="fa-solid fa-envelope-circle-check" to="/admin/bulten-kayitlari" accent="#eef6ff" />
      </div>

      <div className="dash-main-grid">
        <article className="admin-panel-card dash-panel">
          <div className="dash-panel__head">
            <div>
              <h3>Aylık kullanıcı kayıtları</h3>
              <p>Son 6 ay · gerçek veri</p>
            </div>
          </div>
          <div className="dash-bars" role="img" aria-label="Aylık kayıt grafiği">
            {monthly.map((item) => {
              const height = Math.max(8, Math.round((Number(item.count) / maxMonthly) * 100));
              return (
                <div key={item.monthKey} className="dash-bars__col">
                  <span className="dash-bars__value">{item.count}</span>
                  <div className="dash-bars__bar" style={{ height: `${height}%` }} />
                  <span className="dash-bars__label">{item.label}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="admin-panel-card dash-panel">
          <div className="dash-panel__head">
            <div>
              <h3>Eğitim satış dağılımı</h3>
              <p>Satış filtresine göre eğitim sayısı</p>
            </div>
          </div>
          {salesBreakdown.length === 0 ? (
            <p className="dash-empty">Henüz eğitim kaydı yok.</p>
          ) : (
            <ul className="dash-sales-list">
              {salesBreakdown.map((row) => {
                const width = Math.max(6, Math.round((Number(row.count) / maxSales) * 100));
                const label = salesFilterLabel(row.key) || (row.key === "diger" ? "Diğer / boş" : row.key);
                return (
                  <li key={row.key}>
                    <div className="dash-sales-list__meta">
                      <span>{label}</span>
                      <strong>{formatNumber(row.count)}</strong>
                    </div>
                    <div className="dash-sales-list__track">
                      <span style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="admin-panel-card dash-panel">
          <div className="dash-panel__head">
            <div>
              <h3>Son kayıtlar</h3>
              <p>Yeni kullanıcılar</p>
            </div>
            {hasPermission("normalUsers", "canView") ? (
              <Link className="dash-panel__link" to="/admin/kayit-listesi">
                Tümü
              </Link>
            ) : null}
          </div>
          <ul className="dash-feed">
            {(dashboard?.latestUsers || []).length === 0 ? (
              <li className="dash-empty">Kayıt yok.</li>
            ) : (
              (dashboard?.latestUsers || []).map((user) => (
                <li key={user.id}>
                  <span className="dash-feed__avatar" aria-hidden>
                    {(user.firstName || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="dash-feed__body">
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <span>{user.email}</span>
                  </div>
                  <time>{formatIstanbul(user.createdAt)}</time>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="admin-panel-card dash-panel">
          <div className="dash-panel__head">
            <div>
              <h3>İletişim formları</h3>
              <p>
                {formatNumber(stats.unreadContacts || 0)} okunmamış · {formatNumber(stats.contactForms || 0)} toplam
              </p>
            </div>
            {hasPermission("contactForms", "canView") ? (
              <Link className="dash-panel__link" to="/admin/iletisim-formlari">
                Tümü
              </Link>
            ) : null}
          </div>
          <ul className="dash-feed">
            {(dashboard?.latestContacts || []).length === 0 ? (
              <li className="dash-empty">Form yok.</li>
            ) : (
              (dashboard?.latestContacts || []).map((form) => (
                <li key={form.id}>
                  <span className={`dash-feed__dot${form.isRead ? "" : " is-unread"}`} aria-hidden />
                  <div className="dash-feed__body">
                    <strong>{form.fullName}</strong>
                    <span>{form.subject || "Konu yok"}</span>
                  </div>
                  <time>{formatIstanbul(form.createdAt)}</time>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="admin-panel-card dash-panel dash-panel--wide">
          <div className="dash-panel__head">
            <div>
              <h3>Son aktiviteler</h3>
              <p>Yönetici işlem günlüğü</p>
            </div>
            {hasPermission("activityLogs", "canView") ? (
              <Link className="dash-panel__link" to="/admin/aktivite-listesi">
                Tümü
              </Link>
            ) : null}
          </div>
          <ul className="dash-activity">
            {(dashboard?.latestLogs || []).length === 0 ? (
              <li className="dash-empty">Aktivite yok.</li>
            ) : (
              (dashboard?.latestLogs || []).map((log) => (
                <li key={log.id}>
                  <span className="dash-activity__badge">{actionLabelMap[log.action] || log.action}</span>
                  <div className="dash-activity__body">
                    <strong>{moduleLabelMap[log.moduleName] || log.moduleName || "Kayıt"}</strong>
                    <span>{log.adminName}</span>
                  </div>
                  <time>{formatIstanbul(log.createdAt)}</time>
                </li>
              ))
            )}
          </ul>
        </article>


      </div>
    </section>
  );
}
