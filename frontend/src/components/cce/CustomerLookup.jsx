"use client";

import { useEffect, useRef, useState } from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import { lookupCustomers } from "@/lib/users";

/**
 * Optional search for an existing customer account (name / phone / email).
 * Picking one calls `onSelect(customer)` so the page can prefill the form and
 * link the order to that account — the account itself is never edited.
 */
export default function CustomerLookup({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      lookupCustomers(term)
        .then((data) => !cancelled && setResults(data))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const showPanel = open && query.trim().length >= 2;
  const visible = showPanel ? results : [];

  return (
    <div ref={rootRef} className="relative">
      <FiSearch size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Find an existing customer by name or phone (optional)"
        aria-label="Search existing customers"
        className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
      />
      {showPanel && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          {loading && visible.length === 0 ? (
            <p className="px-3 py-3 text-sm text-neutral-500">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-3 text-sm text-neutral-500">No customer found — enter their details below.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
              {visible.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(customer);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-(--primary)/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--primary)/10 text-(--primary)">
                      <FiUser size={14} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">{customer.name}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {[customer.phone, customer.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
