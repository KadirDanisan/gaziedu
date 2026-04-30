import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import TrainingCalendarPage from "./pages/TrainingCalendarPage";
import AllTrainingsPage from "./pages/AllTrainingsPage";
import AboutPage from "./pages/AboutPage";
import CorporateTrainingPage from "./pages/CorporateTrainingPage";
import ContactPage from "./pages/ContactPage";
import TrainingDetailPage from "./pages/TrainingDetailPage";
import AuthPage from "./pages/AuthPage";
import AccountProfilePage from "./pages/AccountProfilePage";
import AccountOrdersPage from "./pages/AccountOrdersPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AccountChangePasswordPage from "./pages/AccountChangePasswordPage";
import AccountLayout from "./components/AccountLayout";
import { AuthProvider } from "./context/AuthContext";
import AdminProviders from "./admin/context/AdminProviders";
import AdminLayout from "./admin/components/AdminLayout";
import ProtectedAdminRoute from "./admin/components/ProtectedAdminRoute";
import ModulePermissionGuard from "./admin/components/ModulePermissionGuard";
import AdminLoginPage from "./admin/pages/AdminLoginPage";
import InstructorLoginPage from "./admin/pages/InstructorLoginPage";
import AdminDashboardPage from "./admin/pages/AdminDashboardPage";
import CrudListPage from "./admin/pages/CrudListPage";
import RolePermissionPage from "./admin/pages/RolePermissionPage";
import ExamGeneratorPage from "./admin/pages/ExamGeneratorPage";
import NoAccessPage from "./admin/pages/NoAccessPage";

function App() {
  return (
    <AuthProvider>
      <AdminProviders>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="egitim-takvimi" element={<TrainingCalendarPage />} />
              <Route path="tum-egitimler" element={<AllTrainingsPage />} />
              <Route path="hakkimizda" element={<AboutPage />} />
              <Route path="kurumsal-egitim-cozumleri" element={<CorporateTrainingPage />} />
              <Route path="iletisim" element={<ContactPage />} />
              <Route path="egitim-detay/:slug" element={<TrainingDetailPage />} />
              <Route path="kullanici-islemleri" element={<AuthPage />} />

              <Route path="hesabim" element={<AccountLayout />}>
                <Route path="hesap-bilgilerim" element={<AccountProfilePage />} />
                <Route path="siparislerim" element={<AccountOrdersPage />} />
                <Route path="hesap-ayarlarim" element={<AccountSettingsPage />} />
                <Route path="sifremi-degistir" element={<AccountChangePasswordPage />} />
                <Route index element={<Navigate to="/hesabim/hesap-bilgilerim" replace />} />
              </Route>
            </Route>

            <Route path="/admin/giris" element={<AdminLoginPage />} />
            <Route path="/egitmen/giris" element={<InstructorLoginPage />} />
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
                <Route path="/admin/egitim-listesi" element={<ModulePermissionGuard moduleKey="educations"><CrudListPage moduleKey="educations" /></ModulePermissionGuard>} />
                <Route path="/admin/egitmen-listesi" element={<ModulePermissionGuard moduleKey="instructors"><CrudListPage moduleKey="instructors" /></ModulePermissionGuard>} />
                <Route path="/admin/egitim-takvimi-listesi" element={<ModulePermissionGuard moduleKey="educationCalendar"><CrudListPage moduleKey="educationCalendar" /></ModulePermissionGuard>} />
                <Route path="/admin/bulten-kayitlari" element={<ModulePermissionGuard moduleKey="newsletter"><CrudListPage moduleKey="newsletter" /></ModulePermissionGuard>} />
                <Route path="/admin/iletisim-formlari" element={<ModulePermissionGuard moduleKey="contactForms"><CrudListPage moduleKey="contactForms" /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-sorulari" element={<ModulePermissionGuard moduleKey="examQuestions"><CrudListPage moduleKey="examQuestions" /></ModulePermissionGuard>} />
                <Route path="/admin/sinav-olusturucu" element={<ModulePermissionGuard moduleKey="examQuestions"><ExamGeneratorPage /></ModulePermissionGuard>} />
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
