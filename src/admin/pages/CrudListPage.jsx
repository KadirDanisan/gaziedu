import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminData } from "../context/AdminDataContext";
import { adminApi } from "../api";
import {
  BulletListEditor,
  EducationModulesEditor,
  renderBulletPreview,
  renderModuleResourcesPreview,
} from "../components/EducationContentFields";
import { normalizeEducationCode, parseEducationCode } from "../utils/educationCode";
import { lookupCodeMatches, normalizeLookupCode, parseApprovedEducationExcelBuffer } from "../utils/parseApprovedEducationExcel";
import { parseBulkUsersExcelBuffer } from "../utils/parseBulkUsersExcel";
import { downloadBlob } from "../utils/downloadBlob";
import { DEFAULT_SALES_FILTER, SALES_FILTERS, normalizeSalesFilter, salesFilterLabel, salesFilterRequiresInstitution } from "../../constants/salesFilters";

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
    fields: ["code", "name", "categoryId", "salesFilter", "institutionId"],
    labels: {
      code: "Eğitim Kodu",
      name: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
      salesFilter: "Satış Filtresi",
      institutionId: "Kurum",
    },
  },
  educations: {
    title: "Eğitim Listesi",
    fields: ["code", "name", "categoryId", "salesFilter", "institutionId", "instructorId", "description", "content", "topicHeadings", "imageUrl", "promoVideoPath", "promoVideoUrl", "price", "hasDiscount", "discountRate", "duration"],
    labels: {
      code: "Eğitim Kodu (onaylı listeden)",
      name: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
      salesFilter: "Satış Filtresi (onaylı listeden)",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      description: "Açıklama",
      content: "Eğitim İçeriği",
      topicHeadings: "Konu Başlıkları",
      imageUrl: "Görsel URL",
      promoVideoPath: "Tanıtım Videosu",
      promoVideoUrl: "Tanıtım Videosu (harici bağlantı)",
      price: "Ücret (TL)",
      hasDiscount: "İndirim mevcut mu",
      discountRate: "İndirim oranı (%)",
      duration: "Eğitim Saati",
    },
  },
  instructors: {
    title: "Eğitmen Listesi",
    fields: ["firstName", "lastName", "email", "title", "department", "about", "imageUrl"],
    labels: {
      firstName: "Ad",
      lastName: "Soyad",
      email: "E-Posta",
      title: "Ünvan",
      department: "Bölüm",
      about: "Hakkında",
      imageUrl: "Eğitmen Görseli",
    },
  },
  educationCalendar: {
    title: "Eğitim Takvimi Listesi",
    fields: ["educationName", "categoryId", "institutionId", "instructorId", "description", "content", "topicHeadings", "imageUrl", "code", "duration", "calendarDate"],
    labels: {
      educationName: "Eğitim Adı",
      categoryId: "Eğitim Kategorisi",
      institutionId: "Kurum",
      instructorId: "Eğitmen",
      imageUrl: "Görsel URL",
      description: "Açıklama",
      content: "Eğitim İçeriği",
      topicHeadings: "Konu Başlıkları",
      code: "Eğitim Kodu",
      duration: "Eğitim Saati",
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
      "questionsDocPath",
      "generatedQuestions",
    ],
    labels: {
      educationId: "Eğitim",
      instructorId: "Eğitmen",
      questionsDocPath: "Soru tablosu Word (.docx)",
      generatedQuestions: "Word dosyasından okunan sorular",
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
  if (field === "salesFilter") return salesFilterLabel(value) || value || "-";
  if (field === "price") {
    if (value == null || value === "") return "-";
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString("tr-TR")} TL` : String(value);
  }
  if (field === "hasDiscount") return value === true || value === "true" || value === 1 || value === "1" ? "Evet" : "Hayır";
  if (field === "discountRate") {
    if (value == null || value === "") return "-";
    return `%${value}`;
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
  if (field === "content") {
    const text = String(value || "").trim();
    if (!text) return "-";
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }
  if (field === "topicHeadings") {
    const count = Array.isArray(value) ? value.length : 0;
    return count ? `${count} madde` : "-";
  }
  if (field === "generatedQuestions") {
    const groups = value || {};
    const e = groups.easy?.length || 0;
    const m = groups.medium?.length || 0;
    const h = groups.hard?.length || 0;
    const total = e + m + h;
    return total ? `${total} soru` : "-";
  }
  return renderFieldValue(field, value);
};

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const getExamQuestions = (groups = {}) =>
  ["easy", "medium", "hard"].flatMap((key) => (Array.isArray(groups?.[key]) ? groups[key] : []));

const renderExamQuestionPreview = (questions = {}, limit = 20) => {
  const items = getExamQuestions(questions);
  return (
    <div className="exam-question-preview">
      <h4>Toplam {items.length} soru</h4>
      {items.slice(0, limit).map((question, index) => (
        <article className="exam-question-card" key={`q-${index}`}>
          <strong>{index + 1}. {question.question}</strong>
          {Array.isArray(question.options) && question.options.length ? (
            <ol type="A">
              {question.options.map((option, optionIndex) => (
                <li key={`${index}-${optionIndex}`}>{option}</li>
              ))}
            </ol>
          ) : null}
          {question.correctAnswer ? <small>Doğru Cevap: {question.correctAnswer}</small> : null}
        </article>
      ))}
      {items.length > limit ? <small>İlk {limit} soru gösteriliyor.</small> : null}
    </div>
  );
};

export default function CrudListPage({ moduleKey }) {
  const { hasPermission } = useAdminAuth();
  const data = useAdminData();
  const config = moduleConfig[moduleKey];
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [readStatusFilter, setReadStatusFilter] = useState("all");
  const [salesFilterTab, setSalesFilterTab] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailModules, setDetailModules] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [educationImageUploading, setEducationImageUploading] = useState(false);
  const [promoVideoUploading, setPromoVideoUploading] = useState(false);
  const [examDocUploading, setExamDocUploading] = useState("");
  const [excelImportProgress, setExcelImportProgress] = useState(null);
  const [excelImportConflict, setExcelImportConflict] = useState(null);
  const excelImportChoiceRef = useRef(null);
  const approvedExcelInputRef = useRef(null);
  const [bulkUsers, setBulkUsers] = useState(null);
  const bulkUsersInputRef = useRef(null);
  const isNormalUsersModule = moduleKey === "normalUsers";
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
    { code: "yetkili", label: "Sertifika Yetkilisi" },
  ];
  const rolesById = Object.fromEntries((data.roles || []).map((role) => [role.id, role]));
  const institutionsById = Object.fromEntries((data.institutions || []).map((institution) => [institution.id, institution]));
  const educationCategoriesById = Object.fromEntries((data.educationCategories || []).map((category) => [category.id, category]));
  const educationInstructorsById = Object.fromEntries((data.educationInstructors || []).map((instructor) => [instructor.id, instructor]));
  const educationsById = Object.fromEntries((data.educations || []).map((education) => [education.id, education]));
  const lockEducationFromApproved = isEducationsModule && Boolean(String(form._approvedEducationId || "").trim());
  const isSalesFilterModule = isApprovedEducationsModule || isEducationsModule;
  const formNeedsInstitution = salesFilterRequiresInstitution(form.salesFilter);
  const formIsPaidGuzem = isEducationsModule && normalizeSalesFilter(form.salesFilter) === "guzem-ucretli";
  const formFields = isContactFormsModule
    ? config.fields.filter((field) => field !== "createdAt" && field !== "isRead")
    : isSalesFilterModule
      ? config.fields.filter((field) => {
          if (field === "institutionId" && !formNeedsInstitution) return false;
          if (isEducationsModule && ["price", "hasDiscount", "discountRate"].includes(field) && !formIsPaidGuzem) {
            return false;
          }
          if (field === "discountRate" && formIsPaidGuzem && !(form.hasDiscount === true || form.hasDiscount === "true" || form.hasDiscount === "1")) {
            return false;
          }
          return true;
        })
      : isInstructorsModule
        ? ["firstName", "lastName", "email", "password", "title", "department", "about", "imageUrl"]
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
        isSalesFilterModule ? salesFilterTab : "",
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
  }, [moduleKey, page, search, readStatusFilter, salesFilterTab]);

  useEffect(() => {
    setSalesFilterTab("");
  }, [moduleKey]);

  useEffect(() => {
    data.loadFormOptionsForModule(moduleKey).catch(() => {});
  }, [moduleKey, data.loadFormOptionsForModule]);

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

  const openDetail = async (row) => {
    setDetail(row);
    if (isEducationsModule && row?.id) {
      try {
        const res = await adminApi.getEducationModules(row.id);
        setDetailModules(res.data || []);
      } catch {
        setDetailModules([]);
      }
    } else {
      setDetailModules([]);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailModules([]);
  };

  const openCreate = () => {
    setEditing("new");
    setLogoUploading(false);
    setEducationImageUploading(false);
    setPromoVideoUploading(false);
    setExamDocUploading("");
    const initialForm = formFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
    if (isContactFormsModule) {
      initialForm.isRead = false;
    }
    if (isApprovedEducationsModule) {
      initialForm.salesFilter = salesFilterTab || "";
    }
    if (isEducationsModule) {
      initialForm._approvedEducationId = "";
      initialForm.salesFilter = "";
      initialForm.topicHeadings = [];
      initialForm.modules = [];
      initialForm.price = "";
      initialForm.hasDiscount = false;
      initialForm.discountRate = "";
    }
    if (isEducationCalendarModule) {
      initialForm.topicHeadings = [];
    }
    setForm(initialForm);
  };

  const openEdit = async (row) => {
    setEditing(row.id);
    setLogoUploading(false);
    setEducationImageUploading(false);
    setPromoVideoUploading(false);
    setExamDocUploading("");
    const initial = config.fields.reduce((acc, key) => ({ ...acc, [key]: row[key] ?? "" }), {});
    if (isUserPasswordModule) initial.password = "";
    if (isEducationsModule) {
      const match = (data.approvedEducations || []).find(
        (a) => String(a.code || "").trim().toUpperCase() === String(row.code || "").trim().toUpperCase(),
      );
      initial._approvedEducationId = match?.id || "";
      initial.salesFilter = row.salesFilter || match?.salesFilter || "";
      initial.topicHeadings = Array.isArray(row.topicHeadings) ? row.topicHeadings : [];
      initial.price = row.price != null && row.price !== "" ? String(row.price) : "";
      initial.hasDiscount = Boolean(row.hasDiscount);
      initial.discountRate = row.discountRate != null && row.discountRate !== "" ? String(row.discountRate) : "";
      initial.modules = [];
      try {
        const res = await adminApi.getEducationModules(row.id);
        initial.modules = res.data || [];
      } catch {
        initial.modules = [];
      }
    }
    if (isEducationCalendarModule) {
      initial.topicHeadings = Array.isArray(row.topicHeadings) ? row.topicHeadings : [];
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
    if (isSalesFilterModule && !formNeedsInstitution) {
      payload.institutionId = null;
    }
    if (isEducationsModule) {
      payload.modules = Array.isArray(form.modules) ? form.modules : [];
      payload.topicHeadings = Array.isArray(form.topicHeadings) ? form.topicHeadings : [];
      if (normalizeSalesFilter(form.salesFilter) === "guzem-ucretli") {
        payload.hasDiscount = form.hasDiscount === true || form.hasDiscount === "true" || form.hasDiscount === "1";
        if (!payload.hasDiscount) payload.discountRate = null;
      } else {
        payload.price = null;
        payload.hasDiscount = false;
        payload.discountRate = null;
      }
    } else {
      delete payload.modules;
    }
    if (isEducationCalendarModule) {
      payload.topicHeadings = Array.isArray(form.topicHeadings) ? form.topicHeadings : [];
    }
    if (isContactFormsModule) {
      delete payload.createdAt;
      if (editing === "new") {
        payload.isRead = false;
      }
    }
    if (isExamQuestionsModule) {
      const questionCount = getExamQuestions(payload.generatedQuestions).length;
      if (!questionCount) {
        setError("Kaydetmeden önce geçerli soru tablosu içeren bir Word dosyası yükleyin.");
        return;
      }
      payload.examTargetDifficulty = "medium";
      payload.examQuestionCount = 20;
      payload.poolQuestionCount = questionCount;
    }
    if (editing === "new") await data.createItem(moduleKey, payload);
    else await data.updateItem(moduleKey, editing, payload);
    setEditing(null);
    await loadRows();
    if (moduleKey === "approvedEducations" || moduleKey === "educations") {
      await data.loadFormOptions({ force: true }).catch(() => {});
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

  const handlePromoVideoUpload = async (file) => {
    if (!file) return;
    setPromoVideoUploading(true);
    setError("");
    try {
      const result = await data.uploadEducationModuleVideo(file);
      const uploadedPath = result?.path || "";
      setForm((prev) => ({ ...prev, promoVideoPath: uploadedPath }));
      if (!uploadedPath) {
        setError("Video yüklendi ancak yol alınamadı. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPromoVideoUploading(false);
    }
  };

  const handleExamDocUpload = async (file) => {
    if (!file) return;
    setExamDocUploading("table");
    setError("");
    try {
      const result = await data.uploadExamDoc(file);
      setForm((prev) => ({
        ...prev,
        questionsDocPath: result.path || "",
        questionsDocName: result.fileName || file.name,
        generatedQuestions: result.questions || prev.generatedQuestions || {},
        examTargetDifficulty: "medium",
        examQuestionCount: 20,
        poolQuestionCount: result.questionCount || 0,
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
          salesFilter: salesFilterTab || DEFAULT_SALES_FILTER,
          institutionId: institution.id,
        });
        if (created?.id) {
          workingApproved = [...workingApproved, created];
        }
        await waitMs(150);
      }

      await data.loadFormOptions({ force: true }).catch(() => {});
      await loadRows();
      setExcelImportProgress({ status: "done", current: rows.length, total: rows.length, fileName: file.name });
      window.setTimeout(() => setExcelImportProgress(null), 2800);
    } catch (err) {
      setError(err?.message || "Excel içe aktarma hatası.");
      setExcelImportProgress(null);
    }
  };

  const BULK_USERS_CHUNK_SIZE = 50;

  const openBulkUsers = () => {
    setBulkUsers({ step: "select", fileName: "", rows: [], error: "", processed: 0, results: [] });
  };

  const closeBulkUsers = () => {
    if (bulkUsers?.step === "uploading") return;
    setBulkUsers(null);
  };

  const downloadBulkUsersTemplate = async () => {
    try {
      downloadBlob(await adminApi.downloadNormalUsersBulkTemplate(), "TopluKullaniciEkleme.xlsx");
    } catch (err) {
      setBulkUsers((prev) => (prev ? { ...prev, error: err?.message || "Şablon indirilemedi." } : prev));
    }
  };

  const handleBulkUsersFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { rows: parsedRows, error: parseErr } = parseBulkUsersExcelBuffer(await file.arrayBuffer());
    if (parseErr) {
      setBulkUsers((prev) => ({ ...prev, step: "select", fileName: file.name, rows: [], error: parseErr }));
      return;
    }
    if (!parsedRows.length) {
      setBulkUsers((prev) => ({ ...prev, step: "select", fileName: file.name, rows: [], error: "Excel'de başlık altında dolu satır bulunamadı." }));
      return;
    }
    setBulkUsers((prev) => ({ ...prev, step: "ready", fileName: file.name, rows: parsedRows, error: "", processed: 0, results: [] }));
  };

  const runBulkUsersImport = async () => {
    const allRows = bulkUsers?.rows || [];
    if (!allRows.length) return;
    setBulkUsers((prev) => ({ ...prev, step: "uploading", processed: 0, results: [], error: "" }));
    const collected = [];
    try {
      for (let i = 0; i < allRows.length; i += BULK_USERS_CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + BULK_USERS_CHUNK_SIZE);
        const response = await adminApi.bulkImportNormalUsers(chunk);
        collected.push(...(response?.results || []));
        setBulkUsers((prev) => ({ ...prev, processed: Math.min(allRows.length, i + chunk.length), results: [...collected] }));
      }
      setBulkUsers((prev) => ({ ...prev, step: "done", results: collected }));
    } catch (err) {
      setBulkUsers((prev) => ({ ...prev, step: "done", results: collected, error: err?.message || "Toplu yükleme sırasında hata oluştu." }));
    }
    await loadRows();
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
          <h2>{isSalesFilterModule && salesFilterTab ? salesFilterLabel(salesFilterTab) : config.title}</h2>
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
            {isNormalUsersModule ? (
              <button type="button" className="btn btn-outline" onClick={openBulkUsers}>
                Toplu Ekle
              </button>
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

      {isSalesFilterModule && (
        <div className="admin-filter-chips" role="group" aria-label="Satış filtresi">
          <button
            type="button"
            className={`admin-filter-chip${salesFilterTab === "" ? " is-active" : ""}`}
            onClick={() => {
              setPage(1);
              setSalesFilterTab("");
            }}
          >
            Tümü
          </button>
          {SALES_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`admin-filter-chip${salesFilterTab === option.key ? " is-active" : ""}`}
              onClick={() => {
                setPage(1);
                setSalesFilterTab(option.key);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

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
                      <button type="button" onClick={() => openDetail(row)}>
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
            if (e.target === e.currentTarget && !examDocUploading && !logoUploading && !educationImageUploading) setEditing(null);
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
                  Boolean(examDocUploading) || logoUploading || educationImageUploading
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
              {formFields
                .filter((field) => !(field === "promoVideoUrl" && isEducationsModule))
                .map((field) => (
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
                  ) : isExamQuestionsModule && field === "questionsDocPath" ? (
                    <div className="admin-field-stack">
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(event) => handleExamDocUpload(event.target.files?.[0])}
                        disabled={Boolean(examDocUploading)}
                      />
                      <input value={form[field] ?? ""} readOnly placeholder="Soru tablosu dosya yolu (.docx)" />
                      <small style={{ opacity: 0.85 }}>
                        Word tablosu 8 sütun olmalıdır (Modül, Soru Kökü, A–E şıkları, Doğru Cevap).
                        Modül sütunu yok sayılır; her satırdan yalnızca soru kökü, şıklar ve doğru cevap okunur.
                      </small>
                    </div>
                  ) : isExamQuestionsModule && field === "generatedQuestions" ? (
                    <>
                      {examDocUploading ? (
                        <div className="exam-doc-loading">
                          <strong>Sorular okunuyor...</strong>
                          <span>Word tablosundaki satırlar ve sütunlar doğrulanıyor.</span>
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
                  ) : isInstructorsModule && field === "imageUrl" ? (
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
                      />
                      {educationImageUploading ? <small>Görsel yükleniyor...</small> : null}
                    </div>
                  ) : isEducationsModule && field === "promoVideoPath" ? (
                    <div className="admin-field-stack">
                      <input
                        type="text"
                        value={form.promoVideoUrl ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, promoVideoUrl: event.target.value }))}
                        placeholder="YouTube / Vimeo bağlantısı veya .mp4 adresi"
                      />
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(event) => handlePromoVideoUpload(event.target.files?.[0])}
                        disabled={promoVideoUploading}
                      />
                      {promoVideoUploading ? (
                        <small>Video yükleniyor ve web için optimize ediliyor (faststart), pencereyi kapatmayın...</small>
                      ) : null}
                      <input
                        value={form.promoVideoPath ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, promoVideoPath: event.target.value }))}
                        placeholder="Yüklenen tanıtım videosu yolu"
                      />
                      {form.promoVideoPath ? (
                        <button
                          type="button"
                          className="admin-resource-card__unlink"
                          onClick={() => setForm((prev) => ({ ...prev, promoVideoPath: "" }))}
                        >
                          Yüklenen videoyu kaldır
                        </button>
                      ) : null}
                      <small style={{ opacity: 0.85 }}>
                        Yüklenen dosya varsa o oynatılır; yoksa bağlantı kullanılır. En fazla 2 GB.
                      </small>
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
                    ) : isSalesFilterModule && field === "salesFilter" ? (
                      <div className="admin-field-stack">
                        <select
                          value={form[field] ?? ""}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              salesFilter: event.target.value,
                              institutionId: salesFilterRequiresInstitution(event.target.value) ? prev.institutionId : "",
                            }))
                          }
                          required
                          disabled={isEducationsModule}
                        >
                          <option value="" disabled>
                            Satış Filtresi Seçin
                          </option>
                          {SALES_FILTERS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <small style={{ opacity: 0.85 }}>
                          {isEducationsModule
                            ? "Onaylanmış eğitim seçildiğinde otomatik gelir."
                            : "Kurum seçimi yalnızca “İş Birliği ve Sertifika Programları” türünde istenir."}
                        </small>
                      </div>
                    ) : isEducationsModule && field === "price" ? (
                      <div className="admin-field-stack">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price ?? ""}
                          onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                          placeholder="Örn. 2500"
                          required
                        />
                        <small style={{ opacity: 0.85 }}>Kayıt ücreti (TL). Başvuru formunda gösterilir.</small>
                      </div>
                    ) : isEducationsModule && field === "hasDiscount" ? (
                      <div className="admin-field-stack">
                        <select
                          value={form.hasDiscount === true || form.hasDiscount === "true" || form.hasDiscount === "1" ? "true" : "false"}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              hasDiscount: event.target.value === "true",
                              discountRate: event.target.value === "true" ? prev.discountRate : "",
                            }))
                          }
                          required
                        >
                          <option value="false">Hayır</option>
                          <option value="true">Evet</option>
                        </select>
                      </div>
                    ) : isEducationsModule && field === "discountRate" ? (
                      <div className="admin-field-stack">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={form.discountRate ?? ""}
                          onChange={(event) => setForm((prev) => ({ ...prev, discountRate: event.target.value }))}
                          placeholder="Örn. 20"
                          required
                        />
                        <small style={{ opacity: 0.85 }}>İndirim oranı yüzde olarak girilir (ör. 20 → %20).</small>
                      </div>
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
                    ) : isEducationLikeModule && field === "content" ? (
                      <textarea
                        rows={10}
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        placeholder="Eğitim içeriği metnini buraya yazın. Uzun açıklamalar girebilirsiniz."
                      />
                    ) : isEducationLikeModule && field === "topicHeadings" ? (
                      <BulletListEditor
                        hint="Her satır sitede madde işareti olarak gösterilir."
                        value={Array.isArray(form.topicHeadings) ? form.topicHeadings : []}
                        onChange={(items) => setForm((prev) => ({ ...prev, topicHeadings: items }))}
                        rows={8}
                      />
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
                              salesFilter: "",
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
                            salesFilter: picked.salesFilter || "",
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
                      <input
                        type="text"
                        value={form[field] ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                        placeholder="Örn. 20 Saat"
                        required
                      />
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
              {isEducationsModule ? (
                <EducationModulesEditor
                  modules={Array.isArray(form.modules) ? form.modules : []}
                  onChange={(modules) => setForm((prev) => ({ ...prev, modules }))}
                />
              ) : null}
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
                    logoUploading || educationImageUploading || promoVideoUploading || Boolean(examDocUploading)
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
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeDetail()}>
          <div className="admin-modal admin-modal--detail" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">{config.title}</p>
                <h3 id="admin-detail-title" className="admin-modal__title">
                  Kayıt detayı
                </h3>
                <p className="admin-modal__subtitle">Salt okunur görünüm. Eğitim içeriği, konu başlıkları ve modüller aşağıda listelenir.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeDetail} aria-label="Kapat">
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>

            <div className="admin-modal__body">
              <div className={`admin-detail-sheet ${isEducationLikeModule || isExamQuestionsModule ? "admin-detail-sheet--single" : ""}`}>
                {config.fields
                  .filter(
                    (field) =>
                      !isSalesFilterModule || field !== "institutionId" || salesFilterRequiresInstitution(detail.salesFilter),
                  )
                  .map((field) => (
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
                <>
                  <div className="admin-modal-panel">
                    <h4 className="admin-modal-panel__title">Eğitim içeriği</h4>
                    {detail.content ? (
                      <div className="training-detail-plain-content">{detail.content}</div>
                    ) : (
                      <p className="admin-modal-panel__empty">Eğitim içeriği henüz eklenmedi.</p>
                    )}
                  </div>
                  <div className="admin-modal-panel">
                    <h4 className="admin-modal-panel__title">Konu başlıkları</h4>
                    {renderBulletPreview(detail.topicHeadings)}
                  </div>
                  {isEducationsModule ? (
                    <div className="admin-modal-panel">
                      <h4 className="admin-modal-panel__title">Modüller</h4>
                      {!detailModules.length ? (
                        <p className="admin-modal-panel__empty">Henüz modül eklenmedi.</p>
                      ) : (
                        detailModules.map((moduleRow, index) => (
                          <article key={moduleRow.id || `detail-module-${index}`} className="admin-module-card admin-module-card--readonly">
                            <h5>{moduleRow.title || `Modül ${index + 1}`}</h5>
                            {Array.isArray(moduleRow.items) && moduleRow.items.length
                              ? renderBulletPreview(moduleRow.items, "Bu modülde madde yok.")
                              : null}
                            {renderModuleResourcesPreview(moduleRow.resources)}
                          </article>
                        ))
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <footer className="admin-modal__footer admin-modal__footer--detail">
              <button type="button" className="btn btn--modal-primary" onClick={closeDetail}>
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
                          return data.loadFormOptions({ force: true }).catch(() => {});
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

      {bulkUsers && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeBulkUsers()}>
          <div className="admin-modal admin-modal--form admin-modal-scrollable" role="dialog" aria-modal="true" aria-labelledby="bulk-users-title" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">{config.title}</p>
                <h3 id="bulk-users-title" className="admin-modal__title">Toplu kullanıcı ekleme</h3>
                <p className="admin-modal__subtitle">Excel'deki her satır yeni bir üye olarak kaydedilir.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeBulkUsers} disabled={bulkUsers.step === "uploading"} aria-label="Kapat">
                <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
                  <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
                </svg>
              </button>
            </header>

            <div className="admin-modal__body">
              <div className="admin-modal-panel">
                <h4 className="admin-modal-panel__title">
                  <i className="fa-solid fa-circle-info" /> Önemli not
                </h4>
                <p style={{ margin: "0 0 10px", lineHeight: 1.55 }}>
                  Toplu yükleme için lütfen aşağıdaki Excel şablonunu indiriniz ve yüklemeyi bu şablona göre yapınız.
                  Sütun sırası sabittir: <strong>1. T.C. Kimlik No</strong>, <strong>2. Ad Soyad</strong>, <strong>3. E-Posta</strong>.
                  İlk satır başlıktır; her alt satır bir üyeyi temsil eder.
                </p>
                <p style={{ margin: "0 0 12px", lineHeight: 1.55, color: "#647086" }}>
                  Kullanıcı şifresi, T.C. kimlik numarasının <strong>son 6 hanesi</strong> olarak otomatik atanır.
                  Aynı e-posta veya T.C. kimlik numarasıyla kayıtlı üyeler atlanır.
                </p>
                <button type="button" className="btn btn-outline" onClick={downloadBulkUsersTemplate}>
                  <i className="fa-solid fa-file-excel" /> Şablonu indir (TopluKullaniciEkleme.xlsx)
                </button>
              </div>

              <div className="admin-modal-panel">
                <h4 className="admin-modal-panel__title">Excel dosyasını yükleyin</h4>
                <input
                  ref={bulkUsersInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  style={{ display: "none" }}
                  onChange={handleBulkUsersFileChange}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => bulkUsersInputRef.current?.click()}
                    disabled={bulkUsers.step === "uploading"}
                  >
                    Dosya seç
                  </button>
                  <span style={{ color: "#647086" }}>{bulkUsers.fileName || "Henüz dosya seçilmedi."}</span>
                </div>
                {bulkUsers.step === "ready" && bulkUsers.rows.length > 0 ? (
                  <p style={{ margin: "12px 0 0" }}>
                    <strong>{bulkUsers.rows.length}</strong> satır okundu. Yüklemeyi başlatmak için “Yüklemeyi başlat” butonuna basın.
                  </p>
                ) : null}
                {bulkUsers.step === "uploading" ? (
                  <p style={{ margin: "12px 0 0" }}>
                    Yükleniyor… <strong>{bulkUsers.processed}</strong> / {bulkUsers.rows.length}
                  </p>
                ) : null}
                {bulkUsers.error ? <p className="admin-form-error" style={{ marginTop: 12 }}>{bulkUsers.error}</p> : null}
              </div>

              {bulkUsers.step === "done" || bulkUsers.results.length ? (
                <div className="admin-modal-panel">
                  <h4 className="admin-modal-panel__title">Sonuç</h4>
                  <p style={{ margin: "0 0 10px" }}>
                    <span style={{ color: "#16a34a" }}>Eklenen: <strong>{bulkUsers.results.filter((r) => r.status === "created").length}</strong></span>
                    {" · "}
                    <span style={{ color: "#b45309" }}>Atlanan: <strong>{bulkUsers.results.filter((r) => r.status === "skipped").length}</strong></span>
                    {" · "}
                    <span style={{ color: "#dc2626" }}>Hatalı: <strong>{bulkUsers.results.filter((r) => r.status === "failed").length}</strong></span>
                  </p>
                  {bulkUsers.results.some((r) => r.status !== "created") ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Satır</th>
                            <th>T.C. Kimlik No</th>
                            <th>Ad Soyad</th>
                            <th>E-Posta</th>
                            <th>Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkUsers.results
                            .filter((r) => r.status !== "created")
                            .map((r, index) => (
                              <tr key={`${r.sheetRow}-${index}`}>
                                <td>{r.sheetRow ?? "-"}</td>
                                <td>{r.nationalId || "-"}</td>
                                <td>{r.fullName || "-"}</td>
                                <td>{r.email || "-"}</td>
                                <td style={{ color: r.status === "failed" ? "#dc2626" : "#b45309" }}>{r.reason}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={closeBulkUsers} disabled={bulkUsers.step === "uploading"}>
                  {bulkUsers.step === "done" ? "Kapat" : "İptal"}
                </button>
                {bulkUsers.step !== "done" ? (
                  <button
                    type="button"
                    className="btn btn--modal-primary"
                    onClick={runBulkUsersImport}
                    disabled={bulkUsers.step !== "ready"}
                  >
                    {bulkUsers.step === "uploading" ? "Yükleniyor…" : "Yüklemeyi başlat"}
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      )}

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
