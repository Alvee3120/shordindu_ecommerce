"use client";

import { formatChange } from "@/lib/format";

const identity = (value) => value;

/**
 * Absolute and percentage differences between the selected period and the
 * previous equivalent one. `items` = [{ label, current, previous, changePct, format }].
 */
export default function PeriodComparisonTable({
  items,
  currentLabel = "Selected period",
  previousLabel = "Previous period",
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th className="px-4 py-3 font-medium">Metric</th>
            <th className="px-4 py-3 font-medium">{currentLabel}</th>
            <th className="px-4 py-3 font-medium">{previousLabel}</th>
            <th className="px-4 py-3 font-medium">Change</th>
            <th className="px-4 py-3 font-medium">Change %</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const format = item.format || identity;
            const current = Number(item.current ?? 0);
            const previous = Number(item.previous ?? 0);
            const diff = current - previous;
            const change = formatChange(item.changePct);
            const diffClass = diff === 0 ? "text-neutral-500" : diff > 0 ? "text-emerald-600" : "text-red-600";
            const pctClass =
              change === null || item.changePct === 0
                ? "text-neutral-400"
                : item.changePct > 0
                  ? "text-emerald-600"
                  : "text-red-600";
            return (
              <tr key={item.label} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{item.label}</td>
                <td className="px-4 py-3 text-neutral-900">{format(current)}</td>
                <td className="px-4 py-3 text-neutral-500">{format(previous)}</td>
                <td className={`px-4 py-3 ${diffClass}`}>
                  {diff > 0 ? "+" : ""}
                  {format(diff)}
                </td>
                <td className={`px-4 py-3 ${pctClass}`}>{change ?? "No prior data"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
