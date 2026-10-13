"use client";

import { FiArrowDown, FiArrowUp, FiInfo, FiMinus } from "react-icons/fi";
import { formatChange } from "@/lib/format";

function Trend({ changePct }) {
  if (changePct === undefined) return null;
  const change = formatChange(changePct);
  if (change === null) {
    return <span className="text-xs text-neutral-400">No prior data</span>;
  }
  const isUp = changePct > 0;
  const isFlat = changePct === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isFlat ? "text-neutral-500" : isUp ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {isFlat ? <FiMinus size={12} /> : isUp ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
      {change}
      <span className="font-normal text-neutral-400">vs prev.</span>
    </span>
  );
}

export default function KpiCard({ label, value, icon: Icon, changePct, tooltip, loading = false }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--primary)/10 text-(--primary)">
            <Icon size={16} />
          </div>
        ) : (
          <span />
        )}
        {tooltip && (
          <span className="group relative inline-flex">
            <FiInfo size={14} className="text-neutral-300" />
            <span className="pointer-events-none absolute right-0 top-6 z-20 hidden w-52 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg group-hover:block">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{loading ? "—" : value}</p>
      <div className="mt-1 min-h-[1.25rem]">
        {!loading && <Trend changePct={changePct} />}
      </div>
    </div>
  );
}
