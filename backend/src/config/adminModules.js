const moduleConfig = {
  normalUsers: { table: "normal_users", actionKey: "normalUsers", searchable: ["first_name", "last_name", "email"] },
  adminUsers: { table: "admin_users", actionKey: "adminUsers", searchable: ["first_name", "last_name", "email", "phone"] },
  institutions: { table: "institutions", actionKey: "institutions", searchable: ["name", "code", "authorized_person"] },
  educationCategories: { table: "education_categories", actionKey: "educationCategories", searchable: ["category_code", "category_name"] },
  educations: { table: "educations", actionKey: "educations", searchable: ["name", "code", "description"] },
  approvedEducations: {
    table: "approved_educations",
    actionKey: "approvedEducations",
    searchable: ["code", "name"],
  },
  instructors: { table: "instructors", actionKey: "instructors", searchable: ["first_name", "last_name", "email"] },
  educationCalendar: { table: "education_calendar", actionKey: "educationCalendar", searchable: ["education_name", "code", "description", "instructor_info"] },
  newsletter: { table: "newsletter", actionKey: "newsletter", searchable: ["email"] },
  contactForms: { table: "contact_forms", actionKey: "contactForms", searchable: ["full_name", "email", "subject"] },
  examQuestions: { table: "exam_questions", actionKey: "examQuestions", searchable: ["question_text", "difficulty", "topic_doc_name", "questions_doc_name"] },
  roles: { table: "roles", actionKey: "roles", searchable: ["name", "code"] },
};

const permissionModules = [
  "dashboard",
  "normalUsers",
  "adminUsers",
  "institutions",
  "educationCategories",
  "approvedEducations",
  "educations",
  "instructors",
  "educationCalendar",
  "newsletter",
  "contactForms",
  "examQuestions",
  "examPortalAccess",
  "examResults",
  "certificateList",
  "activityLogs",
  "roles",
  "adminMessaging",
];

export { moduleConfig, permissionModules };
