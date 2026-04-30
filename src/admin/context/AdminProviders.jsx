import { AdminAuthProvider } from "./AdminAuthContext";
import { AdminDataProvider } from "./AdminDataContext";

export default function AdminProviders({ children }) {
  return (
    <AdminDataProvider>
      <AdminAuthProvider>{children}</AdminAuthProvider>
    </AdminDataProvider>
  );
}
