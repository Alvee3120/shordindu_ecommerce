// Shared status/payment badge. Extracted from the per-page statusColors maps
// that used to be duplicated across the dashboard.

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  // product statuses (Product.status: draft / active / archived)
  active: "bg-emerald-100 text-emerald-700",
  draft: "bg-neutral-100 text-neutral-600",
  archived: "bg-neutral-100 text-neutral-500",
};

const PAYMENT_STYLES = {
  unpaid: "bg-neutral-100 text-neutral-600",
  paid: "bg-emerald-100 text-emerald-700",
  refunded: "bg-orange-100 text-orange-700",
};

export default function StatusBadge({ value, type = "status", className = "" }) {
  if (!value) return <span className="text-neutral-400">—</span>;
  const styles = type === "payment" ? PAYMENT_STYLES : STATUS_STYLES;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[value] || "bg-neutral-100 text-neutral-600"
      } ${className}`}
    >
      {value}
    </span>
  );
}
