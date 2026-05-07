import { useEffect, useMemo, useState } from "react";
import { useAdminData } from "../context/AdminDataContext";

function StatCard({ label, value, icon }) {
  return (
    <article className="admin-stat-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      <i className={icon} />
    </article>
  );
}

export default function AdminDashboardPage() {
  const data = useAdminData();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    data.getDashboard().then(setDashboard).catch(() => setDashboard(null));
  }, []);

  const monthlyUsers = useMemo(() => {
    const total = dashboard?.stats?.normalUsers || 0;
    return [10, 14, 20, 19, 23, 25, 27, total];
  }, [dashboard?.stats?.normalUsers]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Dashboard</h2>
          <p>CRM genel görünümü, son aktiviteler ve hızlı aksiyonlar.</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Toplam Kayıtlı Kullanıcı" value={dashboard?.stats?.normalUsers || 0} icon="fa-solid fa-users" />
        <StatCard label="Toplam Yönetici" value={dashboard?.stats?.adminUsers || 0} icon="fa-solid fa-user-shield" />
        <StatCard label="Toplam Kurum" value={dashboard?.stats?.institutions || 0} icon="fa-solid fa-building" />
        <StatCard label="Toplam Eğitim" value={dashboard?.stats?.educations || 0} icon="fa-solid fa-graduation-cap" />
        <StatCard label="Toplam Eğitmen" value={dashboard?.stats?.instructors || 0} icon="fa-solid fa-chalkboard-user" />
        <StatCard label="Toplam Bülten Kaydı" value={dashboard?.stats?.newsletter || 0} icon="fa-solid fa-envelope-open-text" />
        <StatCard label="İletişim Formu" value={dashboard?.stats?.contactForms || 0} icon="fa-solid fa-comments" />
        <StatCard label="Yaklaşan Takvim Kaydı" value={dashboard?.stats?.educationCalendar || 0} icon="fa-solid fa-calendar-days" />
      </div>

      <div className="admin-dashboard-grid">
        <article className="admin-panel-card">
          <h3>Aylık Kayıt Grafiği (Temsili)</h3>
          <div className="admin-bars">
            {monthlyUsers.map((item, index) => (
              <div key={`${item}-${index}`} style={{ height: `${Math.max(28, item * 2)}px` }}>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel-card">
          <h3>Son Kayıt Olan Kullanıcılar</h3>
          <ul className="admin-activity-list">
            {(dashboard?.latestUsers || []).map((user) => (
              <li key={user.id}>
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{user.email}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="admin-panel-card">
          <h3>Son Gelen İletişim Formları</h3>
          <ul className="admin-activity-list">
            {(dashboard?.latestContacts || []).map((form) => (
              <li key={form.id}>
                <strong>{form.fullName}</strong>
                <span>{form.subject}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="admin-panel-card">
          <h3>Hızlı Aksiyonlar</h3>
          <div className="admin-quick-actions">
            <button type="button">Yeni Eğitim Ekle</button>
            <button type="button">Yeni Yönetici Ekle</button>
            <button type="button">Takvim Duyurusu Oluştur</button>
            <button type="button">Formları Dışa Aktar</button>
          </div>
        </article>
      </div>
    </section>
  );
}
