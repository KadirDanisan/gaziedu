const escapeIlikePattern = (raw) =>
  String(raw || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

export { escapeIlikePattern };
