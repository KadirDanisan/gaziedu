import { DATE_RANGE_PERIODS } from "../utils/dateRangePeriod";

export default function AdminDateRangeFilter({ value, onChange, disabled = false }) {
  return (
    <div className="admin-date-range" role="group" aria-label="Tarih aralığı">
      {DATE_RANGE_PERIODS.map((period) => (
        <button
          key={period.key}
          type="button"
          className={`admin-date-range__btn ${value === period.key ? "is-active" : ""}`}
          disabled={disabled}
          aria-pressed={value === period.key}
          onClick={() => onChange(period.key)}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
