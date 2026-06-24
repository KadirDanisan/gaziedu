import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { uploadsDir } from "../../config/env.js";
import { normalizeUploadPath } from "./payload.js";

const extractEducationContentHtml = async (contentDocPath) => {
  if (!contentDocPath) return "";
  const rawPath = String(contentDocPath);
  const candidates = new Set();
  const asBasename = path.basename(rawPath);
  if (asBasename) {
    candidates.add(path.join(uploadsDir, asBasename));
  }
  if (rawPath.startsWith("/uploads/")) {
    candidates.add(path.join(uploadsDir, rawPath.replace(/^\/uploads\//, "")));
  }
  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const parsed = new URL(rawPath);
      if (parsed.pathname.startsWith("/uploads/")) {
        candidates.add(path.join(uploadsDir, parsed.pathname.replace(/^\/uploads\//, "")));
      } else if (parsed.pathname.includes("/uploads/")) {
        const fileName = parsed.pathname.split("/uploads/").pop();
        if (fileName) candidates.add(path.join(uploadsDir, fileName));
      }
    } catch {
      // ignore malformed url
    }
  }
  if (path.isAbsolute(rawPath)) {
    candidates.add(rawPath);
  }

  const absolutePath = Array.from(candidates).find((candidate) => fs.existsSync(candidate));
  if (!absolutePath) return "";

  const buffer = fs.readFileSync(absolutePath);
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.inline(async (element) => {
        const buffer = await element.read("base64");
        return { src: `data:${element.contentType};base64,${buffer}` };
      }),
    },
  );
  return result.value || "";
};

const extractDocxText = async (docPath) => {
  if (!docPath) return "";
  const normalized = normalizeUploadPath(docPath);
  const absolutePath = path.join(uploadsDir, path.basename(normalized));
  if (!fs.existsSync(absolutePath)) return "";
  const result = await mammoth.extractRawText({ path: absolutePath });
  return result.value || "";
};

export { extractEducationContentHtml, extractDocxText };
