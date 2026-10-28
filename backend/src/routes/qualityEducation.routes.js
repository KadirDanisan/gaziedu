import { Router } from "express";
import path from "node:path";
import pool from "../db/pool.js";
import { uploadsDir } from "../config/env.js";
import { qualityAuth, isUuidParam } from "../middleware/auth.js";
import {
  authenticateQualityIdentity,
  signQualityToken,
  upsertQualityIdentity,
} from "../services/quality/identity.js";
import {
  QUALITY_FILTER,
  loadQualityCourseState,
  saveQualityVideoProgress,
} from "../services/quality/progress.js";
import { loadEducationModules } from "../services/education/modules.js";
import { formatPublicCourse } from "../services/education/publicCourses.js";
import { signExamPortalLink } from "../examPortalLinkToken.js";
import { isValidTurkishNationalId } from "../utils/nationalId.js";

const router = Router();

const formatQualityCourse = (row) =>
  formatPublicCourse({
    ...row,
    source_type: "education",
    instructor_info: null,
    calendar_date: null,
  });

router.get("/api/quality/auth/status", (req, res) => {
  res.json({
    ldapConfigured: String(process.env.QUALITY_LDAP_DEV_BYPASS || "").toLowerCase() === "true",
    provider: String(process.env.QUALITY_LDAP_DEV_BYPASS || "").toLowerCase() === "true" ? "development" : "gazi-ldap",
  });
});

