"use client";

import { FiArrowDown, FiArrowUp, FiMinus } from "react-icons/fi";
import { formatChange } from "@/lib/format";

function ChangeHint({ value }) {
  const change = formatChange(value);
  if (change === null) return null;
  const isFlat = value === 0;
  const isUp = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
        isFlat ? "text-neutral-400" : isUp ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {isFlat ? <FiMinus size={10} /> : isUp ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />}
      {change}
    </span>
  );
}

/**
 * Compact one-line summary of secondary metrics — used instead of a grid of
 * individual cards. `title` carries the metric definition tooltip.
 */
export default function InlineStats({ items, className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 ${className}`}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5" title={item.tooltip || undefined}>
          <span className="text-xs text-neutral-500">{item.label}</span>
          <span className="text-sm font-semibold text-neutral-900">{item.value}</span>
          {item.changePct !== undefined && <ChangeHint value={item.changePct} />}
        </div>
      ))}
    </div>
  );
}
