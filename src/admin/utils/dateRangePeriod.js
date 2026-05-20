export const DATE_RANGE_PERIODS = [
  { key: "today", label: "Bugün" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "year", label: "Bu Yıl" },
  { key: "all", label: "Tümü" },
];

export const DEFAULT_DATE_RANGE_PERIOD = "all";

export function isValidDateRangePeriod(value) {
  return DATE_RANGE_PERIODS.some((p) => p.key === value);
}
