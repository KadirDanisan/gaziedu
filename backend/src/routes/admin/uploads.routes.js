import { Router } from "express";
import path from "path";
import { auth } from "../../middleware/auth.js";
import { upload, uploadDoc } from "../../middleware/upload.js";
import { extractDocxText } from "../../services/education/content.js";
import { buildExamQuestionsWithAi } from "../../services/exam/ai.js";

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
    const { mode } = req.body || {};
    const extension = path.extname(req.file.originalname || "").toLowerCase();
    if (extension !== ".docx") return res.status(400).json({ message: "Sadece .docx dosyası yüklenebilir." });
    if (mode !== "generate" && mode !== "classify") return res.status(400).json({ message: "Geçersiz işlem tipi." });
    const targetDifficulty = String(req.body?.targetDifficulty || "medium").toLowerCase();
    if (!["easy", "medium", "hard"].includes(targetDifficulty)) {
      return res.status(400).json({ message: "Zorluk kolay, orta veya zor olmalıdır." });
    }
    const poolQuestionCount = Math.min(300, Math.max(5, parseInt(req.body?.poolQuestionCount ?? "60", 10) || 60));
    const docPath = `/uploads/${req.file.filename}`;
    const text = await extractDocxText(docPath);
    const questions = await buildExamQuestionsWithAi({ text, mode, targetDifficulty, poolQuestionCount });
    return res.status(201).json({
      fileName: req.file.originalname,
      path: docPath,
      url: `${req.protocol}://${req.get("host")}${docPath}`,
      questions,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
