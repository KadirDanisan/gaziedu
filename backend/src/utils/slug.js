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

const sqlTitleSlugExpr = (column) =>
  `regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(translate(${column}, 'İI', 'ii')), 'ğ', 'g', 'g'), 'ü', 'u', 'g'), 'ş', 's', 'g'), 'ı', 'i', 'g'), 'ö', 'o', 'g'), 'ç', 'c', 'g'), '[^a-z0-9]+', '-', 'g')`;

const sqlTitleSlugTrimmed = (column) =>
  `regexp_replace(regexp_replace(${sqlTitleSlugExpr(column)}, '^-+', ''), '-+$', '')`;

export { makeSlug, sqlTitleSlugExpr, sqlTitleSlugTrimmed };
