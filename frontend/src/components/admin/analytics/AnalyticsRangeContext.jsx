"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

const STORAGE_KEY = "shordindu-analytics-range";
const DEFAULT_STATE = { key: "this_month", start: "", end: "" };

const AnalyticsRangeContext = createContext(null);

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function AnalyticsRangeProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);

  // Restore the last selection so the filter stays consistent while navigating
  // between the dashboard analytics pages.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.key) setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next) => {
    setState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — in-memory only */
    }
  }, []);

  const setPreset = useCallback(
    (key) => persist({ key, start: state.start, end: state.end }),
    [persist, state.start, state.end]
  );

  const setCustom = useCallback((start, end) => persist({ key: "custom", start, end }), [persist]);

  const value = useMemo(() => {
    const isCustom = state.key === "custom";
    const isReady = !isCustom || Boolean(state.start && state.end);
    const query = isCustom
      ? { range: "custom", start: state.start, end: state.end }
      : { range: state.key };
    const preset = RANGE_PRESETS.find((item) => item.key === state.key);
    const label = isCustom
      ? state.start && state.end
        ? `${state.start} → ${state.end}`
        : "Custom Range"
      : preset?.label ?? "This Month";
    return { ...state, query, label, isReady, isCustom, setPreset, setCustom };
  }, [state, setPreset, setCustom]);

  return (
    <AnalyticsRangeContext.Provider value={value}>{children}</AnalyticsRangeContext.Provider>
  );
}

export function useAnalyticsRange() {
  const context = useContext(AnalyticsRangeContext);
  if (!context) {
    throw new Error("useAnalyticsRange must be used within an AnalyticsRangeProvider");
  }
  return context;
}
