"use client";

import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatBDT, formatDateTime } from "@/lib/format";

export function formatCouponValue(coupon) {
  return coupon.type === "percent" ? `${Number(coupon.value)}%` : formatBDT(coupon.value);
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/** Read-only coupon details — shown to both admins and CCE users. */
export default function CouponDetailModal({ coupon, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-neutral-900">{coupon.code}</h2>
            <StatusBadge value={coupon.status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={18} />
          </button>
        </div>
        <dl className="divide-y divide-neutral-100 px-5 py-2">
          <Row label="Code">{coupon.code}</Row>
          <Row label="Type">
            <span className="capitalize">{coupon.type}</span>
          </Row>
          <Row label="Amount">{formatCouponValue(coupon)}</Row>
          <Row label="Min order amount">{formatBDT(coupon.min_order_amount)}</Row>
          <Row label="Starts at">{coupon.starts_at ? formatDateTime(coupon.starts_at) : "Immediately"}</Row>
          <Row label="Expires at">{coupon.ends_at ? formatDateTime(coupon.ends_at) : "Never"}</Row>
          <Row label="Status">
            <StatusBadge value={coupon.status} />
          </Row>
          <Row label="Total usage limit">{coupon.usage_limit ?? "Unlimited"}</Row>
          <Row label="Current usage">{coupon.usage_count}</Row>
        </dl>
        <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          Applies to the whole order subtotal. Status is derived from the start/expiry dates and usage limit.
        </p>
      </div>
    </div>
  );
}
