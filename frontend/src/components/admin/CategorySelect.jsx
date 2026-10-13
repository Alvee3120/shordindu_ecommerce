"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";

/**
 * Searchable single-category picker. `categories` is the flat API list;
 * sub-categories are labelled with their parent ("Skincare › Serums").
 * Controlled: `value` (category id) and `onChange(id)`.
 */
export default function CategorySelect({ categories, value, onChange, error, id = "category", loading = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const options = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const labelFor = (category) => {
      const names = [category.name];
      let parent = byId.get(category.parent);
      const seen = new Set([category.id]);
      while (parent && !seen.has(parent.id)) {
        names.unshift(parent.name);
        seen.add(parent.id);
        parent = byId.get(parent.parent);
      }
      return names.join(" › ");
    };
    return categories
      .map((category) => ({ id: category.id, label: labelFor(category) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => String(o.id) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={loading}
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-(--primary) disabled:opacity-60 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${selected ? "text-neutral-800" : "text-neutral-400"}`}
      >
        <span className="truncate">{loading ? "Loading categories..." : selected?.label || "Select a category"}</span>
        <FiChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <FiSearch size={14} className="shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full text-sm outline-none placeholder:text-neutral-400"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-neutral-400">No category found</li>}
            {filtered.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={String(option.id) === String(value)}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-(--primary)/10 ${
                    String(option.id) === String(value) ? "bg-(--primary)/10 font-medium text-(--primary)" : "text-neutral-700"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
