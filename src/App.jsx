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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/egitim-takvimi" element={<TrainingCalendarPage />} />
            <Route path="/tum-egitimler" element={<AllTrainingsPage />} />
            <Route path="/hakkimizda" element={<AboutPage />} />
            <Route path="/kurumsal-egitim-cozumleri" element={<CorporateTrainingPage />} />
            <Route path="/iletisim" element={<ContactPage />} />
            <Route path="/egitim-detay/:slug" element={<TrainingDetailPage />} />
            <Route path="/kullanici-islemleri" element={<AuthPage />} />

            <Route path="/hesabim" element={<AccountLayout />}>
              <Route path="hesap-bilgilerim" element={<AccountProfilePage />} />
              <Route path="siparislerim" element={<AccountOrdersPage />} />
              <Route path="hesap-ayarlarim" element={<AccountSettingsPage />} />
              <Route path="sifremi-degistir" element={<AccountChangePasswordPage />} />
              <Route path="" element={<Navigate to="/hesabim/hesap-bilgilerim" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
