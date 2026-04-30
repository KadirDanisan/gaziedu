import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function ModulePermissionGuard({ moduleKey, children }) {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission(moduleKey, "canView")) return <Navigate to="/admin/yetki-yok" replace />;
  return children;
}
