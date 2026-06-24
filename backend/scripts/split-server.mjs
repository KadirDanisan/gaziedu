/**
 * Splits monolithic server.js into modular architecture.
 * Run: node scripts/split-server.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../src");
const ORIG = path.join(SRC, "_server.orig.js");
const SERVER = path.join(SRC, "server.js");

if (!fs.existsSync(ORIG)) {
  fs.copyFileSync(SERVER, ORIG);
}

const raw = fs.readFileSync(ORIG, "utf8");
const lines = raw.split("\n");

/** 1-based inclusive line extraction */
function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function write(rel, content) {
  const filePath = path.join(SRC, rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : content + "\n");
}

// ─── Infrastructure modules ───────────────────────────────────────────────

write(
  "config/env.js",
  `import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const port = Number(process.env.PORT || 5000);
export const jwtSecret = process.env.JWT_SECRET || "dev-secret";
export const uploadsDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
`,
);

write(
  "db/pool.js",
  `import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:1234@localhost:5432/guzem",
});

export default pool;
`,
);

write(
  "utils/recaptcha.js",
  slice(31, 89).replace(/^const /gm, "const ").replace(
    /^/,
    "",
  ) +
    `
export { RECAPTCHA_V2_ERROR_MESSAGES, normalizeRecaptchaSecret, verifyRecaptchaV2IfConfigured };
`.replace(
      "const RECAPTCHA_V2_ERROR_MESSAGES",
      "const RECAPTCHA_V2_ERROR_MESSAGES",
    ),
);

// Fix recaptcha - the slice already has the functions, need proper export
write(
  "utils/recaptcha.js",
  `${slice(31, 89)}

export { RECAPTCHA_V2_ERROR_MESSAGES, normalizeRecaptchaSecret, verifyRecaptchaV2IfConfigured };
`,
);

write(
  "middleware/upload.js",
  `import multer from "multer";
import path from "path";
import { uploadsDir } from "../config/env.js";

${slice(101, 130).replace(/^const /gm, "const ")}

export { upload, uploadDoc };
`,
);

write(
  "db/migrations/index.js",
  `import pool from "../pool.js";

${slice(132, 680)}

export {
  migrateContactFormTimestampsToIstanbul,
  migrateInstitutionCodeColumn,
  migrateInstructorAdminLinkColumn,
  migrateEducationDocColumns,
  migrateEducationCalendarColumns,
  migrateEducationCategoryColumns,
  migrateApprovedEducationsTable,
  migrateUserFavoritesTable,
  migrateUserFavoritesDualSupport,
  migrateEducationReviewsTable,
  migrateEducationRatingAggregates,
  migrateNormalUserDetails,
  migrateNormalUserDetailsAddressColumns,
  migrateNormalUserDetailsNationalIdUnique,
  migrateExamQuestionBatchColumns,
  migrateExamAttemptsTable,
  EXAM_PORTAL_MAX_STARTS,
  migrateExamPortalVisitTable,
  migrateExamPortalBestScoresTable,
  migrateExamPortalParticipantNameColumns,
  migrateBackfillExamPortalBestScores,
  migrateExamPortalAccessPermissions,
  migrateExamResultsPermissions,
  migrateCertificateListPermissions,
  migrateExamQuestionSettingsColumns,
  migrateAdminMessagingTables,
  migrateAdminMessagingPermissions,
};

export const migrations = [
  migrateInstitutionCodeColumn,
  migrateInstructorAdminLinkColumn,
  migrateEducationDocColumns,
  migrateEducationCalendarColumns,
  migrateEducationCategoryColumns,
  migrateApprovedEducationsTable,
  migrateUserFavoritesTable,
  migrateUserFavoritesDualSupport,
  migrateEducationReviewsTable,
  migrateEducationRatingAggregates,
  migrateNormalUserDetails,
  migrateNormalUserDetailsAddressColumns,
  migrateNormalUserDetailsNationalIdUnique,
  migrateExamQuestionBatchColumns,
  migrateExamAttemptsTable,
  migrateExamPortalVisitTable,
  migrateExamPortalBestScoresTable,
  migrateExamPortalParticipantNameColumns,
  migrateBackfillExamPortalBestScores,
  migrateExamPortalAccessPermissions,
  migrateExamResultsPermissions,
  migrateCertificateListPermissions,
  migrateExamQuestionSettingsColumns,
  migrateAdminMessagingTables,
  migrateAdminMessagingPermissions,
  migrateContactFormTimestampsToIstanbul,
];
`,
);

