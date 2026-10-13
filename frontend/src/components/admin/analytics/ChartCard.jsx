"use client";

import { FiAlertCircle, FiInbox } from "react-icons/fi";

export function ChartSkeleton({ height = 260 }) {
  return <div style={{ height }} className="animate-pulse rounded-lg bg-neutral-100" />;
}

export function EmptyState({ message = "No data for this period." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 text-neutral-400" style={{ minHeight: 160 }}>
      <FiInbox size={22} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ message = "Could not load this data.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-200 bg-red-50/40 text-red-600" style={{ minHeight: 160 }}>
      <FiAlertCircle size={22} />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  right,
  loading,
  error,
  isEmpty,
  onRetry,
  height = 260,
  className = "",
  children,
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {loading ? (
        <ChartSkeleton height={height} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </section>
  );
}