router.post("/api/quality/auth/login", async (req, res, next) => {
  try {
    const identity = await authenticateQualityIdentity(req.body || {});
    await upsertQualityIdentity(identity);
    const token = signQualityToken(identity);
    return res.json({
      token,
      user: {
        subject: identity.subject,
        username: identity.username,
        displayName: identity.displayName,
        email: identity.email,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return next(error);
  }
});

router.get("/api/quality/me", qualityAuth, (req, res) => {
  const user = req.qualityUser;
  return res.json({
    subject: user.ldapSubject,
    username: user.username || "",
    displayName: user.displayName || user.username || "",
    email: user.email || "",
  });
});

router.get("/api/quality/courses", qualityAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, i.name AS institution_name,
              i.logo_url AS institution_logo_url, i.website_url AS institution_website_url,
              ins.first_name AS instructor_first_name, ins.last_name AS instructor_last_name,
              ins.title AS instructor_title, ins.department AS instructor_department,
              ins.about AS instructor_about, ins.email AS instructor_email,
              ins.image_url AS instructor_image_url
       FROM educations e
       LEFT JOIN education_categories c ON c.id = e.category_id
       LEFT JOIN institutions i ON i.id = e.institution_id
       LEFT JOIN instructors ins ON ins.id = e.instructor_id
       WHERE e.sales_filter = $1
       ORDER BY e.created_at DESC`,
      [QUALITY_FILTER],
    );
    const courses = await Promise.all(
      result.rows.map(async (row) => {
        const state = await loadQualityCourseState(req.qualityUser.ldapSubject, row.id);
        return {
          ...formatQualityCourse(row),
          completionPercent: state?.completionPercent || 0,
          completedVideoCount: state?.completedVideoCount || 0,
          videoCount: state?.videoCount || 0,
          examUnlocked: Boolean(state?.examUnlocked),
        };
      }),
    );
    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/quality/courses/:educationId", qualityAuth, async (req, res, next) => {
  try {
    const educationId = String(req.params.educationId || "").trim();
    if (!isUuidParam(educationId)) return res.status(400).json({ message: "Geçersiz eğitim." });
    const state = await loadQualityCourseState(req.qualityUser.ldapSubject, educationId);
    if (!state) return res.status(404).json({ message: "Kalite Eğitimi bulunamadı." });
    return res.json({
      course: formatQualityCourse(state.education),
      modules: state.modules,
      videoCount: state.videoCount,
      completedVideoCount: state.completedVideoCount,
      completionPercent: state.completionPercent,
      examUnlocked: state.examUnlocked,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/quality/media/:moduleId/:resourceId", qualityAuth, async (req, res, next) => {
  try {
    const moduleId = String(req.params.moduleId || "").trim();
    const resourceId = String(req.params.resourceId || "").trim();
    if (!isUuidParam(moduleId) || !isUuidParam(resourceId)) {
      return res.status(400).json({ message: "Geçersiz içerik." });
    }
    const result = await pool.query(
      `SELECT em.education_id
       FROM education_modules em
       JOIN educations e ON e.id = em.education_id
       WHERE em.id = $1 AND e.sales_filter = $2
       LIMIT 1`,
      [moduleId, QUALITY_FILTER],
    );
    const educationId = result.rows[0]?.education_id;
    if (!educationId) return res.status(404).json({ message: "İçerik dosyası bulunamadı." });
    const modules = await loadEducationModules(educationId);
    const resources = modules.find((item) => String(item.id) === moduleId)?.resources || [];
    const resource = resources.find((item) => String(item?.id) === resourceId);
    const storedPath = String(resource?.path || "").trim();
    if (!resource || !storedPath || !storedPath.includes("/uploads/")) {
      return res.status(404).json({ message: "İçerik dosyası bulunamadı." });
    }
    const fileName = path.basename(new URL(storedPath, "http://local").pathname);
    if (!fileName) return res.status(404).json({ message: "İçerik dosyası bulunamadı." });
    return res.sendFile(fileName, { root: uploadsDir });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/quality/courses/:educationId/progress", qualityAuth, async (req, res, next) => {
  try {
    const educationId = String(req.params.educationId || "").trim();
    const moduleId = String(req.body?.moduleId || "").trim();
    const resourceId = String(req.body?.resourceId || "").trim();
    if (!isUuidParam(educationId) || !isUuidParam(moduleId) || !isUuidParam(resourceId)) {
      return res.status(400).json({ message: "Geçersiz eğitim, modül veya içerik." });
    }
    const state = await saveQualityVideoProgress({
      ldapSubject: req.qualityUser.ldapSubject,
      educationId,
      moduleId,
      resourceId,
      resourceIndex: req.body?.resourceIndex,
      positionSeconds: req.body?.positionSeconds,
      durationSeconds: req.body?.durationSeconds,
      watchedFromSeconds: req.body?.watchedFromSeconds,
      watchedToSeconds: req.body?.watchedToSeconds,
    });
    return res.json({
      modules: state.modules,
      videoCount: state.videoCount,
      completedVideoCount: state.completedVideoCount,
      completionPercent: state.completionPercent,
      examUnlocked: state.examUnlocked,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return next(error);
  }
});

router.post("/api/quality/courses/:educationId/exam-link", qualityAuth, async (req, res, next) => {
  try {
    const educationId = String(req.params.educationId || "").trim();
    if (!isUuidParam(educationId)) return res.status(400).json({ message: "Geçersiz eğitim." });
    const state = await loadQualityCourseState(req.qualityUser.ldapSubject, educationId);
    if (!state) return res.status(404).json({ message: "Kalite Eğitimi bulunamadı." });
    if (!state.examUnlocked) {
      return res.status(403).json({
        message: "Değerlendirme sınavı için tüm videoların en az %90 izlenmesi gerekir.",
        code: "QUALITY_EXAM_LOCKED",
      });
    }

    const nationalId = String(req.qualityUser.nationalId || "").replace(/\D/g, "");
    if (!isValidTurkishNationalId(nationalId)) {
      return res.status(400).json({
        message: "LDAP kaydında geçerli T.C. kimlik numarası bulunamadı. LDAP öznitelik eşlemesi tamamlanmalıdır.",
        code: "QUALITY_LDAP_NATIONAL_ID_MISSING",
      });
    }
    const participantName = String(req.qualityUser.displayName || req.qualityUser.username || "").trim();
    const token = signExamPortalLink({
      educationCode: state.education.code,
      nationalId,
      participantName,
      qualityEducationId: state.education.id,
      qualityLdapSubject: req.qualityUser.ldapSubject,
    }, { expiresIn: "8h" });
    return res.json({
      portalToken: token,
      path: `/sinavportali/${encodeURIComponent(token)}`,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
