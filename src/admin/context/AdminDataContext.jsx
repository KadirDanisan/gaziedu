import { createContext, useCallback, useContext, useRef, useState } from "react";
import { adminApi, invalidateAdminCache } from "../api";

const AdminDataContext = createContext(null);

const MODULES_NEEDING_FORM_OPTIONS = new Set([
  "adminUsers",
  "educations",
  "educationCalendar",
  "examQuestions",
  "approvedEducations",
]);

export function AdminDataProvider({ children }) {
  const [roles, setRoles] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [educationCategories, setEducationCategories] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [educationInstructors, setEducationInstructors] = useState([]);
  const [educations, setEducations] = useState([]);
  const [approvedEducations, setApprovedEducations] = useState([]);
  const formOptionsLoadedRef = useRef(false);

  const applyFormOptions = (result) => {
    setRoles(result.roles || []);
    setInstitutions(result.institutions || []);
    setEducationCategories(result.educationCategories || []);
    setApprovedEducations(result.approvedEducations || []);
    setInstructors(result.instructors || []);
    setEducationInstructors(result.educationInstructors || []);
    setEducations(result.educations || []);
    formOptionsLoadedRef.current = true;
    return result;
  };

  const loadFormOptions = useCallback(async ({ force = false } = {}) => {
    if (!force && formOptionsLoadedRef.current) return null;
    if (force) {
      formOptionsLoadedRef.current = false;
      invalidateAdminCache("admin-form-options");
    }
    const result = await adminApi.getFormOptions();
    return applyFormOptions(result);
  }, []);

  const loadFormOptionsForModule = useCallback(
    async (moduleKey, { force = false } = {}) => {
      if (!MODULES_NEEDING_FORM_OPTIONS.has(moduleKey)) return null;
      return loadFormOptions({ force });
    },
    [loadFormOptions],
  );

  const getDashboard = useCallback(async ({ force = false } = {}) => {
    if (force) invalidateAdminCache("admin-dashboard");
    return adminApi.getDashboard();
  }, []);

  const getModuleData = async (moduleName, page, search, readStatus) =>
    adminApi.getModule(moduleName, page, search, readStatus);
  const createItem = async (moduleName, payload) => adminApi.createItem(moduleName, payload);
  const updateItem = async (moduleName, id, payload) => adminApi.updateItem(moduleName, id, payload);
  const deleteItem = async (moduleName, id) => adminApi.deleteItem(moduleName, id);
  const uploadInstitutionLogo = async (file) => adminApi.uploadInstitutionLogo(file);
  const uploadEducationImage = async (file) => adminApi.uploadEducationImage(file);
  const uploadEducationContentDoc = async (file) => adminApi.uploadEducationContentDoc(file);
  const uploadExamDoc = async (file) => adminApi.uploadExamDoc(file);
  const updatePermission = async (id, payload) => adminApi.updatePermission(id, payload);
  const getActivityLogs = async (page, pageSize) => adminApi.getActivityLogs(page, pageSize);

  const value = {
    roles,
    institutions,
    educationCategories,
    instructors,
    educationInstructors,
    educations,
    approvedEducations,
    loadFormOptions,
    loadFormOptionsForModule,
    getDashboard,
    getModuleData,
    createItem,
    updateItem,
    deleteItem,
    uploadInstitutionLogo,
    uploadEducationImage,
    uploadEducationContentDoc,
    uploadExamDoc,
    updatePermission,
    getActivityLogs,
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
