import { useMemo, useState } from "react";
import { PAGE_SIZE } from "../modules";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";

const moduleConfig = {
  normalUsers: {
    title: "Kayıt Listesi",
    fields: ["firstName", "lastName", "email", "password"],
    labels: { firstName: "Ad", lastName: "Soyad", email: "E-Posta", password: "Şifre" },
  },
  adminUsers: {
    title: "Yönetim Listesi",
    fields: ["firstName", "lastName", "email", "password", "phone", "institutionId", "roleId"],
    labels: { firstName: "Ad", lastName: "Soyad", email: "E-Posta", password: "Şifre", phone: "Telefon", institutionId: "Kurum", roleId: "Rol" },
  },
  institutions: {
    title: "Kurum Listesi",
    fields: ["name", "logoUrl", "websiteUrl", "description", "authorizedPerson"],
    labels: { name: "Kurum Adı", logoUrl: "Logo URL", websiteUrl: "Web Site", description: "Açıklama", authorizedPerson: "Yetkili Kişi" },
  },
  educations: {
    title: "Eğitim Listesi",
    fields: ["name", "institutionId", "instructorId", "description", "imageUrl", "code", "duration", "content"],
    labels: {
      name: "Eğitim Adı",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      description: "Açıklama",
      imageUrl: "Görsel URL",
      code: "Eğitim Kodu",
      duration: "Süre",
      content: "İçerik",
    },
  },
  instructors: {
    title: "Eğitmen Listesi",
    fields: ["firstName", "lastName", "title", "department", "about", "email", "password"],
    labels: { firstName: "Ad", lastName: "Soyad", title: "Ünvan", department: "Bölüm", about: "Hakkında", email: "E-Posta", password: "Şifre" },
  },
  educationCalendar: {
    title: "Eğitim Takvimi Listesi",
    fields: ["educationName", "imageUrl", "description", "content", "instructorInfo", "calendarDate"],
    labels: {
      educationName: "Eğitim Adı",
      imageUrl: "Görsel URL",
      description: "Açıklama",
      content: "İçerik",
      instructorInfo: "Eğitmen Bilgisi",
      calendarDate: "Takvim Tarihi",
    },
  },
  newsletter: {
    title: "Bülten Kayıtları",
    fields: ["email", "createdAt"],
    labels: { email: "E-Posta", createdAt: "Kayıt Tarihi" },
  },
  contactForms: {
    title: "İletişim Formları",
    fields: ["fullName", "email", "phone", "subject", "message", "isRead", "createdAt"],
    labels: { fullName: "Ad Soyad", email: "E-Posta", phone: "Telefon", subject: "Konu", message: "Mesaj", isRead: "Okundu", createdAt: "Tarih" },
  },
  examQuestions: {
    title: "Sınav Soruları",
    fields: ["questionText", "difficulty", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "educationId", "instructorId"],
    labels: {
      questionText: "Soru",
      difficulty: "Zorluk",
      optionA: "A",
      optionB: "B",
      optionC: "C",
      optionD: "D",
      correctAnswer: "Doğru Cevap",
      educationId: "Eğitim",
      instructorId: "Eğitmen",
    },
  },
};

const renderValue = (value) => {
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return value ?? "-";
};

export default function CrudListPage({ moduleKey }) {
  const { hasPermission } = useAdminAuth();
  const data = useAdminData();
  const config = moduleConfig[moduleKey];
  const rows = data[moduleKey] || [];

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({});

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        Object.values(row).some((value) => String(value).toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [rows, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing("new");
    setForm(config.fields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}));
  };

  const openEdit = (row) => {
    setEditing(row.id);
    setForm(config.fields.reduce((acc, key) => ({ ...acc, [key]: row[key] ?? "" }), {}));
  };

  const submitForm = (event) => {
    event.preventDefault();
    if (editing === "new") data.createItem(moduleKey, form);
    else data.updateItem(moduleKey, editing, form);
    setEditing(null);
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>{config.title}</h2>
          <p>Arama, filtreleme, CRUD ve 20 kayıt/sayfa pagination hazır.</p>
        </div>
        {hasPermission(moduleKey, "canCreate") && (
          <button type="button" className="btn" onClick={openCreate}>
            Ekle
          </button>
        )}
      </div>

      <div className="admin-table-tools">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ara..." />
        <select defaultValue="">
          <option value="">Filtre (örnek)</option>
          <option value="newest">En Yeni</option>
          <option value="oldest">En Eski</option>
        </select>
      </div>

      {pagedRows.length === 0 ? (
        <div className="admin-empty-state">
          <i className="fa-regular fa-folder-open" />
          <h3>Kayıt bulunamadı</h3>
          <p>Filtreleri değiştirerek tekrar deneyin veya yeni kayıt ekleyin.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {config.fields.slice(0, 4).map((field) => (
                  <th key={field}>{config.labels[field]}</th>
                ))}
                <th>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.id}>
                  {config.fields.slice(0, 4).map((field) => (
                    <td key={field}>{renderValue(row[field])}</td>
                  ))}
                  <td>
                    <div className="admin-actions">
                      <button type="button" onClick={() => setDetail(row)}>
                        Detay
                      </button>
                      {hasPermission(moduleKey, "canUpdate") && (
                        <button type="button" onClick={() => openEdit(row)}>
                          Düzenle
                        </button>
                      )}
                      {hasPermission(moduleKey, "canDelete") && (
                        <button type="button" className="is-danger" onClick={() => setDeleting(row)}>
                          Sil
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {editing && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={submitForm}>
            <h3>{editing === "new" ? "Yeni Kayıt" : "Kaydı Düzenle"}</h3>
            <div className="admin-form-grid">
              {config.fields.map((field) => (
                <label key={field}>
                  <span>{config.labels[field]}</span>
                  <input value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required />
                </label>
              ))}
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                İptal
              </button>
              <button type="submit" className="btn">
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3>Detay</h3>
            <div className="admin-detail-grid">
              {config.fields.map((field) => (
                <p key={field}>
                  <strong>{config.labels[field]}:</strong> {renderValue(detail[field])}
                </p>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => setDetail(null)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3>Silme Onayı</h3>
            <p>Bu kayıt kalıcı olarak silinecek. Devam edilsin mi?</p>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDeleting(null)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  data.deleteItem(moduleKey, deleting.id);
                  setDeleting(null);
                }}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
