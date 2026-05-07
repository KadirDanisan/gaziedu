import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function ProtectedAdminRoute() {
  const { session, isReady } = useAdminAuth();
  if (!isReady) return null;
  if (!session) return <Navigate to="/admin/giris" replace />;
  return <Outlet />;
}
