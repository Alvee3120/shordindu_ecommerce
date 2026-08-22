"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiSearch, FiLoader } from "react-icons/fi";
import { listProducts, toCardProduct } from "@/lib/products";

const DEBOUNCE_MS = 300;

export default function SearchBar({ className = "", inputClassName = "", autoFocus = false, onNavigate }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const term = query.trim();
    if (!term) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query is emptied
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const data = await listProducts({ search: term, page_size: 5 });
        if (requestId !== requestIdRef.current) return;
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setResults(list.slice(0, 5).map(toCardProduct));
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const goToShopSearch = useCallback(
    (term) => {
      const trimmed = term.trim();
      setOpen(false);
      onNavigate?.();
      router.push(trimmed ? `/shop?search=${encodeURIComponent(trimmed)}` : "/shop");
    },
    [router, onNavigate]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    goToShopSearch(query);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2 rounded-full bg-gray-100 px-4 py-2"
      >
        <FiSearch size={16} className="shrink-0 text-gray-400" />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search products…"
          className={`w-full bg-transparent text-sm outline-none placeholder:text-gray-400 ${inputClassName}`}
        />
        {loading && <FiLoader size={14} className="shrink-0 animate-spin text-gray-400" />}
      </form>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-100 bg-white shadow-xl transition-all duration-200">
          {results.length > 0 ? (
            <>
              <ul className="divide-y divide-neutral-100">
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={product.href}
                      onClick={() => {
                        setOpen(false);
                        onNavigate?.();
                      }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100">
                        {product.image ? (
                          <Image src={product.image} alt={product.name} fill className="object-cover" sizes="48px" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                        <p className="text-sm font-semibold text-(--primary)">
                          {product.price != null ? `৳ ${product.price}` : "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => goToShopSearch(query)}
                className="block w-full rounded-b-2xl border-t border-neutral-100 px-4 py-3 text-center text-sm font-semibold text-(--primary) transition-colors hover:bg-neutral-50"
              >
                 See All Results
              </button>
            </>
          ) : !loading ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">
              No products found for “{query}”
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
