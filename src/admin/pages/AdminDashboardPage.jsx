import { useMemo } from "react";
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

  const monthlyUsers = useMemo(() => {
    const total = data.normalUsers.length;
    return [10, 14, 20, 19, 23, 25, 27, total];
  }, [data.normalUsers.length]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Dashboard</h2>
          <p>CRM genel görünümü, son aktiviteler ve hızlı aksiyonlar.</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Toplam Kayıtlı Kullanıcı" value={data.normalUsers.length} icon="fa-solid fa-users" />
        <StatCard label="Toplam Yönetici" value={data.adminUsers.length} icon="fa-solid fa-user-shield" />
        <StatCard label="Toplam Kurum" value={data.institutions.length} icon="fa-solid fa-building" />
        <StatCard label="Toplam Eğitim" value={data.educations.length} icon="fa-solid fa-graduation-cap" />
        <StatCard label="Toplam Eğitmen" value={data.instructors.length} icon="fa-solid fa-chalkboard-user" />
        <StatCard label="Toplam Bülten Kaydı" value={data.newsletter.length} icon="fa-solid fa-envelope-open-text" />
        <StatCard label="İletişim Formu" value={data.contactForms.length} icon="fa-solid fa-comments" />
        <StatCard label="Yaklaşan Takvim Kaydı" value={data.educationCalendar.length} icon="fa-solid fa-calendar-days" />
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
            {data.normalUsers.slice(0, 6).map((user) => (
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
            {data.contactForms.slice(0, 6).map((form) => (
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
