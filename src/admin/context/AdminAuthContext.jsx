import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  const [allPermissions, setAllPermissions] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const loadMyPermissions = useCallback(async () => {
    const result = await adminApi.getMyPermissions();
    setPermissions(result.permissions || []);
    return result.permissions || [];
  }, []);

  const loadAllPermissions = useCallback(async () => {
    const result = await adminApi.getAllPermissions();
    setAllPermissions(result.permissions || []);
    return result.permissions || [];
  }, []);

  const loginAdmin = async (email, password) => {
    try {
      const result = await adminApi.login(email, password);
      localStorage.setItem("adminToken", result.token);
      localStorage.setItem("adminSession", JSON.stringify({ userType: "admin", user: result.user }));
      setSession({ userType: "admin", user: result.user });
      await loadMyPermissions();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const hydrateSession = async () => {
    if (!localStorage.getItem("adminToken")) return;
    try {
      await loadMyPermissions();
    } catch {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminSession");
      setSession(null);
      setPermissions([]);
    }
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
        allPermissions,
        setPermissions,
        loadMyPermissions,
        loadAllPermissions,
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
