import { useEffect, useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

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
    fields: ["name", "code", "logoUrl", "websiteUrl", "description", "authorizedPerson"],
    labels: {
      name: "Kurum Adı",
      code: "Kurum Kodu",
      logoUrl: "Logo URL",
      websiteUrl: "Web Site",
      description: "Açıklama",
      authorizedPerson: "Yetkili Kişi",
    },
  },
  educations: {
    title: "Eğitim Listesi",
    fields: ["name", "institutionId", "instructorId", "description", "imageUrl", "code", "duration", "contentDocPath"],
    labels: {
      name: "Eğitim Adı",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      description: "Açıklama",
      imageUrl: "Görsel URL",
      code: "Eğitim Kodu",
      duration: "Eğitim Saati",
      contentDocPath: "İçerik Dosyası",
    },
  },
  instructors: {
    title: "Eğitmen Listesi",
    fields: ["firstName", "lastName", "email", "title", "department", "about"],
    labels: { firstName: "Ad", lastName: "Soyad", email: "E-Posta", title: "Ünvan", department: "Bölüm", about: "Hakkında" },
  },
  educationCalendar: {
    title: "Eğitim Takvimi Listesi",
    fields: ["educationName", "institutionId", "instructorId", "description", "imageUrl", "code", "duration", "contentDocPath", "calendarDate"],
    labels: {
      educationName: "Eğitim Adı",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      imageUrl: "Görsel URL",
      description: "Açıklama",
      code: "Eğitim Kodu",
      duration: "Eğitim Saati",
      contentDocPath: "İçerik Dosyası",
      calendarDate: "Yayın Tarihi/Saati",
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
    fields: ["educationId", "instructorId", "topicDocPath", "questionsDocPath", "generatedQuestions"],
    labels: {
      educationId: "Eğitim",
      instructorId: "Eğitmen",
      topicDocPath: "Konu Başlıklı Word Dosyası",
      questionsDocPath: "60 Soruluk Word Dosyası",
      generatedQuestions: "Hazırlanan Sorular",
    },
  },
};

const renderValue = (value) => {
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return value ?? "-";
};

