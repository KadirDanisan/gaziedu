import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import TrainingCalendarPage from "./pages/TrainingCalendarPage";
import AllTrainingsPage from "./pages/AllTrainingsPage";
import AboutPage from "./pages/AboutPage";
import CorporateTrainingPage from "./pages/CorporateTrainingPage";
import ContactPage from "./pages/ContactPage";
import KvkkNoticePage from "./pages/KvkkNoticePage";
import TermsPrivacyPage from "./pages/TermsPrivacyPage";
import TrainingDetailPage from "./pages/TrainingDetailPage";
import ExamPortalPage from "./pages/ExamPortalPage";
import AuthPage from "./pages/AuthPage";
import AccountProfilePage from "./pages/AccountProfilePage";
import AccountOrdersPage from "./pages/AccountOrdersPage";
import AccountFavoritesPage from "./pages/AccountFavoritesPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AccountChangePasswordPage from "./pages/AccountChangePasswordPage";
import AccountLayout from "./components/AccountLayout";
import { AuthProvider } from "./context/AuthContext";
import AdminProviders from "./admin/context/AdminProviders";
import AdminLayout from "./admin/components/AdminLayout";
import ProtectedAdminRoute from "./admin/components/ProtectedAdminRoute";
import ModulePermissionGuard from "./admin/components/ModulePermissionGuard";
import AdminLoginPage from "./admin/pages/AdminLoginPage";
import AdminDashboardPage from "./admin/pages/AdminDashboardPage";
import CrudListPage from "./admin/pages/CrudListPage";
import RolePermissionPage from "./admin/pages/RolePermissionPage";
import ExamGeneratorPage from "./admin/pages/ExamGeneratorPage";
import ExamPortalAccessPage from "./admin/pages/ExamPortalAccessPage";
import ExamResultsPage from "./admin/pages/ExamResultsPage";
import AdminMessagingPage from "./admin/pages/AdminMessagingPage";
import NoAccessPage from "./admin/pages/NoAccessPage";
import ActivityLogsPage from "./admin/pages/ActivityLogsPage";

function App() {
  return (
    <AuthProvider>
      <AdminProviders>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="egitim-takvimi" element={<TrainingCalendarPage />} />
              <Route path="tum-egitimler" element={<AllTrainingsPage />} />
              <Route path="hakkimizda" element={<AboutPage />} />
              <Route path="kurumsal-egitim-cozumleri" element={<CorporateTrainingPage />} />
              <Route path="iletisim" element={<ContactPage />} />
              <Route path="kvkk-aydinlatma-metni" element={<KvkkNoticePage />} />
              <Route path="kullanim-kurallari-ve-gizlilik" element={<TermsPrivacyPage />} />
              <Route path="egitim-detay/:slug" element={<TrainingDetailPage />} />
              <Route path="kullanici-islemleri" element={<AuthPage />} />

              <Route path="hesabim" element={<AccountLayout />}>
                <Route path="hesap-bilgilerim" element={<AccountProfilePage />} />
                <Route path="sertifikalarim" element={<AccountOrdersPage />} />
                <Route path="siparislerim" element={<Navigate to="/hesabim/sertifikalarim" replace />} />
                <Route path="favorilerim" element={<AccountFavoritesPage />} />
                <Route path="hesap-ayarlarim" element={<AccountSettingsPage />} />
                <Route path="sifremi-degistir" element={<AccountChangePasswordPage />} />
                <Route index element={<Navigate to="/hesabim/hesap-bilgilerim" replace />} />
              </Route>
            </Route>

            <Route path="/sinavportali/:educationCode/:nationalId" element={<ExamPortalPage />} />
            <Route path="/admin/giris" element={<AdminLoginPage />} />
            <Route element={<ProtectedAdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route
                  path="/admin/dashboard"
                  element={
                    <ModulePermissionGuard moduleKey="dashboard">
                      <AdminDashboardPage />
                    </ModulePermissionGuard>
                  }
                />
                <Route path="/admin/kayit-listesi" element={<ModulePermissionGuard moduleKey="normalUsers"><CrudListPage moduleKey="normalUsers" /></ModulePermissionGuard>} />
                <Route path="/admin/yonetim-listesi" element={<ModulePermissionGuard moduleKey="adminUsers"><CrudListPage moduleKey="adminUsers" /></ModulePermissionGuard>} />
                <Route path="/admin/kurum-listesi" element={<ModulePermissionGuard moduleKey="institutions"><CrudListPage moduleKey="institutions" /></ModulePermissionGuard>} />
                <Route path="/admin/egitim-kategorisi-listesi" element={<ModulePermissionGuard moduleKey="educationCategories"><CrudListPage moduleKey="educationCategories" /></ModulePermissionGuard>} />
                <Route path="/admin/onaylanmis-egitim-listesi" element={<ModulePermissionGuard moduleKey="approvedEducations"><CrudListPage moduleKey="approvedEducations" /></ModulePermissionGuard>} />
                <Route path="/admin/egitim-listesi" element={<ModulePermissionGuard moduleKey="educations"><CrudListPage moduleKey="educations" /></ModulePermissionGuard>} />
                <Route path="/admin/egitmen-listesi" element={<ModulePermissionGuard moduleKey="instructors"><CrudListPage moduleKey="instructors" /></ModulePermissionGuard>} />
                <Route path="/admin/egitim-takvimi-listesi" element={<ModulePermissionGuard moduleKey="educationCalendar"><CrudListPage moduleKey="educationCalendar" /></ModulePermissionGuard>} />
                <Route path="/admin/bulten-kayitlari" element={<ModulePermissionGuard moduleKey="newsletter"><CrudListPage moduleKey="newsletter" /></ModulePermissionGuard>} />
                <Route path="/admin/iletisim-formlari" element={<ModulePermissionGuard moduleKey="contactForms"><CrudListPage moduleKey="contactForms" /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-sorulari" element={<ModulePermissionGuard moduleKey="examQuestions"><CrudListPage moduleKey="examQuestions" /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-portali-girisleri" element={<ModulePermissionGuard moduleKey="examPortalAccess"><ExamPortalAccessPage /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-sonuclari" element={<ModulePermissionGuard moduleKey="examResults"><ExamResultsPage /></ModulePermissionGuard>} />
                <Route path="/admin/yonetici-sohbeti" element={<ModulePermissionGuard moduleKey="adminMessaging"><AdminMessagingPage /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-olusturucu" element={<ModulePermissionGuard moduleKey="examQuestions"><ExamGeneratorPage /></ModulePermissionGuard>} />
                <Route path="/admin/aktivite-listesi" element={<ActivityLogsPage />} />
                <Route path="/admin/rol-yetki" element={<ModulePermissionGuard moduleKey="roles"><RolePermissionPage /></ModulePermissionGuard>} />
                <Route path="/admin/yetki-yok" element={<NoAccessPage />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminProviders>
    </AuthProvider>
  );
}

export default App;