write(
  "config/adminModules.js",
  `${slice(682, 720)}

export { moduleConfig, permissionModules };
`,
);

write(
  "utils/apiTransform.js",
  `${slice(722, 790)}

export { dbToApiMap, apiToDbMap, toApiObject, toDbObject };
`,
);

write(
  "utils/nationalId.js",
  `${slice(793, 817)}

export { isValidTurkishNationalId, NORMAL_USER_GENDER_LABELS, NORMAL_USER_TYPE_LABELS, NORMAL_USER_COUNTRY_LABELS };
`,
);

write(
  "services/users/format.js",
  `import {
  NORMAL_USER_GENDER_LABELS,
  NORMAL_USER_TYPE_LABELS,
  NORMAL_USER_COUNTRY_LABELS,
} from "../../utils/nationalId.js";

${slice(819, 842)}

export { formatNormalUserMeResponse };
`,
);

write(
  "services/education/publicCourses.js",
  `import pool from "../../db/pool.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { sqlTitleSlugTrimmed } from "../../utils/slug.js";

${slice(844, 898)}

${slice(918, 924)}

${slice(926, 963)}

${slice(965, 966)}

${slice(968, 970)}

${slice(972, 1019)}

${slice(1021, 1055)}

${slice(1057, 1069)}

export {
  formatRatingAggregateFields,
  formatPublicCourseInstructor,
  formatPublicCourse,
  loadPublicCategoryOptions,
  EDUCATION_DETAIL_SELECT,
  CALENDAR_DETAIL_SELECT,
  buildEducationCalendarQuery,
  formatPublicCourseRows,
  EDUCATION_LIST_SELECT,
  parseEducationsCatalogQuery,
  queryPublicEducationsList,
  formatEducationReviewRow,
};
`,
);

write(
  "utils/slug.js",
  `${slice(900, 916)}

export { makeSlug, sqlTitleSlugExpr, sqlTitleSlugTrimmed };
`,
);

write(
  "utils/sqlHelpers.js",
  `${slice(2401, 2405)}

export { escapeIlikePattern };
`,
);

write(
  "middleware/auth.js",
  `import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";

${slice(1071, 1115)}

export { auth, userAuth, checkPermission, isAdminMessagingLead, isUuidParam };
`,
);

write(
  "services/activityLog.js",
  `import pool from "../db/pool.js";

${slice(1117, 1132)}

export { writeActivityLog };
`,
);

write(
  "services/instructors.js",
  `import pool from "../db/pool.js";

${slice(1134, 1168)}

export { getRoleCodeById, upsertInstructorByAdminUser, removeInstructorByAdminUserId };
`,
);

write(
  "services/education/content.js",
  `import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { uploadsDir } from "../../config/env.js";
import { normalizeUploadPath } from "./payload.js";

${slice(1170, 1221)}

export { extractEducationContentHtml, extractDocxText };
`,
);

write(
  "services/exam/constants.js",
  `${slice(1223, 1224)}

export { EXAM_MCQ_OPTIONS, EXAM_SECONDS_PER_QUESTION };
`,
);

write(
  "services/exam/engine.js",
  `import { EXAM_MCQ_OPTIONS } from "./constants.js";

${slice(1226, 1333)}

export {
  normalizeCorrectLetter,
  normalizeQuestions,
  normalizeExamQuestionPool,
  shuffleArray,
  pickExamQuestions,
  publicExamQuestion,
  normalizeExamAnswer,
  gradeExamAttempt,
  EXAM_DIFFICULTY_LABELS,
  formatEducationSeviye,
};
`,
);

write(
  "services/exam/portal.js",
  `import pool from "../../db/pool.js";
import { isValidEducationCode } from "../education/payload.js";

${slice(1335, 1359)}

export { upsertExamPortalBestScore };
`,
);

write(
  "services/exam/ai.js",
  `import { GoogleGenAI } from "@google/genai";
import { EXAM_MCQ_OPTIONS } from "./constants.js";
import { normalizeQuestions } from "./engine.js";

${slice(1361, 1528)}

export {
  parseQuestionsFromText,
  fallbackQuestionsFromText,
  getExamAiPrompt,
  parseAiQuestionJson,
  buildExamQuestionsWithGemini,
  buildExamQuestionsWithAi,
};
`,
);