const formatIstanbulDateTime = (value) => {
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

const renderFieldValue = (field, value) => {
  const normalizeAssetUrl = (asset) => {
    if (!asset) return "";
    const raw = String(asset).trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/uploads/")) return `${API_ORIGIN}${raw}`;
    return raw;
  };
  if ((field === "logoUrl" || field === "imageUrl") && value) {
    return <img src={normalizeAssetUrl(value)} alt="Yüklenen görsel" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />;
  }
  if (field === "createdAt" || field === "updatedAt" || field === "calendarDate") return formatIstanbulDateTime(value);
  return renderValue(value);
};

const renderTableCellValue = (field, value, maps = {}) => {
  const normalizeAssetUrl = (asset) => {
    if (!asset) return "";
    const raw = String(asset).trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/uploads/")) return `${API_ORIGIN}${raw}`;
    return raw;
  };
  if ((field === "logoUrl" || field === "imageUrl") && value) {
    return <img src={normalizeAssetUrl(value)} alt="Yüklenen görsel" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />;
  }
  if (field === "roleId") return maps.rolesById?.[value]?.name || value || "-";
  if (field === "institutionId") return maps.institutionsById?.[value]?.name || value || "-";
  if (field === "instructorId") {
    const instructor = maps.instructorsById?.[value];
    if (!instructor) return value || "-";
    return instructor.fullName || `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim() || value || "-";
  }
  if (field === "educationId") return maps.educationsById?.[value]?.name || value || "-";
  if (field === "generatedQuestions") {
    const groups = value || {};
    const total = (groups.easy?.length || 0) + (groups.medium?.length || 0) + (groups.hard?.length || 0);
    return total ? `${total} soru` : "-";
  }
  return renderFieldValue(field, value);
};

const educationDurationOptions = [
  "30 dk",
  "45 dk",
  "60 dk (1 saat)",
  "90 dk (1.5 saat)",
  "120 dk (2 saat)",
  "180 dk (3 saat)",
  "240 dk (4 saat)",
  "300 dk (5 saat)",
  "360 dk (6 saat)",
];

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const examQuestionGroups = [
  { key: "easy", label: "Kolay" },
  { key: "medium", label: "Orta" },
  { key: "hard", label: "Zor" },
];

const renderExamQuestionPreview = (questions = {}, limit = 20) => (
  <div className="exam-question-preview">
    {examQuestionGroups.map((group) => (
      <div key={group.key}>
        <h4>{group.label} Seviye ({questions?.[group.key]?.length || 0})</h4>
        {(questions?.[group.key] || []).slice(0, limit).map((question, index) => (
          <article className="exam-question-card" key={`${group.key}-${index}`}>
            <strong>{index + 1}. {question.question}</strong>
            {Array.isArray(question.options) && question.options.length ? (
              <ol type="A">
                {question.options.map((option, optionIndex) => (
                  <li key={`${group.key}-${index}-${optionIndex}`}>{option}</li>
                ))}
              </ol>
            ) : null}
            {question.correctAnswer ? <small>Doğru Cevap: {question.correctAnswer}</small> : null}
          </article>
        ))}
      </div>
    ))}
  </div>
);

export default function CrudListPage({ moduleKey }) {
  const { hasPermission } = useAdminAuth();
  const data = useAdminData();
  const config = moduleConfig[moduleKey];
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [readStatusFilter, setReadStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [educationImageUploading, setEducationImageUploading] = useState(false);
  const [educationDocUploading, setEducationDocUploading] = useState(false);
  const [examDocUploading, setExamDocUploading] = useState("");
  const isContactFormsModule = moduleKey === "contactForms";
  const isInstructorsModule = moduleKey === "instructors";
  const isEducationsModule = moduleKey === "educations";
  const isEducationCalendarModule = moduleKey === "educationCalendar";
  const isEducationLikeModule = isEducationsModule || isEducationCalendarModule;
  const isExamQuestionsModule = moduleKey === "examQuestions";
  const roleOptions = [
    { code: "superadmin", label: "Süper Admin" },
    { code: "admin", label: "Admin" },
    { code: "egitmen", label: "Eğitmen" },
    { code: "yetkili", label: "Yetkili" },
  ];
  const rolesById = Object.fromEntries((data.roles || []).map((role) => [role.id, role]));
  const institutionsById = Object.fromEntries((data.institutions || []).map((institution) => [institution.id, institution]));
  const instructorsById = Object.fromEntries((data.instructors || []).map((instructor) => [instructor.id, instructor]));
  const educationInstructorsById = Object.fromEntries((data.educationInstructors || []).map((instructor) => [instructor.id, instructor]));
  const educationsById = Object.fromEntries((data.educations || []).map((education) => [education.id, education]));
  const formFields = isContactFormsModule
    ? config.fields.filter((field) => field !== "createdAt" && field !== "isRead")
    : isInstructorsModule
      ? ["title", "department", "about"]
    : config.fields;

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const resultWithFilter = await data.getModuleData(
        moduleKey,
        page,
        search,
        isContactFormsModule ? readStatusFilter : "all",
      );
      setRows(resultWithFilter.data);
      setTotalPages(resultWithFilter.pagination.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [moduleKey, page, search, readStatusFilter]);

  useEffect(() => {
    if (!data.roles.length || !data.institutions.length || !data.instructors.length || !data.educationInstructors.length || !data.educations.length) {
      data.loadBootstrap().catch(() => {});
    }
  }, []);

  const openCreate = () => {
    setEditing("new");
    setLogoUploading(false);
    setEducationImageUploading(false);
    setEducationDocUploading(false);
    setExamDocUploading("");
    const initialForm = formFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
    if (isContactFormsModule) {
      initialForm.isRead = false;
    }
    setForm(initialForm);
  };

  const openEdit = (row) => {
    setEditing(row.id);
    setLogoUploading(false);
    setEducationImageUploading(false);
    setEducationDocUploading(false);
    setExamDocUploading("");
    setForm(config.fields.reduce((acc, key) => ({ ...acc, [key]: row[key] ?? "" }), {}));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const payload = { ...form };
    if (isContactFormsModule) {
      delete payload.createdAt;
      if (editing === "new") {
        payload.isRead = false;
      }
    }
    if (editing === "new") await data.createItem(moduleKey, payload);
    else await data.updateItem(moduleKey, editing, payload);
    setEditing(null);
    await loadRows();
  };

  const markAsRead = async (rowId) => {
    await data.updateItem(moduleKey, rowId, { isRead: true });
    await loadRows();
  };

  const handleInstitutionLogoUpload = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    setError("");
    try {
      const result = await data.uploadInstitutionLogo(file);
      const uploadedUrl = result?.path || result?.url || "";
      setForm((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      if (!uploadedUrl) {
        setError("Görsel yüklendi ancak URL alınamadı. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleEducationImageUpload = async (file) => {
    if (!file) return;
    setEducationImageUploading(true);
    setError("");
    try {
      const result = await data.uploadEducationImage(file);
      const uploadedUrl = result?.path || result?.url || "";
      setForm((prev) => ({ ...prev, imageUrl: uploadedUrl }));
      if (!uploadedUrl) {
        setError("Görsel yüklendi ancak URL alınamadı. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEducationImageUploading(false);
    }
  };

  const handleEducationContentDocUpload = async (file) => {
    if (!file) return;
    setEducationDocUploading(true);
    setError("");
    try {
      const result = await data.uploadEducationContentDoc(file);
      setForm((prev) => ({
        ...prev,
        contentDocPath: result.path || "",
        contentDocName: result.fileName || file.name,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setEducationDocUploading(false);
    }
  };

  const handleExamDocUpload = async (file, mode) => {
    if (!file) return;
    setExamDocUploading(mode);
    setError("");
    try {
      const result = await data.uploadExamDoc(file, mode);
      setForm((prev) => ({
        ...prev,
        ...(mode === "generate"
          ? { topicDocPath: result.path || "", topicDocName: result.fileName || file.name }
          : { questionsDocPath: result.path || "", questionsDocName: result.fileName || file.name }),
        generatedQuestions: result.questions || prev.generatedQuestions || {},
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setExamDocUploading("");
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>{config.title}</h2>
          <p>Eğitim, Kurum, Eğitmen, Bülten, İletişim Formu, Sınav Soruları ve daha fazlasını yönetin.</p>
        </div>
        {hasPermission(moduleKey, "canCreate") && !isInstructorsModule && (
          <button type="button" className="btn" onClick={openCreate}>
            Ekle
          </button>
        )}
      </div>

      <div className="admin-table-tools">
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ara..." />
        <button type="button" className="btn btn-outline" onClick={() => { setPage(1); setSearch(searchInput); }}>
          Ara
        </button>
        {isContactFormsModule && (
          <select
            value={readStatusFilter}
            onChange={(event) => {
              setReadStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tümü</option>
            <option value="unread">Okunmayanlar</option>
            <option value="read">Okunanlar</option>
          </select>
        )}
      </div>

      {loading && <p>Yükleniyor...</p>}
      {error && <p className="admin-form-error">{error}</p>}
      {!loading && rows.length === 0 ? (
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
              {rows.map((row) => (
                <tr key={row.id}>
                  {config.fields.slice(0, 4).map((field) => (
                    <td key={field}>{renderTableCellValue(field, row[field], { rolesById, institutionsById, instructorsById: educationInstructorsById, educationsById })}</td>
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
                      {isContactFormsModule && hasPermission(moduleKey, "canUpdate") && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ color: row.isRead ? "#16a34a" : "#dc2626", borderColor: row.isRead ? "#16a34a" : "#dc2626" }}
                          onClick={() => {
                            if (!row.isRead) markAsRead(row.id);
                          }}
                          disabled={row.isRead}
                        >
                          {row.isRead ? "Okundu" : "Okunmadı"}
                        </button>
                      )}
                      {hasPermission(moduleKey, "canDelete") && !isInstructorsModule && (
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
          <form className={`admin-modal ${isEducationLikeModule || isExamQuestionsModule ? "admin-modal-scrollable admin-modal-education" : ""}`} onSubmit={submitForm}>
            <h3>{editing === "new" ? "Yeni Kayıt" : "Kaydı Düzenle"}</h3>
            <div className={`admin-form-grid ${isEducationLikeModule || isExamQuestionsModule ? "admin-form-grid-single" : ""}`}>
              {formFields.map((field) => (
                <label key={field}>
                  <span>{config.labels[field]}</span>
                  {isExamQuestionsModule && field === "educationId" ? (
                    <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                      <option value="" disabled>
                        Eğitim Seçin
                      </option>
                      {(data.educations || []).map((education) => (
                        <option key={education.id} value={education.id}>
                          {education.name}
                        </option>
                      ))}
                    </select>
                  ) : isExamQuestionsModule && field === "instructorId" ? (
                    <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                      <option value="" disabled>
                        Eğitmen Seçin
                      </option>
                      {(data.educationInstructors || []).map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.fullName || `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim()}
                        </option>
                      ))}
                    </select>
                  ) : isExamQuestionsModule && field === "topicDocPath" ? (
                    <>
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(event) => handleExamDocUpload(event.target.files?.[0], "generate")}
                        disabled={Boolean(examDocUploading)}
                      />
                      <input value={form[field] ?? ""} readOnly placeholder="Konu başlıkları dosya yolu" />
                    </>
                  ) : isExamQuestionsModule && field === "questionsDocPath" ? (
                    <>
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(event) => handleExamDocUpload(event.target.files?.[0], "classify")}
                        disabled={Boolean(examDocUploading)}
                      />
                      <input value={form[field] ?? ""} readOnly placeholder="60 soruluk dosya yolu" />
                    </>
                  ) : isExamQuestionsModule && field === "generatedQuestions" ? (
                    <>
                      {examDocUploading ? (
                        <div className="exam-ai-loading">
                          <strong>{examDocUploading === "generate" ? "Sorular oluşturuluyor..." : "Sorular ayrıştırılıyor..."}</strong>
                          <span>Word dosyası okunuyor ve yapay zeka sonucu hazırlanıyor. Lütfen bu pencereyi kapatmayın.</span>
                        </div>
                      ) : null}
                      {renderExamQuestionPreview(form.generatedQuestions, 20)}
                    </>
                  ) : moduleKey === "institutions" && field === "logoUrl" ? (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleInstitutionLogoUpload(event.target.files?.[0])}
                        disabled={logoUploading}
                      />
                      <input
                        value={form.logoUrl ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                        placeholder="Yüklenen görsel URL"
                        required
                      />
                    </>
                  ) : isEducationLikeModule && field === "imageUrl" ? (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleEducationImageUpload(event.target.files?.[0])}
                        disabled={educationImageUploading}
                      />
                      <input
                        value={form.imageUrl ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                        placeholder="Yüklenen görsel URL"
                        required
                      />
                    </>
                  ) : (
                    moduleKey === "adminUsers" && field === "roleId" ? (
                      <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                        <option value="" disabled>
                          Rol Seçin
                        </option>
                        {roleOptions.map((item) => {
                          const role = (data.roles || []).find((r) => r.code === item.code);
                          if (!role) return null;
                          return (
                            <option key={role.id} value={role.id}>
                              {item.label}
                            </option>
                          );
                        })}
                      </select>
                    ) : moduleKey === "adminUsers" && field === "institutionId" ? (
                      <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                        <option value="" disabled>
                          Kurum Seçin
                        </option>
                        {(data.institutions || []).map((institution) => (
                          <option key={institution.id} value={institution.id}>
                            {institution.name}
                          </option>
                        ))}
                      </select>
                    ) : isEducationLikeModule && field === "institutionId" ? (
                      <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                        <option value="" disabled>
                          Kurum Seçin
                        </option>
                        {(data.institutions || []).map((institution) => (
                          <option key={institution.id} value={institution.id}>
                            {institution.name}
                          </option>
                        ))}
                      </select>
                    ) : isEducationLikeModule && field === "instructorId" ? (
                      <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                        <option value="" disabled>
                          Eğitmen Seçin
                        </option>
                        {(data.educationInstructors || []).map((instructor) => (
                          <option key={instructor.id} value={instructor.id}>
                            {instructor.fullName || `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim()}
                          </option>
                        ))}
                      </select>
                    ) : isEducationLikeModule && field === "contentDocPath" ? (
                      <>
                        <input
                          type="file"
                          accept=".docx"
                          onChange={(event) => handleEducationContentDocUpload(event.target.files?.[0])}
                          disabled={educationDocUploading}
                        />
                        <input
                          value={form[field] ?? ""}
                          onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                          placeholder="Yüklenen dosya yolu"
                          required
                        />
                      </>
                    ) : isEducationLikeModule && field === "description" ? (
                      <textarea
                        rows={4}
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        required
                      />
                    ) : isEducationLikeModule && field === "code" ? (
                      <input
                        type="text"
                        value={form[field] ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            [field]: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
                          }))
                        }
                        placeholder="Ornek: GZM2631031"
                        pattern="[A-Z]{3}[0-9]{7}"
                        title="3 harf ve 7 rakam girin (Ornek: GZM2631031)"
                        required
                      />
                    ) : isEducationLikeModule && field === "duration" ? (
                      <select value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required>
                        <option value="" disabled>
                          Eğitim Süresi Seçin
                        </option>
                        {educationDurationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : isEducationCalendarModule && field === "calendarDate" ? (
                      <input
                        type="datetime-local"
                        value={toDatetimeLocalValue(form[field])}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        required
                      />
                    ) : (
                      <input value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required />
                    )
                  )}
                </label>
              ))}
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)} disabled={Boolean(examDocUploading)}>
                İptal
              </button>
              <button type="submit" className="btn" disabled={logoUploading || educationImageUploading || educationDocUploading || Boolean(examDocUploading)}>
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
            <div className={`admin-detail-grid ${isEducationLikeModule ? "admin-detail-grid-single" : ""}`}>
              {config.fields.map((field) => (
                <p key={field}>
                  <strong>{config.labels[field]}:</strong> {renderTableCellValue(field, detail[field], { rolesById, institutionsById, instructorsById: educationInstructorsById, educationsById })}
                </p>
              ))}
            </div>
            {isExamQuestionsModule && detail.generatedQuestions ? (
              renderExamQuestionPreview(detail.generatedQuestions, 60)
            ) : null}
            {isEducationLikeModule ? (
              <div>
                <h4>Word Icerigi</h4>
                {detail.contentHtml ? (
                  <div className="education-content-render" dangerouslySetInnerHTML={{ __html: detail.contentHtml }} />
                ) : (
                  <p>Icerik bulunamadi. Dosya yolu kaydedildi ama dosya okunamadi.</p>
                )}
              </div>
            ) : null}
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
                  data.deleteItem(moduleKey, deleting.id).then(loadRows);
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
