import { createContext, useContext, useMemo, useState } from "react";
import {
  adminUsers as seedAdminUsers,
  contactForms as seedContactForms,
  educationCalendar as seedCalendar,
  educations as seedEducations,
  examQuestions as seedExamQuestions,
  instructors as seedInstructors,
  institutions as seedInstitutions,
  newsletter as seedNewsletter,
  normalUsers as seedNormalUsers,
  permissions as seedPermissions,
  roles as seedRoles,
} from "../mockData";

const AdminDataContext = createContext(null);

const toId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function AdminDataProvider({ children }) {
  const [normalUsers, setNormalUsers] = useState(seedNormalUsers);
  const [adminUsers, setAdminUsers] = useState(seedAdminUsers);
  const [institutions, setInstitutions] = useState(seedInstitutions);
  const [educations, setEducations] = useState(seedEducations);
  const [instructors, setInstructors] = useState(seedInstructors);
  const [educationCalendar, setEducationCalendar] = useState(seedCalendar);
  const [newsletter, setNewsletter] = useState(seedNewsletter);
  const [contactForms, setContactForms] = useState(seedContactForms);
  const [examQuestions, setExamQuestions] = useState(seedExamQuestions);
  const [roles, setRoles] = useState(seedRoles);
  const [permissions, setPermissions] = useState(seedPermissions);

  const collections = useMemo(
    () => ({
      normalUsers,
      adminUsers,
      institutions,
      educations,
      instructors,
      educationCalendar,
      newsletter,
      contactForms,
      examQuestions,
      roles,
      permissions,
    }),
    [normalUsers, adminUsers, institutions, educations, instructors, educationCalendar, newsletter, contactForms, examQuestions, roles, permissions],
  );

  const setters = {
    normalUsers: setNormalUsers,
    adminUsers: setAdminUsers,
    institutions: setInstitutions,
    educations: setEducations,
    instructors: setInstructors,
    educationCalendar: setEducationCalendar,
    newsletter: setNewsletter,
    contactForms: setContactForms,
    examQuestions: setExamQuestions,
    roles: setRoles,
    permissions: setPermissions,
  };

  const createItem = (moduleName, payload) => {
    const setter = setters[moduleName];
    if (!setter) return;
    setter((prev) => [{ ...payload, id: toId(moduleName), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
  };

  const updateItem = (moduleName, id, payload) => {
    const setter = setters[moduleName];
    if (!setter) return;
    setter((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload, updatedAt: new Date().toISOString() } : item)));
  };

  const deleteItem = (moduleName, id) => {
    const setter = setters[moduleName];
    if (!setter) return;
    setter((prev) => prev.filter((item) => item.id !== id));
  };

  const value = {
    ...collections,
    createItem,
    updateItem,
    deleteItem,
    setPermissions,
  };

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return context;
};
