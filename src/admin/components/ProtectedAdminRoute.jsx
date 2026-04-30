import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function ProtectedAdminRoute() {
  const { session } = useAdminAuth();
  if (!session) return <Navigate to="/admin/giris" replace />;
  return <Outlet />;
}
