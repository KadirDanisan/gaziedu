import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { adminApi } from "../api";
import { normalizeEducationCode, parseEducationCode } from "../utils/educationCode";
import { lookupCodeMatches, normalizeLookupCode, parseApprovedEducationExcelBuffer } from "../utils/parseApprovedEducationExcel";

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
  educationCategories: {
    title: "Eğitim Kategorisi Listesi",
    fields: ["categoryCode", "categoryName"],
    labels: {
      categoryCode: "Eğitim Kategori Kodu",
      categoryName: "Eğitim Kategori Adı",
    },
  },
  approvedEducations: {
    title: "Onaylanmış Eğitim Listesi",
    fields: ["code", "name", "categoryId", "institutionId"],
    labels: {
      code: "Eğitim Kodu",
      name: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
      institutionId: "Kurum",
    },
  },
  educations: {
    title: "Eğitim Listesi",
    fields: ["code", "name", "categoryId", "institutionId", "instructorId", "description", "imageUrl", "duration", "contentDocPath"],
    labels: {
      code: "Eğitim Kodu (onaylı listeden)",
      name: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      description: "Açıklama",
      imageUrl: "Görsel URL",
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
    fields: ["educationName", "categoryId", "institutionId", "instructorId", "description", "imageUrl", "code", "duration", "contentDocPath", "calendarDate"],
    labels: {
      educationName: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
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
    fields: [
      "educationId",
      "instructorId",
      "examTargetDifficulty",
      "examQuestionCount",
      "poolQuestionCount",
      "topicDocPath",
      "questionsDocPath",
      "generatedQuestions",
    ],
    labels: {
      educationId: "Eğitim",
      instructorId: "Eğitmen",
      examTargetDifficulty: "Sınav zorluğu (havuz)",
      examQuestionCount: "Sınavdaki soru sayısı",
      poolQuestionCount: "Havuza alınacak soru sayısı (Word / AI)",
      topicDocPath: "Konu başlıklı Word (.docx)",
      questionsDocPath: "Hazır sorular Word (.docx)",
      generatedQuestions: "Hazırlanan sorular (5 şık: A–E)",
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
  if (field === "categoryId") return maps.educationCategoriesById?.[value]?.categoryName || value || "-";
  if (field === "institutionId") return maps.institutionsById?.[value]?.name || value || "-";
  if (field === "instructorId") {
    /** Eğitim / takvim / sınav soruları FK’si `instructors.id`; isim bootstrap `educationInstructors` listesinden gelir. */
    const instructor = maps.educationInstructorsById?.[value];
    if (!instructor) return value || "-";
    return instructor.fullName || `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim() || value || "-";
  }
  if (field === "educationId") return maps.educationsById?.[value]?.name || value || "-";
  if (field === "examTargetDifficulty") {
    const map = { easy: "Kolay", medium: "Orta", hard: "Zor" };
    return map[value] || value || "-";
  }
  if (field === "examQuestionCount" || field === "poolQuestionCount") {
    return value != null && value !== "" ? String(value) : "-";
  }
  if (field === "generatedQuestions") {
    const groups = value || {};
    const e = groups.easy?.length || 0;
    const m = groups.medium?.length || 0;
    const h = groups.hard?.length || 0;
    const total = e + m + h;
    if (!total) return "-";
    return `${total} soru (K:${e} O:${m} Z:${h})`;
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

const examDifficultySelectOptions = [
  { value: "easy", label: "Kolay" },
  { value: "medium", label: "Orta" },
  { value: "hard", label: "Zor" },
];

function formatExamPoolDurationHint(examQuestionCount) {
  const n = Math.min(200, Math.max(1, Number(examQuestionCount) || 20));
  const sec = n * 90;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const part = s ? `${m} dk ${s} sn` : `${m} dakika`;
  return `${part} (her soru 1 dk 30 sn)`;
}

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
  const [excelImportProgress, setExcelImportProgress] = useState(null);
  const [excelImportConflict, setExcelImportConflict] = useState(null);
  const excelImportChoiceRef = useRef(null);
  const approvedExcelInputRef = useRef(null);
  const isContactFormsModule = moduleKey === "contactForms";
  const isInstructorsModule = moduleKey === "instructors";
  const isEducationsModule = moduleKey === "educations";
  const isApprovedEducationsModule = moduleKey === "approvedEducations";
  const isEducationCalendarModule = moduleKey === "educationCalendar";
  const isEducationLikeModule = isEducationsModule || isEducationCalendarModule;
  const isExamQuestionsModule = moduleKey === "examQuestions";
  const isUserPasswordModule = moduleKey === "adminUsers" || moduleKey === "normalUsers";
  const roleOptions = [
    { code: "superadmin", label: "Süper Admin" },
    { code: "admin", label: "Admin" },
    { code: "egitmen", label: "Eğitmen" },
    { code: "yetkili", label: "Yetkili" },
  ];
  const rolesById = Object.fromEntries((data.roles || []).map((role) => [role.id, role]));
  const institutionsById = Object.fromEntries((data.institutions || []).map((institution) => [institution.id, institution]));
  const educationCategoriesById = Object.fromEntries((data.educationCategories || []).map((category) => [category.id, category]));
  const educationInstructorsById = Object.fromEntries((data.educationInstructors || []).map((instructor) => [instructor.id, instructor]));
  const educationsById = Object.fromEntries((data.educations || []).map((education) => [education.id, education]));
  const lockEducationFromApproved = isEducationsModule && Boolean(String(form._approvedEducationId || "").trim());
  const formFields = isContactFormsModule
    ? config.fields.filter((field) => field !== "createdAt" && field !== "isRead")
    : isApprovedEducationsModule
      ? config.fields
      : isEducationsModule
        ? config.fields
        : isInstructorsModule
          ? ["firstName", "lastName", "email", "password", "title", "department", "about"]
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
    data.loadBootstrap().catch(() => {});
  }, []);

  const openExamPortalForRow = async (row) => {
    const educationCode = String(educationsById?.[row.educationId]?.code || "").trim().toUpperCase();
    if (!educationCode) {
      setError("Bu sınav kaydı için eğitim kodu bulunamadı. Önce eğitim kaydında kod tanımlayın.");
      return;
    }
    setError("");
    try {
      const { path } = await adminApi.getExamPortalTestToken(educationCode);
      const url = `${window.location.origin}${path}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e?.message || "Sınav test bağlantısı oluşturulamadı.");
    }
  };

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
    if (isEducationsModule) {
      initialForm._approvedEducationId = "";
    }
    if (isExamQuestionsModule) {
      initialForm.examTargetDifficulty = "medium";
      initialForm.examQuestionCount = 20;
      initialForm.poolQuestionCount = 60;
    }
    setForm(initialForm);
  };

  const openEdit = (row) => {
    setEditing(row.id);
    setLogoUploading(false);
    setEducationImageUploading(false);
    setEducationDocUploading(false);
    setExamDocUploading("");
    const initial = config.fields.reduce((acc, key) => ({ ...acc, [key]: row[key] ?? "" }), {});
    if (isUserPasswordModule) initial.password = "";
    if (moduleKey === "educations") {
      const match = (data.approvedEducations || []).find(
        (a) => String(a.code || "").trim().toUpperCase() === String(row.code || "").trim().toUpperCase(),
      );
      initial._approvedEducationId = match?.id || "";
    }
    setForm(initial);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const payload = { ...form };
    if (isUserPasswordModule && editing !== "new" && !String(payload.password ?? "").trim()) {
      delete payload.password;
    }
    delete payload._approvedEducationId;
    if (isContactFormsModule) {
      delete payload.createdAt;
      if (editing === "new") {
        payload.isRead = false;
      }
    }
    if (isExamQuestionsModule) {
      const eq = Math.min(200, Math.max(1, parseInt(String(payload.examQuestionCount ?? "20"), 10) || 20));
      const pq = Math.min(300, Math.max(5, parseInt(String(payload.poolQuestionCount ?? "60"), 10) || 60));
      const d = String(payload.examTargetDifficulty || "medium").toLowerCase();
      payload.examQuestionCount = eq;
      payload.poolQuestionCount = pq;
      payload.examTargetDifficulty = ["easy", "medium", "hard"].includes(d) ? d : "medium";
    }
    if (editing === "new") await data.createItem(moduleKey, payload);
    else await data.updateItem(moduleKey, editing, payload);
    setEditing(null);
    await loadRows();
    if (moduleKey === "approvedEducations" || moduleKey === "educations") {
      await data.loadBootstrap().catch(() => {});
    }
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
      const result = await data.uploadExamDoc(file, mode, {
        targetDifficulty: String(form.examTargetDifficulty || "medium").toLowerCase(),
        poolQuestionCount: Math.min(300, Math.max(5, parseInt(String(form.poolQuestionCount ?? "60"), 10) || 60)),
      });
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

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const resolveExcelConflict = (decision) => {
    const cb = excelImportChoiceRef.current;
    excelImportChoiceRef.current = null;
    setExcelImportConflict(null);
    if (cb) cb(decision);
  };

  const runApprovedEducationExcelImport = async (file) => {
    if (!file) return;
    setError("");
    setExcelImportProgress({ status: "parsing", current: 0, total: 0, fileName: file.name });
    try {
      const buf = await file.arrayBuffer();
      const { rows, error: parseErr } = parseApprovedEducationExcelBuffer(buf);
      if (parseErr) {
        setError(parseErr);
        setExcelImportProgress(null);
        return;
      }
      if (!rows.length) {
        setError("İçe aktarılacak veri satırı bulunamadı (başlık altı boş veya tüm satırlar boş).");
        setExcelImportProgress(null);
        return;
      }

      const institutions = data.institutions || [];
      const categories = data.educationCategories || [];
      let workingApproved = [...(data.approvedEducations || [])];

      setExcelImportProgress({ status: "running", current: 0, total: rows.length, fileName: file.name });

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        setExcelImportProgress({ status: "running", current: i + 1, total: rows.length, fileName: file.name, lastCode: row.code });

        if (!row.code || !row.name) {
          setError(`Satır ${row.sheetRow}: KOD (GZM-1-32-03) ve EĞİTİM ADI dolu olmalıdır. İçe aktarma durduruldu.`);
          setExcelImportProgress(null);
          return;
        }

        const parsedCode = parseEducationCode(row.code);
        if (!parsedCode.ok) {
          setError(`Satır ${row.sheetRow}: ${parsedCode.error} İçe aktarma durduruldu.`);
          setExcelImportProgress(null);
          return;
        }

        const institution = institutions.find((it) => lookupCodeMatches(it.code, row.institutionCode));
        if (!institution) {
          setError(
            `Satır ${row.sheetRow}: Kurum kodu sistemde yok: "${row.institutionCode}". Kurum listesinde bu kodu tanımlayın. İçe aktarma durduruldu.`,
          );
          setExcelImportProgress(null);
          return;
        }

        const category = categories.find((c) => lookupCodeMatches(c.categoryCode, row.categoryCode));
        if (!category) {
          setError(
            `Satır ${row.sheetRow}: Eğitim kategori kodu sistemde yok: "${row.categoryCode}". Kategori listesinde bu kodu tanımlayın. İçe aktarma durduruldu.`,
          );
          setExcelImportProgress(null);
          return;
        }

        const existing = workingApproved.find((a) => normalizeLookupCode(a.code) === normalizeLookupCode(row.code));
        if (existing) {
          const decision = await new Promise((resolve) => {
            excelImportChoiceRef.current = resolve;
            setExcelImportConflict({
              sheetRow: row.sheetRow,
              code: row.code,
              name: row.name,
              institutionCode: row.institutionCode,
              categoryCode: row.categoryCode,
              existingId: existing.id,
              existingName: existing.name,
            });
          });

          if (decision === "cancel") {
            setExcelImportProgress(null);
            return;
          }
          if (decision === "skip") {
            await waitMs(80);
            continue;
          }
          if (decision === "replace") {
            await data.deleteItem("approvedEducations", existing.id);
            workingApproved = workingApproved.filter((a) => a.id !== existing.id);
            await waitMs(120);
          }
        }

        const created = await data.createItem("approvedEducations", {
          code: parsedCode.code,
          name: String(row.name).trim(),
          categoryId: category.id,
          institutionId: institution.id,
        });
        if (created?.id) {
          workingApproved = [...workingApproved, created];
        }
        await waitMs(150);
      }

      await data.loadBootstrap().catch(() => {});
      await loadRows();
      setExcelImportProgress({ status: "done", current: rows.length, total: rows.length, fileName: file.name });
      window.setTimeout(() => setExcelImportProgress(null), 2800);
    } catch (err) {
      setError(err?.message || "Excel içe aktarma hatası.");
      setExcelImportProgress(null);
    }
  };

  const handleApprovedExcelInputChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isApprovedEducationsModule) return;
    await runApprovedEducationExcelImport(file);
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>{config.title}</h2>
          <p>Eğitim, Kurum, Eğitmen, Bülten, İletişim Formu, Sınav Soruları ve daha fazlasını yönetin.</p>
        </div>
        {hasPermission(moduleKey, "canCreate") && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn" onClick={openCreate}>
              Ekle
            </button>
            {isApprovedEducationsModule ? (
              <>
                <input
                  ref={approvedExcelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                  tabIndex={-1}
                  aria-hidden
                  onChange={handleApprovedExcelInputChange}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  title="Zorunlu sütunlar: KOD (ör. GZM-1-32-03) ve EĞİTİM ADI. Kurum ve kategori kodu KOD içinden okunur."
                  onClick={() => approvedExcelInputRef.current?.click()}
                >
                  Excel ile toplu ekle
                </button>
              </>
            ) : null}
          </div>
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
                    <td key={field}>{renderTableCellValue(field, row[field], { rolesById, educationCategoriesById, institutionsById, educationInstructorsById, educationsById })}</td>
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
                      {isExamQuestionsModule && (
                        <button type="button" className="btn btn-outline" onClick={() => openExamPortalForRow(row)}>
                          Sınav Portalını Test Et
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
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !examDocUploading && !logoUploading && !educationImageUploading && !educationDocUploading) setEditing(null);
          }}
        >
          <form
            className={`admin-modal admin-modal--form ${isEducationLikeModule || isExamQuestionsModule ? "admin-modal-scrollable admin-modal-education admin-modal--form-wide" : ""}`}
            onSubmit={submitForm}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">{config.title}</p>
                <h3 className="admin-modal__title">{editing === "new" ? "Yeni kayıt" : "Kaydı düzenle"}</h3>
                <p className="admin-modal__subtitle">
                  Alanları doldurun; dosya yükleme adımlarında pencereyi kapatmadan bekleyin.
                </p>
              </div>
              <button
                type="button"
                className="admin-modal__close"
                onClick={() => setEditing(null)}
                disabled={
                  Boolean(examDocUploading) || logoUploading || educationImageUploading || educationDocUploading
                }
                aria-label="Kapat"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>

            <div className="admin-modal__body">
              <div className={`admin-form-grid ${isEducationLikeModule || isExamQuestionsModule ? "admin-form-grid-single admin-form-grid--premium" : "admin-form-grid--premium"}`}>
              {formFields.map((field) => (
                <label key={field} className="admin-field">
                  <span className="admin-field__label">{config.labels[field]}</span>
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
                  ) : isExamQuestionsModule && field === "examTargetDifficulty" ? (
                    <select
                      value={form[field] ?? "medium"}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                    >
                      {examDifficultySelectOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : isExamQuestionsModule && field === "examQuestionCount" ? (
                    <div className="admin-field-stack">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                      />
                      <small style={{ opacity: 0.85 }}>
                        Öğrenci sınavında gösterilecek soru sayısı. Tahmini süre: {formatExamPoolDurationHint(form.examQuestionCount)}
                      </small>
                    </div>
                  ) : isExamQuestionsModule && field === "poolQuestionCount" ? (
                    <div className="admin-field-stack">
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                      />
                      <small style={{ opacity: 0.85 }}>
                        Word dosyasından AI ile üretilecek veya sınıflandırılacak toplam havuz soru sayısı. Konu veya hazır soru
                        dosyasını yüklemeden önce bu değeri ayarlayın.
                      </small>
                    </div>
                  ) : isExamQuestionsModule && field === "topicDocPath" ? (
                    <div className="admin-field-stack">
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(event) => handleExamDocUpload(event.target.files?.[0], "generate")}
                        disabled={Boolean(examDocUploading)}
                      />
                      <input value={form[field] ?? ""} readOnly placeholder="Konu dosyası yolu (.docx)" />
                    </div>
                  ) : isExamQuestionsModule && field === "questionsDocPath" ? (
                    <div className="admin-field-stack">
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(event) => handleExamDocUpload(event.target.files?.[0], "classify")}
                        disabled={Boolean(examDocUploading)}
                      />
                      <input value={form[field] ?? ""} readOnly placeholder="Hazır sorular dosya yolu (.docx)" />
                    </div>
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
                    <div className="admin-field-stack">
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
                    </div>
                  ) : isEducationLikeModule && field === "imageUrl" ? (
                    <div className="admin-field-stack">
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
                    </div>
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
                    ) : (isEducationLikeModule || isApprovedEducationsModule) && field === "categoryId" ? (
                      <select
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        required
                        disabled={lockEducationFromApproved}
                      >
                        <option value="" disabled>
                          Eğitim Kategorisi Seçin
                        </option>
                        {(data.educationCategories || []).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.categoryName}
                          </option>
                        ))}
                      </select>
                    ) : (isEducationLikeModule || isApprovedEducationsModule) && field === "institutionId" ? (
                      <select
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        required
                        disabled={lockEducationFromApproved}
                      >
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
                      <div className="admin-field-stack">
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
                      </div>
                    ) : isEducationsModule && field === "name" ? (
                      <input
                        type="text"
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        readOnly={lockEducationFromApproved}
                        required
                      />
                    ) : isEducationLikeModule && field === "description" ? (
                      <textarea
                        rows={4}
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        required
                      />
                    ) : isEducationsModule && field === "code" ? (
                      <select
                        value={String(form._approvedEducationId ?? "")}
                        onChange={(event) => {
                          const pickId = event.target.value;
                          if (!pickId) {
                            setForm((prev) => ({
                              ...prev,
                              _approvedEducationId: "",
                              code: "",
                              name: "",
                              categoryId: "",
                              institutionId: "",
                            }));
                            return;
                          }
                          const picked = (data.approvedEducations || []).find((item) => item.id === pickId);
                          if (!picked) return;
                          setForm((prev) => ({
                            ...prev,
                            _approvedEducationId: pickId,
                            code: String(picked.code || "").trim(),
                            name: String(picked.name || "").trim(),
                            categoryId: picked.categoryId || "",
                            institutionId: picked.institutionId || "",
                          }));
                        }}
                        required
                      >
                        <option value="" disabled>
                          {editing === "new" ? "Onaylanmış eğitim seçin" : "Onaylı listeden seçin veya aynı kaydı koruyun"}
                        </option>
                        {(data.approvedEducations || []).map((row) => (
                          <option key={row.id} value={row.id}>
                            {String(row.code || "").trim()} — {row.name || ""}
                          </option>
                        ))}
                      </select>
                    ) : (isApprovedEducationsModule || isEducationCalendarModule) && field === "code" ? (
                      <input
                        type="text"
                        value={form[field] ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            [field]: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                          }))
                        }
                        onBlur={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            [field]: normalizeEducationCode(event.target.value),
                          }))
                        }
                        placeholder="Örnek: GZM-1-32-03"
                        pattern="[A-Z]{3}-[0-9]+-[0-9]+-[0-9]+"
                        title="Önek-Kurum-Kategori-Sıra (Örnek: GZM-1-32-03)"
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
                    ) : isUserPasswordModule || isInstructorsModule ? (
                      field === "password" ? (
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        placeholder={
                          editing === "new"
                            ? ""
                            : "**********"
                        }
                        required={editing === "new"}
                      />
                      ) : (
                      <input value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required />
                      )
                    ) : (
                      <input value={form[field] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required />
                    )
                  )}
                </label>
              ))}
              </div>
            </div>

            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => setEditing(null)} disabled={Boolean(examDocUploading)}>
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn btn--modal-primary"
                  disabled={
                    logoUploading || educationImageUploading || educationDocUploading || Boolean(examDocUploading)
                  }
                >
                  Kaydet
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {detail && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="admin-modal admin-modal--detail" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">{config.title}</p>
                <h3 id="admin-detail-title" className="admin-modal__title">
                  Kayıt detayı
                </h3>
                <p className="admin-modal__subtitle">Salt okunur görünüm. Word içeriği varsa aşağıda listelenir.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => setDetail(null)} aria-label="Kapat">
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>

            <div className="admin-modal__body">
              <div className={`admin-detail-sheet ${isEducationLikeModule || isExamQuestionsModule ? "admin-detail-sheet--single" : ""}`}>
                {config.fields.map((field) => (
                  <div key={field} className="admin-detail-sheet__row">
                    <span className="admin-detail-sheet__label">{config.labels[field]}</span>
                    <span className="admin-detail-sheet__value">
                      {renderTableCellValue(field, detail[field], {
                        rolesById,
                        educationCategoriesById,
                        institutionsById,
                        educationInstructorsById,
                        educationsById,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {isExamQuestionsModule && detail.generatedQuestions ? (
                <div className="admin-modal-panel">
                  <h4 className="admin-modal-panel__title">Hazırlanan sorular</h4>
                  {renderExamQuestionPreview(detail.generatedQuestions, 60)}
                </div>
              ) : null}

              {isEducationLikeModule ? (
                <div className="admin-modal-panel">
                  <h4 className="admin-modal-panel__title">Word içeriği</h4>
                  {detail.contentHtml ? (
                    <div className="education-content-render" dangerouslySetInnerHTML={{ __html: detail.contentHtml }} />
                  ) : (
                    <p className="admin-modal-panel__empty">
                      İçerik bulunamadı. Dosya yolu kaydedildi ancak dosya okunamadı.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <footer className="admin-modal__footer admin-modal__footer--detail">
              <button type="button" className="btn btn--modal-primary" onClick={() => setDetail(null)}>
                Kapat
              </button>
            </footer>
          </div>
        </div>
      )}

      {deleting && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="admin-modal admin-modal--confirm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={28} height={28}>
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
                </svg>
              </div>
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Silme onayı</h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  Bu kayıt kalıcı olarak silinecek. Bu işlem geri alınamaz.
                </p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => setDeleting(null)} aria-label="Vazgeç">
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => setDeleting(null)}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--danger-fill"
                  onClick={() => {
                    data
                      .deleteItem(moduleKey, deleting.id)
                      .then(loadRows)
                      .then(() => {
                        if (moduleKey === "approvedEducations" || moduleKey === "educations") {
                          return data.loadBootstrap().catch(() => {});
                        }
                        return undefined;
                      });
                    setDeleting(null);
                  }}
                >
                  Evet, sil
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {excelImportProgress ? (
        <div className="admin-modal-backdrop" role="presentation" style={{ pointerEvents: excelImportConflict ? "none" : "auto" }}>
          <div className="admin-modal admin-modal--detail" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal__body">
              <h3 style={{ marginTop: 0 }}>Excel içe aktarma</h3>
              <p style={{ marginBottom: 8, color: "#4b5565" }}>
                {excelImportProgress.status === "parsing" ? "Dosya okunuyor…" : null}
                {excelImportProgress.status === "running"
                  ? `Satırlar sırayla işleniyor (${excelImportProgress.current} / ${excelImportProgress.total})`
                  : null}
                {excelImportProgress.status === "done" ? "Tüm satırlar tamamlandı." : null}
              </p>
              {excelImportProgress.fileName ? (
                <p style={{ fontSize: "0.9rem", color: "#647086" }}>
                  Dosya: <strong>{excelImportProgress.fileName}</strong>
                  {excelImportProgress.lastCode ? (
                    <>
                      <br />
                      Son işlenen kod: <strong>{excelImportProgress.lastCode}</strong>
                    </>
                  ) : null}
                </p>
              ) : null}
              {excelImportProgress.status === "running" ? (
                <p style={{ fontSize: "0.85rem", color: "#647086" }}>Kurum ve kategori kodları sistemdeki kayıtlarla eşleştirilir; her satır arasında kısa bekleme vardır.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {excelImportConflict && (
        <div className="admin-modal-backdrop admin-modal-backdrop--excel-conflict" role="presentation">
          <div className="admin-modal admin-modal--confirm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">Çakışan eğitim kodu</p>
                <h3 className="admin-modal__title">Excel satır {excelImportConflict.sheetRow}</h3>
                <p className="admin-modal__subtitle" style={{ lineHeight: 1.55 }}>
                  <strong>{excelImportConflict.code}</strong> kodu listede zaten var
                  {excelImportConflict.existingName ? ` (“${excelImportConflict.existingName}”)` : ""}. Yeni satırdaki veri:{" "}
                  <strong>{excelImportConflict.name}</strong>
                  {excelImportConflict.institutionCode || excelImportConflict.categoryCode
                    ? ` — Kurum: ${excelImportConflict.institutionCode}, Kategori: ${excelImportConflict.categoryCode}`
                    : null}
                  .
                  <br />
                  <br />
                  Yeni kaydı yüklemek için mevcut kayıt silinir. Eski kayıt kalsın derseniz bu satır atlanır ve sıradaki eğitim koduna geçilir.
                </p>
              </div>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch" style={{ flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="btn btn--danger-fill" onClick={() => resolveExcelConflict("replace")}>
                  Değiştir (eskiyi sil, yeniyi yükle)
                </button>
                <button type="button" className="btn btn-outline" onClick={() => resolveExcelConflict("skip")}>
                  Eski kalsın (bu satırı atla)
                </button>
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => resolveExcelConflict("cancel")}>
                  Tüm içe aktarmayı iptal et
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

    </section>
  );
}
