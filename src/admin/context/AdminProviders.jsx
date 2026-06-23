import { Outlet } from "react-router-dom";
import { AdminAuthProvider } from "./AdminAuthContext";
import { AdminDataProvider } from "./AdminDataContext";

function AdminProviders({ children }) {
  return (
    <AdminAuthProvider>
      <AdminDataProvider>{children}</AdminDataProvider>
    </AdminAuthProvider>
  );
}

export function AdminRouteShell() {
  return (
    <AdminProviders>
      <Outlet />
    </AdminProviders>
  );
}

export default AdminProviders;
