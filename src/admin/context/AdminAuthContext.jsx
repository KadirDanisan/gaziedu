import { createContext, useContext, useMemo, useState } from "react";
import { useAdminData } from "./AdminDataContext";

const AdminAuthContext = createContext(null);

const getPermissionMap = (permissions, roleId) =>
  permissions
    .filter((permission) => permission.roleId === roleId)
    .reduce((acc, item) => {
      acc[item.moduleName] = item;
      return acc;
    }, {});

export function AdminAuthProvider({ children }) {
  const { adminUsers, instructors, permissions } = useAdminData();
  const [session, setSession] = useState(null);

  const loginAdmin = (email, password) => {
    const user = adminUsers.find((item) => item.email === email && item.password === password);
    if (!user) return { ok: false, message: "E-posta veya şifre hatalı." };
    setSession({ userType: "admin", user });
    return { ok: true };
  };

  const loginInstructor = (email, password) => {
    const user = instructors.find((item) => item.email === email && item.password === password);
    if (!user) return { ok: false, message: "Eğitmen bilgileri hatalı." };
    setSession({ userType: "instructor", user });
    return { ok: true };
  };

  const logout = () => setSession(null);

  const roleId = session?.userType === "admin" ? session.user.roleId : "r-instructor";
  const permissionMap = useMemo(() => getPermissionMap(permissions, roleId), [permissions, roleId]);

  const hasPermission = (moduleName, action = "canView") => {
    const modulePermission = permissionMap[moduleName];
    if (!modulePermission) return false;
    return Boolean(modulePermission[action]);
  };

  return (
    <AdminAuthContext.Provider value={{ session, loginAdmin, loginInstructor, logout, hasPermission, permissionMap }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
};
