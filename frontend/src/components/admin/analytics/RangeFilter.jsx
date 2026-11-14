"use client";

import { useEffect, useRef, useState } from "react";
import { FiCalendar, FiChevronDown } from "react-icons/fi";
import { RANGE_PRESETS, todayISO, useAnalyticsRange } from "./AnalyticsRangeContext";

export default function RangeFilter({ className = "" }) {
  const { key: rangeKey, start, end, label, setPreset, setCustom } = useAnalyticsRange();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const [error, setError] = useState("");
  const containerRef = useRef(null);
  const today = todayISO();

  const openPanel = () => {
    setDraftStart(start);
    setDraftEnd(end);
    setError("");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const applyCustom = () => {
    if (!draftStart || !draftEnd) {
      setError("Select both a start and end date.");
      return;
    }
    if (draftStart > draftEnd) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (draftEnd > today) {
      setError("End date cannot be in the future.");
      return;
    }
    setError("");
    setCustom(draftStart, draftEnd);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
      >
        <FiCalendar size={15} className="text-(--primary)" />
        <span className="max-w-[14rem] truncate">{label}</span>
        <FiChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-1">
            {RANGE_PRESETS.filter((preset) => preset.key !== "custom").map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setPreset(preset.key);
                  setOpen(false);
                }}
                className={`rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  rangeKey === preset.key
                    ? "bg-(--primary)/10 font-semibold text-(--primary)"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-neutral-200 pt-3">
            <p className="mb-2 text-xs font-semibold text-neutral-500">Custom range</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draftStart}
                max={today}
                onChange={(event) => setDraftStart(event.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-(--primary)"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="date"
                value={draftEnd}
                max={today}
                onChange={(event) => setDraftEnd(event.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={applyCustom}
              className="mt-2 w-full rounded-lg bg-(--primary) px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
            >
              Apply range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
