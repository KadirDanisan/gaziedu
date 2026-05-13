import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { adminApi } from "../api";

const AdminAuthContext = createContext(null);

const getPermissionMap = (permissions, roleId) =>
  permissions
    .filter((permission) => permission.roleId === roleId)
    .reduce((acc, item) => {
      acc[item.moduleName] = item;
      return acc;
    }, {});

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("adminSession");
    return raw ? JSON.parse(raw) : null;
  });
  const [permissions, setPermissions] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const loginAdmin = async (email, password) => {
    try {
      const result = await adminApi.login(email, password);
      localStorage.setItem("adminToken", result.token);
      localStorage.setItem("adminSession", JSON.stringify({ userType: "admin", user: result.user }));
      setSession({ userType: "admin", user: result.user });
      const bootstrap = await adminApi.getBootstrap();
      setPermissions(bootstrap.permissions);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const hydrateSession = async () => {
    if (!localStorage.getItem("adminToken")) return;
    try {
      const bootstrap = await adminApi.getBootstrap();
      setPermissions(bootstrap.permissions);
    } catch {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminSession");
      setSession(null);
      setPermissions([]);
    }
    setIsReady(true);
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminSession");
    setSession(null);
    setPermissions([]);
  };

  const updateAdminSession = ({ token, user }) => {
    localStorage.setItem("adminToken", token);
    localStorage.setItem("adminSession", JSON.stringify({ userType: "admin", user }));
    setSession({ userType: "admin", user });
  };

  const roleId = session?.user?.roleId;
  const permissionMap = useMemo(() => getPermissionMap(permissions, roleId), [permissions, roleId]);

  const hasPermission = (moduleName, action = "canView") => {
    const modulePermission = permissionMap[moduleName];
    if (!modulePermission) return false;
    return Boolean(modulePermission[action]);
  };

  useEffect(() => {
    hydrateSession().finally(() => setIsReady(true));
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        loginAdmin,
        logout,
        updateAdminSession,
        hasPermission,
        permissionMap,
        permissions,
        setPermissions,
        hydrateSession,
        isReady,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
};
