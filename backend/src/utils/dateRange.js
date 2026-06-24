const VALID_DATE_RANGE_PERIODS = new Set(["today", "week", "month", "year", "all"]);

const parseDateRangePeriod = (raw) => {
  const period = String(raw || "all").trim().toLowerCase();
  return VALID_DATE_RANGE_PERIODS.has(period) ? period : "all";
};

const buildIstanbulDateFilterSql = (columnSql, period) => {
  if (!period || period === "all") return "";
  const tz = "Europe/Istanbul";
  if (period === "today") {
    return ` AND ${columnSql} >= ((NOW() AT TIME ZONE '${tz}')::date) AT TIME ZONE '${tz}' AND ${columnSql} < (((NOW() AT TIME ZONE '${tz}')::date + INTERVAL '1 day')) AT TIME ZONE '${tz}'`;
  }
  if (period === "week") {
    return ` AND ${columnSql} >= (((NOW() AT TIME ZONE '${tz}')::date - INTERVAL '6 days')) AT TIME ZONE '${tz}'`;
  }
  if (period === "month") {
    return ` AND ${columnSql} >= (date_trunc('month', NOW() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`;
  }
  if (period === "year") {
    return ` AND ${columnSql} >= (date_trunc('year', NOW() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`;
  }
  return "";
};

export { VALID_DATE_RANGE_PERIODS, parseDateRangePeriod, buildIstanbulDateFilterSql };