write(
  "services/education/payload.js",
  `${slice(1530, 1595)}

export {
  normalizeUploadPath,
  EDUCATION_CODE_RE,
  normalizeEducationCodeValue,
  isValidEducationCode,
  prepareEducationPayload,
  prepareExamQuestionPayload,
};
`,
);

write(
  "services/education/calendar.js",
  `import pool from "../../db/pool.js";

${slice(1597, 1637)}

export { publishDueEducationCalendarItems };
`,
);

write(
  "services/permissions.js",
  `import pool from "../db/pool.js";
import { permissionModules } from "../config/adminModules.js";

${slice(1639, 1652)}

export { ensurePermissionRows };
`,
);

write(
  "utils/dateRange.js",
  `${slice(3043, 3066)}

export { VALID_DATE_RANGE_PERIODS, parseDateRangePeriod, buildIstanbulDateFilterSql };
`,
);

write(
  "services/exam/adminQueries.js",
  `import pool from "../../db/pool.js";

${slice(3363, 3412)}

export { fetchCertificateRowContext };
`,
);

// ─── Routes: extract route blocks and convert app. → router. ─────────────

function extractRoutes(startLine, endLine) {
  const block = slice(startLine, endLine);
  return block.replace(/^app\./gm, "router.");
}

write(
  "routes/auth.routes.js",
  `import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";
import { auth } from "../middleware/auth.js";
import { writeActivityLog } from "../services/activityLog.js";

const router = Router();

${extractRoutes(1654, 1778)}

export default router;
`,
);

write(
  "routes/users.routes.js",
  `import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { jwtSecret } from "../config/env.js";
import { userAuth } from "../middleware/auth.js";
import { isValidTurkishNationalId } from "../utils/nationalId.js";
import { formatNormalUserMeResponse } from "../services/users/format.js";
import { formatPublicCourse } from "../services/education/publicCourses.js";
import { formatEducationReviewRow, formatRatingAggregateFields } from "../services/education/publicCourses.js";
import { extractEducationContentHtml } from "../services/education/content.js";

const router = Router();

${extractRoutes(1780, 2310)}

export default router;
`,
);

write(
  "routes/public/contact.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { verifyRecaptchaV2IfConfigured } from "../../utils/recaptcha.js";

const router = Router();

${extractRoutes(2312, 2362)}

export default router;
`,
);

write(
  "routes/public/education.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { escapeIlikePattern } from "../../utils/sqlHelpers.js";
import { sqlTitleSlugTrimmed } from "../../utils/slug.js";
import {
  formatEducationReviewRow,
  formatPublicCourse,
  formatPublicCourseRows,
  buildEducationCalendarQuery,
  loadPublicCategoryOptions,
  queryPublicEducationsList,
  EDUCATION_LIST_SELECT,
  EDUCATION_DETAIL_SELECT,
  CALENDAR_DETAIL_SELECT,
} from "../../services/education/publicCourses.js";
import { extractEducationContentHtml } from "../../services/education/content.js";

const router = Router();

${extractRoutes(2364, 2399)}

${extractRoutes(2408, 2447)}

${extractRoutes(2694, 2847)}

export default router;
`,
);

write(
  "routes/public/examPortal.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { verifyExamPortalLink } from "../../examPortalLinkToken.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { EXAM_PORTAL_MAX_STARTS } from "../../db/migrations/index.js";
import {
  normalizeExamQuestionPool,
  pickExamQuestions,
  publicExamQuestion,
  gradeExamAttempt,
} from "../../services/exam/engine.js";
import { EXAM_SECONDS_PER_QUESTION } from "../../services/exam/constants.js";
import { upsertExamPortalBestScore } from "../../services/exam/portal.js";

const router = Router();

${extractRoutes(2449, 2692)}

export default router;
`,
);

write(
  "routes/admin/uploads.routes.js",
  `import { Router } from "express";
import path from "path";
import { auth } from "../../middleware/auth.js";
import { upload, uploadDoc } from "../../middleware/upload.js";
import { extractDocxText } from "../../services/education/content.js";
import { buildExamQuestionsWithAi } from "../../services/exam/ai.js";

const router = Router();

${extractRoutes(2849, 2914)}

export default router;
`,
);

write(
  "routes/admin/bootstrap.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { checkPermission } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { ensurePermissionRows } from "../../services/permissions.js";

const router = Router();

${extractRoutes(2916, 3041)}

export default router;
`,
);

