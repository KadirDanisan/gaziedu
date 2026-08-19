import multer from "multer";
import path from "path";
import { uploadsDir } from "../config/env.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".png";
    cb(null, `institution-logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Sadece görsel dosyaları yüklenebilir."));
  },
});

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `education-content-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".docx"}`);
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const moduleAssetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `education-module-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const MODULE_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip"];

const uploadModuleFile = multer({
  storage: moduleAssetStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (MODULE_FILE_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error("Yalnızca PDF, Office veya ZIP dosyaları yüklenebilir."));
  },
});

const uploadModuleVideo = multer({
  storage: moduleAssetStorage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Sadece video dosyaları yüklenebilir."));
  },
});

export { upload, uploadDoc, uploadModuleFile, uploadModuleVideo, MODULE_FILE_EXTENSIONS };
