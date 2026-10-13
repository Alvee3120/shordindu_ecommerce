// Formatting helpers for the analytics dashboard. Money is BDT, matching the
// rest of the storefront (which renders the ৳ glyph inline).

export function formatBDT(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "৳0";
  const formatted = Number.isInteger(number)
    ? number.toLocaleString("en-US")
    : number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `৳${formatted}`;
}

export function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "0";
}

/** Formats a percentage change, e.g. 12.3 -> "+12.3%". Returns null when unknown. */
export function formatChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
