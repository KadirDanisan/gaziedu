/** node-pg JS dizilerini PG array sanır; JSONB için JSON metni + ::jsonb gerekir. */
const JSONB_COLUMNS = new Set([
  "topic_headings",
  "generated_questions",
  "selected_questions",
  "answers",
  "old_data",
  "new_data",
]);

function bindJsonbValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "[]";
    return trimmed;
  }
  return JSON.stringify(value);
}

function isJsonbColumn(key) {
  return JSONB_COLUMNS.has(key);
}

function buildInsertSql(table, payload) {
  const keys = Object.keys(payload);
  const placeholders = keys
    .map((key, index) => (isJsonbColumn(key) ? `$${index + 1}::jsonb` : `$${index + 1}`))
    .join(", ");
  const values = keys.map((key) => (isJsonbColumn(key) ? bindJsonbValue(payload[key]) : payload[key]));
  const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
  return { sql, values };
}

function buildUpdateSql(table, payload, id) {
  const keys = Object.keys(payload).filter((k) => k !== "id");
  const setSql = keys
    .map((key, index) => `${key} = ${isJsonbColumn(key) ? `$${index + 1}::jsonb` : `$${index + 1}`}`)
    .join(", ");
  const values = keys.map((key) => (isJsonbColumn(key) ? bindJsonbValue(payload[key]) : payload[key]));
  const idIndex = keys.length + 1;
  const sql = `UPDATE ${table} SET ${setSql}, updated_at = NOW() WHERE id = $${idIndex} RETURNING *`;
  return { sql, values: [...values, id] };
}

export { JSONB_COLUMNS, bindJsonbValue, isJsonbColumn, buildInsertSql, buildUpdateSql };