write(
  "routes/admin/exam.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { toApiObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";
import { EXAM_PORTAL_MAX_STARTS } from "../../db/migrations/index.js";
import { parseDateRangePeriod, buildIstanbulDateFilterSql } from "../../utils/dateRange.js";
import { normalizeEducationCodeValue, isValidEducationCode } from "../../services/education/payload.js";
import { signExamPortalLink } from "../../examPortalLinkToken.js";
import { fetchCertificateRowContext } from "../../services/exam/adminQueries.js";

const router = Router();

${extractRoutes(3068, 3361)}

${extractRoutes(3414, 3541)}

export default router;
`,
);

write(
  "routes/admin/messaging.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isAdminMessagingLead, isUuidParam } from "../../middleware/auth.js";

const router = Router();

${extractRoutes(3543, 3896)}

export default router;
`,
);

write(
  "routes/admin/crud.routes.js",
  `import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../../db/pool.js";
import { auth } from "../../middleware/auth.js";
import { moduleConfig } from "../../config/adminModules.js";
import { toApiObject, toDbObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";
import { getRoleCodeById, upsertInstructorByAdminUser, removeInstructorByAdminUserId } from "../../services/instructors.js";
import { extractEducationContentHtml } from "../../services/education/content.js";
import { prepareEducationPayload, prepareExamQuestionPayload } from "../../services/education/payload.js";

const router = Router();

${extractRoutes(3898, 4223)}

export default router;
`,
);

write(
  "routes/admin/permissions.routes.js",
  `import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission } from "../../middleware/auth.js";
import { toApiObject, toDbObject } from "../../utils/apiTransform.js";
import { writeActivityLog } from "../../services/activityLog.js";

const router = Router();

${extractRoutes(4225, 4241)}

export default router;
`,
);

write(
  "routes/health.routes.js",
  `import { Router } from "express";

const router = Router();

${extractRoutes(96, 99)}

export default router;
`,
);

write(
  "middleware/errorHandler.js",
  `import pool from "../db/pool.js";

${slice(4243, 4262)}

export default function errorHandler(error, req, res, next) {
  return handler(error, req, res, next);
}

const handler = async (error, req, res, next) => {
  try {
    await pool.query(
      \`INSERT INTO error_logs (admin_user_id, route, method, message, stack, payload)
       VALUES ($1,$2,$3,$4,$5,$6)\`,
      [
        req.user?.id || null,
        req.originalUrl,
        req.method,
        error.message || "Unknown error",
        error.stack || null,
        req.body ? JSON.stringify(req.body) : null,
      ],
    );
  } catch {
    // no-op
  }
  res.status(500).json({ message: "Sunucu hatası.", detail: error.message });
  next();
};
`,
);

// Fix error handler - the slice approach duplicated. Rewrite cleanly:
write(
  "middleware/errorHandler.js",
  `import pool from "../db/pool.js";

export default async function errorHandler(error, req, res, next) {
  try {
    await pool.query(
      \`INSERT INTO error_logs (admin_user_id, route, method, message, stack, payload)
       VALUES ($1,$2,$3,$4,$5,$6)\`,
      [
        req.user?.id || null,
        req.originalUrl,
        req.method,
        error.message || "Unknown error",
        error.stack || null,
        req.body ? JSON.stringify(req.body) : null,
      ],
    );
  } catch {
    // no-op
  }
  res.status(500).json({ message: "Sunucu hatası.", detail: error.message });
  next();
}
`,
);

write(
  "routes/index.js",
  `import healthRoutes from "./health.routes.js";
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
`,
);

write(
  "app.js",
  `import "dotenv/config";
import express from "express";
import cors from "cors";
import { uploadsDir } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

registerRoutes(app);

app.use(errorHandler);

export default app;
`,
);

write(
  "server.js",
  `import app from "./app.js";
import { port } from "./config/env.js";
import { migrations } from "./db/migrations/index.js";
import { publishDueEducationCalendarItems } from "./services/education/calendar.js";

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("uncaughtException:", err);
  process.exit(1);
});

const startServer = async () => {
  for (const run of migrations) {
    try {
      await run();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(\`Migration \${run.name} skipped:\`, error.message);
    }
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console

  });
  await publishDueEducationCalendarItems();
  setInterval(publishDueEducationCalendarItems, 60 * 1000);
};

startServer();
`,
);
