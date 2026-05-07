import { createContext, useContext, useState } from "react";
import { adminApi } from "../api";
import { useAdminAuth } from "./AdminAuthContext";

const AdminDataContext = createContext(null);

export function AdminDataProvider({ children }) {
  const { setPermissions } = useAdminAuth();
  const [roles, setRoles] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [educationInstructors, setEducationInstructors] = useState([]);
  const [educations, setEducations] = useState([]);

  const loadBootstrap = async () => {
    const result = await adminApi.getBootstrap();
    setRoles(result.roles || []);
    setInstitutions(result.institutions || []);
    setInstructors(result.instructors || []);
    setEducationInstructors(result.educationInstructors || []);
    setEducations(result.educations || []);
    setPermissions(result.permissions || []);
    return result;
  };

  const getModuleData = async (moduleName, page, search, readStatus) =>
    adminApi.getModule(moduleName, page, search, readStatus);
  const createItem = async (moduleName, payload) => adminApi.createItem(moduleName, payload);
  const updateItem = async (moduleName, id, payload) => adminApi.updateItem(moduleName, id, payload);
  const deleteItem = async (moduleName, id) => adminApi.deleteItem(moduleName, id);
  const uploadInstitutionLogo = async (file) => adminApi.uploadInstitutionLogo(file);
  const uploadEducationImage = async (file) => adminApi.uploadEducationImage(file);
  const uploadEducationContentDoc = async (file) => adminApi.uploadEducationContentDoc(file);
  const uploadExamDoc = async (file, mode) => adminApi.uploadExamDoc(file, mode);
  const updatePermission = async (id, payload) => {
    const updated = await adminApi.updatePermission(id, payload);
    await loadBootstrap();
    return updated;
  };
  const getDashboard = async () => adminApi.getDashboard();

  const value = {
    roles,
    institutions,
    instructors,
    educationInstructors,
    educations,
    loadBootstrap,
    getModuleData,
    createItem,
    updateItem,
    deleteItem,
    uploadInstitutionLogo,
    uploadEducationImage,
    uploadEducationContentDoc,
    uploadExamDoc,
    updatePermission,
    getDashboard,
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
