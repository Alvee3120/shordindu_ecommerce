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

/**
 * Human-readable age from a server-provided duration in seconds. The dashboard
 * always uses the backend's age_seconds so the browser clock is never the
 * source of truth for the 6-hour rule.
 */
export function formatAge(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "—";
  if (total < 60) return "just now";

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
