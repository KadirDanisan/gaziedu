import { AdminAuthProvider } from "./AdminAuthContext";
import { AdminDataProvider } from "./AdminDataContext";

export default function AdminProviders({ children }) {
  return (
    <AdminAuthProvider>
      <AdminDataProvider>{children}</AdminDataProvider>
    </AdminAuthProvider>
  );
}
