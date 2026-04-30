import { useMemo } from "react";
import { ADMIN_MODULES, PERMISSION_ACTIONS } from "../modules";
import { useAdminData } from "../context/AdminDataContext";

const actionLabels = {
  canView: "Görüntüle",
  canCreate: "Ekle",
  canUpdate: "Düzenle",
  canDelete: "Sil",
};

export default function RolePermissionPage() {
  const { roles, permissions, setPermissions } = useAdminData();

  const grouped = useMemo(
    () =>
      roles.map((role) => ({
        ...role,
        permissions: permissions.filter((item) => item.roleId === role.id),
      })),
    [roles, permissions],
  );

  const handleToggle = (permissionId, action) => {
    setPermissions((prev) => prev.map((item) => (item.id === permissionId ? { ...item, [action]: !item[action] } : item)));
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Rol ve Yetki Yönetimi</h2>
          <p>Tüm modüllerde görüntüle / ekle / düzenle / sil izinlerini yönetin.</p>
        </div>
      </div>

      {grouped.map((role) => (
        <article key={role.id} className="admin-panel-card">
          <h3>{role.name}</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Modül</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action}>{actionLabels[action]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ADMIN_MODULES.map((module) => {
                  const permission = role.permissions.find((item) => item.moduleName === module.key);
                  if (!permission) return null;
                  return (
                    <tr key={permission.id}>
                      <td>{module.label}</td>
                      {PERMISSION_ACTIONS.map((action) => (
                        <td key={action}>
                          <label className="admin-checkbox">
                            <input type="checkbox" checked={Boolean(permission[action])} onChange={() => handleToggle(permission.id, action)} />
                            <span />
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
