export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line", route: "/admin/dashboard" },
  { key: "normalUsers", label: "Kayıt Listesi", icon: "fa-solid fa-users", route: "/admin/kayit-listesi" },
  { key: "adminUsers", label: "Yönetim Listesi", icon: "fa-solid fa-user-shield", route: "/admin/yonetim-listesi" },
  { key: "institutions", label: "Kurum Listesi", icon: "fa-solid fa-building", route: "/admin/kurum-listesi" },
  { key: "educationCategories", label: "Eğitim Kategorisi", icon: "fa-solid fa-layer-group", route: "/admin/egitim-kategorisi-listesi" },
  { key: "approvedEducations", label: "Onaylanmış Eğitim Listesi", icon: "fa-solid fa-circle-check", route: "/admin/onaylanmis-egitim-listesi" },
  { key: "educations", label: "Eğitim Listesi", icon: "fa-solid fa-graduation-cap", route: "/admin/egitim-listesi" },
  { key: "instructors", label: "Eğitmen Listesi", icon: "fa-solid fa-chalkboard-user", route: "/admin/egitmen-listesi" },
  { key: "educationCalendar", label: "Eğitim Takvimi", icon: "fa-solid fa-calendar-days", route: "/admin/egitim-takvimi-listesi" },
  { key: "newsletter", label: "Bülten Kayıtları", icon: "fa-solid fa-envelope-circle-check", route: "/admin/bulten-kayitlari" },
  { key: "contactForms", label: "İletişim Formları", icon: "fa-solid fa-comments", route: "/admin/iletisim-formlari" },
  { key: "examQuestions", label: "Sınav Soruları", icon: "fa-solid fa-file-pen", route: "/admin/sinav-sorulari" },
  { key: "examPortalAccess", label: "Sınav Portalı Girişleri", icon: "fa-solid fa-door-open", route: "/admin/sinav-portali-girisleri" },
  { key: "examResults", label: "Sınav Sonuçları", icon: "fa-solid fa-clipboard-check", route: "/admin/sinav-sonuclari" },
  { key: "adminMessaging", label: "Yönetici sohbeti", icon: "fa-solid fa-comments", route: "/admin/yonetici-sohbeti" },
  { key: "activityLogs", label: "Aktivite Listesi", icon: "fa-solid fa-clock-rotate-left", route: "/admin/aktivite-listesi" },
  { key: "roles", label: "Rol ve Yetki", icon: "fa-solid fa-lock", route: "/admin/rol-yetki" },
];

export const PERMISSION_ACTIONS = ["canView", "canCreate", "canUpdate", "canDelete"];

export const PAGE_SIZE = 20;
