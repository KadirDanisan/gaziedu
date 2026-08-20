import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const runFfmpeg = (args, { timeoutMs = 30 * 60 * 1000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg zaman aşımına uğradı."));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg çıktı kodu: ${code}`));
    });
  });

/**
 * Tarayıcıların metadata'yı dosya başından okuyabilmesi için moov atomunu öne alır.
 * Yeniden encode etmez (-c copy). ffmpeg yoksa veya işlem başarısızsa orijinal dosya kalır.
 */
const optimizeVideoForStreaming = async (absolutePath) => {
  const inputPath = path.resolve(absolutePath);
  const ext = path.extname(inputPath).toLowerCase() || ".mp4";
  const tempPath = `${inputPath}.faststart${ext === ".mp4" ? ".mp4" : ext}`;

  try {
    await fs.access(inputPath);
  } catch {
    return { ok: false, reason: "missing", size: 0 };
  }

  try {
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      tempPath,
    ]);

    const stat = await fs.stat(tempPath);
    if (!stat.size) {
      await fs.unlink(tempPath).catch(() => {});
      return { ok: false, reason: "empty-output", size: 0 };
    }

    await fs.rename(tempPath, inputPath);
    return { ok: true, size: stat.size };
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    const missing = error?.code === "ENOENT";
    // eslint-disable-next-line no-console
    console.warn(
      missing
        ? "ffmpeg bulunamadı; video faststart olmadan kaydedildi. Sunucuya `sudo apt install -y ffmpeg` kurun."
        : `Video faststart uygulanamadı (${error.message}); orijinal dosya kullanılıyor.`,
    );
    const stat = await fs.stat(inputPath).catch(() => null);
    return { ok: false, reason: missing ? "ffmpeg-missing" : "ffmpeg-failed", size: stat?.size || 0 };
  }
};

export { optimizeVideoForStreaming };
