import { useEffect, useMemo, useState } from "react";
import { ADMIN_MODULES, PERMISSION_ACTIONS } from "../modules";
import { useAdminData } from "../context/AdminDataContext";
import { useAdminAuth } from "../context/AdminAuthContext";

const actionLabels = {
  canView: "Görüntüle",
  canCreate: "Ekle",
  canUpdate: "Düzenle",
  canDelete: "Sil",
};

const SYSTEM_ROLE_ORDER = ["superadmin", "admin", "yetkili", "egitmen"];

const systemRoleWarnings = {
  admin: "Sertifika bildirimi gönderme ve Yönetici Sohbeti'nde duyuru/grup açma bu role bağlıdır.",
  yetkili: "Sertifika bildirimlerini kabul etme akışı bu role bağlıdır.",
  egitmen: "Eğitmen Listesi ve eğitimlere eğitmen atama bu role bağlıdır; silinirse yeni eğitmen eklenemez.",
};

const sortRoles = (list) =>
  [...list].sort((a, b) => {
    const ai = SYSTEM_ROLE_ORDER.indexOf(a.code);
    const bi = SYSTEM_ROLE_ORDER.indexOf(b.code);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
    <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.28 9.17 12 2.87 5.71 4.29 4.29l6.3 6.31 6.29-6.3 1.42 1.41z" />
  </svg>
);

export default function RolePermissionPage() {
  const { roles, loadFormOptions, updatePermission, createRole, updateRole, deleteRole } = useAdminData();
  const { allPermissions, loadAllPermissions, hasPermission } = useAdminAuth();
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingRole, setDeletingRole] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canCreateRole = hasPermission("roles", "canCreate");
  const canUpdateRole = hasPermission("roles", "canUpdate");
  const canDeleteRole = hasPermission("roles", "canDelete");
  const isNewRole = editingRole === "new";

  useEffect(() => {
    loadAllPermissions().catch(() => {});
    loadFormOptions().catch(() => {});
  }, [loadAllPermissions, loadFormOptions]);

  const sortedRoles = useMemo(() => sortRoles(roles), [roles]);

  const grouped = useMemo(
    () =>
      sortedRoles.map((role) => ({
        ...role,
        permissions: allPermissions.filter((item) => item.roleId === role.id),
      })),
    [sortedRoles, allPermissions],
  );

  const refreshRoles = () => Promise.all([loadFormOptions({ force: true }), loadAllPermissions()]);

  const handleToggle = (permissionId, action) => {
    const permission = allPermissions.find((item) => item.id === permissionId);
    if (!permission) return;
    updatePermission(permissionId, { [action]: !permission[action] }).then(() => loadAllPermissions());
  };

  const openCreate = () => {
    setRoleName("");
    setCopyFromRoleId("");
    setFormError("");
    setEditingRole("new");
  };

  const openEdit = (role) => {
    setRoleName(role.name || "");
    setFormError("");
    setEditingRole(role);
  };

  const closeForm = () => {
    if (saving) return;
    setEditingRole(null);
  };

  const handleSubmitRole = async (event) => {
    event.preventDefault();
    const name = roleName.trim();
    if (!name) return;
    setSaving(true);
    setFormError("");
    try {
      if (isNewRole) {
        await createRole({ name, copyFromRoleId: copyFromRoleId || undefined });
      } else {
        await updateRole(editingRole.id, { name });
      }
      await refreshRoles();
      setEditingRole(null);
    } catch (err) {
      setFormError(err.message || (isNewRole ? "Rol eklenemedi." : "Rol güncellenemedi."));
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (role) => {
    setDeleteError("");
    setDeletingRole(role);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingRole(null);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRole(deletingRole.id);
      await refreshRoles();
      setDeletingRole(null);
    } catch (err) {
      setDeleteError(err.message || "Rol silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Rol ve Yetki Yönetimi</h2>
          <p>Tüm modüllerde görüntüle / ekle / düzenle / sil izinlerini yönetin.</p>
        </div>
        {canCreateRole ? (
          <button type="button" className="btn" onClick={openCreate}>
            Rol Ekle
          </button>
        ) : null}
      </div>

      {editingRole && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
        >
          <form
            className="admin-modal admin-modal--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-form-title"
            onSubmit={handleSubmitRole}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header">
              <div className="admin-modal__header-text">
                <p className="admin-modal__eyebrow">Rol ve Yetki</p>
                <h3 id="role-form-title" className="admin-modal__title">
                  {isNewRole ? "Yeni rol" : "Rolü düzenle"}
                </h3>
                <p className="admin-modal__subtitle">
                  {isNewRole
                    ? "Rolü oluşturduktan sonra yetki tablosundan erişebileceği modülleri işaretleyin, ardından Yönetim Listesi'nden kullanıcıya atayın."
                    : "Rol adı menüde, yönetim listesinde ve yetki tablosunda bu isimle görünür."}
                </p>
              </div>
              <button type="button" className="admin-modal__close" onClick={closeForm} disabled={saving} aria-label="Kapat">
                <CloseIcon />
              </button>
            </header>

            <div className="admin-modal__body">
              <div className="admin-form-grid admin-form-grid-single admin-form-grid--premium">
                <label className="admin-field">
                  <span className="admin-field__label">Rol adı</span>
                  <input
                    type="text"
                    placeholder="ör. Sınav Yetkilisi"
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                    autoFocus
                    required
                  />
                </label>
                {isNewRole ? (
                  <label className="admin-field">
                    <span className="admin-field__label">Başlangıç yetkileri</span>
                    <select value={copyFromRoleId} onChange={(event) => setCopyFromRoleId(event.target.value)}>
                      <option value="">Tüm yetkiler kapalı başlasın</option>
                      <optgroup label="Mevcut rolden yetkileri kopyala">
                        {sortedRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                ) : null}
              </div>
              {formError ? <p className="admin-form-error">{formError}</p> : null}
            </div>

            <footer className="admin-modal__footer">
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={closeForm} disabled={saving}>
                  İptal
                </button>
                <button type="submit" className="btn btn--modal-primary" disabled={saving || !roleName.trim()}>
                  {saving ? "Kaydediliyor..." : isNewRole ? "Rol Ekle" : "Kaydet"}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {deletingRole && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeDelete()}>
          <div className="admin-modal admin-modal--confirm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--confirm">
              <div className="admin-modal__confirm-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width={28} height={28}>
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
                </svg>
              </div>
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Rolü sil</h3>
                <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                  <strong>{deletingRole.name}</strong> rolü ve tüm yetki ayarları kalıcı olarak silinecek. Bu işlem geri alınamaz.
                </p>
                {systemRoleWarnings[deletingRole.code] ? (
                  <p className="admin-modal__subtitle admin-modal__subtitle--dense">
                    Bu bir sistem rolüdür. {systemRoleWarnings[deletingRole.code]}
                  </p>
                ) : null}
                {deleteError ? <p className="admin-form-error">{deleteError}</p> : null}
              </div>
              <button type="button" className="admin-modal__close" onClick={closeDelete} disabled={deleting} aria-label="Vazgeç">
                <CloseIcon />
              </button>
            </header>
            <footer className="admin-modal__footer">
              <div className="admin-modal-actions admin-modal-actions--stretch">
                <button type="button" className="btn btn-outline btn--modal-secondary" onClick={closeDelete} disabled={deleting}>
                  Vazgeç
                </button>
                <button type="button" className="btn btn--danger-fill" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Siliniyor..." : "Evet, sil"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {grouped.map((role) => (
        <article key={role.id} className="admin-panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3>{role.name}</h3>
            {canUpdateRole || canDeleteRole ? (
              <div className="admin-actions">
                {canUpdateRole ? (
                  <button type="button" onClick={() => openEdit(role)}>
                    <i className="fa-solid fa-pen" aria-hidden="true" /> Düzenle
                  </button>
                ) : null}
                {canDeleteRole ? (
                  <button type="button" className="is-danger" onClick={() => openDelete(role)}>
                    <i className="fa-solid fa-trash" aria-hidden="true" /> Sil
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
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
                            <input
                              type="checkbox"
                              checked={Boolean(permission[action])}
                              onChange={() => handleToggle(permission.id, action)}
                            />
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
