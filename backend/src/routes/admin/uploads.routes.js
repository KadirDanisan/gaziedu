import { Router } from "express";
import path from "path";
import { auth } from "../../middleware/auth.js";
import { upload, uploadDoc, uploadModuleFile, uploadModuleVideo } from "../../middleware/upload.js";
import { parseExamQuestionsFromDocx } from "../../services/exam/docxTable.js";
import { uploadsDir } from "../../config/env.js";
import { fixUploadedFileName } from "../../utils/fileName.js";
import { optimizeVideoForStreaming } from "../../utils/optimizeVideo.js";

const router = Router();

router.post("/api/admin/uploads/institution-logo", auth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    }
    const publicPath = `/uploads/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get("host")}${publicPath}`;
    return res.status(201).json({ url: fileUrl, path: publicPath });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/uploads/education-image", auth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    }
    const publicPath = `/uploads/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get("host")}${publicPath}`;
    return res.status(201).json({ url: fileUrl, path: publicPath });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/uploads/education-content-doc", auth, uploadDoc.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    if (extension !== ".docx") return res.status(400).json({ message: "Sadece .docx dosyası yüklenebilir." });
    return res.status(201).json({
      fileName: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/uploads/exam-doc", auth, uploadDoc.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    if (extension !== ".docx") return res.status(400).json({ message: "Sadece .docx dosyası yüklenebilir." });
    const docPath = `/uploads/${req.file.filename}`;
    const questions = await parseExamQuestionsFromDocx(docPath);
    const questionCount = questions.medium.length;
    return res.status(201).json({
      fileName: req.file.originalname,
      path: docPath,
      url: `${req.protocol}://${req.get("host")}${docPath}`,
      questions,
      questionCount,
    });
  } catch (error) {
    return next(error);
  }
});

const respondWithModuleAsset = (req, res, { size } = {}) => {
  if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
  const publicPath = `/uploads/${req.file.filename}`;
  return res.status(201).json({
    fileName: fixUploadedFileName(req.file.originalname),
    size: Number.isFinite(size) && size > 0 ? size : req.file.size,
    path: publicPath,
    url: `${req.protocol}://${req.get("host")}${publicPath}`,
  });
};

router.post("/api/admin/uploads/education-module-file", auth, uploadModuleFile.single("file"), (req, res, next) => {
  try {
    return respondWithModuleAsset(req, res);
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/uploads/education-module-video", auth, uploadModuleVideo.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Yüklenecek dosya bulunamadı." });
    const absolutePath = path.join(uploadsDir, req.file.filename);
    const optimized = await optimizeVideoForStreaming(absolutePath);
    return respondWithModuleAsset(req, res, { size: optimized.size || req.file.size });
  } catch (error) {
    return next(error);
  }
});

export default router;
