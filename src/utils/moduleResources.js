const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export const MODULE_RESOURCE_KINDS = ["text", "pdf", "video"];

/** Eski/bozuk kayıtlarda ModÃ¼l → Modül gibi düzeltme. */
export function fixUploadedFileName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  if (!/[ÃÄÅâ€]/.test(raw)) return raw;
  try {
    const bytes = new Uint8Array([...raw].map((ch) => ch.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder("utf-8").decode(bytes);
    if (fixed && !fixed.includes("\uFFFD")) return fixed;
  } catch {
    /* ignore */
  }
  return raw;
}

export function resolveAssetUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_ORIGIN}${raw}`;
  return `${API_ORIGIN}/${raw}`;
}

/** Video bloğu ya yüklenen dosyayı ya da YouTube/Vimeo bağlantısını taşır. */
export function resolveResourceSource(resource) {
  return resolveAssetUrl(resource?.path || resource?.url || "");
}

function youtubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function vimeoId(url) {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : "";
}

/**
 * @returns {{ type: "embed" | "file" | "link" | "none", src: string }}
 */
export function describeVideoSource(resource) {
  const uploaded = String(resource?.path ?? "").trim();
  if (uploaded) return { type: "file", src: resolveAssetUrl(uploaded) };

  const url = String(resource?.url ?? "").trim();
  if (!url) return { type: "none", src: "" };

  const yt = youtubeId(url);
  if (yt) return { type: "embed", src: `https://www.youtube.com/embed/${yt}` };

  const vimeo = vimeoId(url);
  if (vimeo) return { type: "embed", src: `https://player.vimeo.com/video/${vimeo}` };

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) return { type: "file", src: url };

  return { type: "link", src: url };
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function resourceKindLabel(kind) {
  if (kind === "pdf") return "Doküman";
  if (kind === "video") return "Video";
  return "Metin";
}

export function resourceIconClass(kind) {
  if (kind === "pdf") return "fa-regular fa-file-pdf";
  if (kind === "video") return "fa-solid fa-play";
  return "fa-regular fa-file-lines";
}

export function countResourcesByKind(resources = []) {
  const list = Array.isArray(resources) ? resources : [];
  return list.reduce(
    (acc, item) => {
      const kind = item?.kind;
      if (kind === "video") acc.video += 1;
      else if (kind === "pdf") acc.pdf += 1;
      else acc.text += 1;
      return acc;
    },
    { video: 0, pdf: 0, text: 0 },
  );
}
