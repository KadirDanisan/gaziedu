import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import contactRoutes from "./public/contact.routes.js";
import publicEducationRoutes from "./public/education.routes.js";
import examPortalRoutes from "./public/examPortal.routes.js";
import adminUploadsRoutes from "./admin/uploads.routes.js";
import adminBootstrapRoutes from "./admin/bootstrap.routes.js";
import adminExamRoutes from "./admin/exam.routes.js";
import adminMessagingRoutes from "./admin/messaging.routes.js";
import adminCrudRoutes from "./admin/crud.routes.js";
import adminPermissionsRoutes from "./admin/permissions.routes.js";

/** Routers keep full /api/... paths from the original monolith. */
export function registerRoutes(app) {
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(usersRoutes);
  app.use(contactRoutes);
  app.use(publicEducationRoutes);
  app.use(examPortalRoutes);
  app.use(adminUploadsRoutes);
  app.use(adminBootstrapRoutes);
  app.use(adminExamRoutes);
  app.use(adminMessagingRoutes);
  app.use(adminCrudRoutes);
  app.use(adminPermissionsRoutes);
}
