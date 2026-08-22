"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { BD_DISTRICTS } from "@/lib/districts";

/**
 * Searchable/filterable dropdown for selecting one of the 64 Bangladeshi districts.
 * Controlled: pass `value` (district name string) and `onChange(district)`.
 */
export default function DistrictSelect({ value, onChange, onBlur, error, id = "district" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BD_DISTRICTS;
    return BD_DISTRICTS.filter((d) => d.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onBlur]);

  const handleSelect = (district) => {
    onChange(district);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
          error ? "border-red-400" : "border-neutral-300"
        } ${value ? "text-neutral-800" : "text-neutral-400"}`}
      >
        <span>{value || "Select district"}</span>
        <FiChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <FiSearch size={14} className="shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search district..."
              className="w-full text-sm outline-none placeholder:text-neutral-400"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-400">No district found</li>
            )}
            {filtered.map((district) => (
              <li key={district}>
                <button
                  type="button"
                  role="option"
                  aria-selected={district === value}
                  onClick={() => handleSelect(district)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-(--primary)/10 ${
                    district === value ? "bg-(--primary)/10 font-medium text-(--primary)" : "text-neutral-700"
                  }`}
                >
                  {district}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
