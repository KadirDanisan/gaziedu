import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SITE_URL = (process.env.SITE_URL || "https://uzaktan.gazi.edu.tr").replace(/\/+$/, "");
const API_URL = (process.env.SITEMAP_API_URL || `${SITE_URL}/api`).replace(/\/+$/, "");
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/tum-egitimler", changefreq: "daily", priority: "0.9" },
  { loc: "/egitim-takvimi", changefreq: "daily", priority: "0.8" },
  { loc: "/hakkimizda", changefreq: "monthly", priority: "0.6" },
  { loc: "/kurumsal-egitim-cozumleri", changefreq: "monthly", priority: "0.6" },
  { loc: "/iletisim", changefreq: "monthly", priority: "0.5" },
  { loc: "/kvkk-aydinlatma-metni", changefreq: "yearly", priority: "0.3" },
  { loc: "/kullanim-kurallari-ve-gizlilik", changefreq: "yearly", priority: "0.3" },
];

/** Frontend'deki makeSlug ile aynı olmalı; detay linkleri bu slug ile açılır. */
const makeSlug = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function fetchCourseSlugs() {
  const slugs = new Set();
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetch(`${API_URL}/public/all-trainings?page=${page}&pageSize=50`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    (data.courses || []).forEach((course) => {
      const slug = makeSlug(course.title);
      if (slug) slugs.add(slug);
    });
    totalPages = Number(data.pagination?.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);
  return [...slugs];
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  let courseSlugs = [];
  try {
    courseSlugs = await fetchCourseSlugs();
    console.log(`[sitemap] ${courseSlugs.length} eğitim detay sayfası eklendi.`);
  } catch (error) {
    console.warn(`[sitemap] Eğitimler alınamadı (${error.message}); yalnızca sabit sayfalar yazılıyor.`);
  }

  const entries = [
    ...STATIC_PAGES,
    ...courseSlugs.map((slug) => ({ loc: `/egitim-detay/${slug}`, changefreq: "weekly", priority: "0.7" })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ({ loc, changefreq, priority }) =>
        `  <url><loc>${escapeXml(`${SITE_URL}${loc}`)}</loc><lastmod>${today}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(path.join(publicDir, "sitemap.xml"), xml, "utf8");
  console.log(`[sitemap] public/sitemap.xml (${entries.length} URL) yazıldı.`);
}

main();
