"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiEye, FiRefreshCw, FiSearch, FiShoppingCart } from "react-icons/fi";
import InitialsAvatar from "@/components/admin/InitialsAvatar";
import OldCartDetailModal from "@/components/admin/OldCartDetailModal";
import KpiCard from "@/components/admin/analytics/KpiCard";
import { useAuth } from "@/context/AuthContext";
import { formatAge, formatBDT, formatDateTime, formatNumber } from "@/lib/format";
import { getOldCartsSummary, listOldCarts } from "@/lib/oldCarts";

const PAGE_SIZE = 20;

export default function OldCartsPage() {
  const { user } = useAuth();
  const canView = user?.role === "admin" || user?.role === "cce";

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [viewingId, setViewingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!canView) return undefined;
    let cancelled = false;

    listOldCarts({
      page,
      search: search || undefined,
      age: ageFilter || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.results);
        setCount(data.count);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        toast.error(err.message);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, search, ageFilter, reloadKey, canView]);

  useEffect(() => {
    if (!canView) return undefined;
    let cancelled = false;

    getOldCartsSummary()
      .then((data) => !cancelled && setSummary(data))
      .catch(() => !cancelled && setSummary(null))
      .finally(() => !cancelled && setSummaryLoading(false));

    return () => {
      cancelled = true;
    };
  }, [reloadKey, canView]);

  if (user && !canView) {
    return <p className="text-sm text-neutral-500">Only administrators and CCEs can view old carts.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const threshold = summary?.threshold_hours ?? 6;

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Old Carts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Customers with at least one item sitting in their cart for more than {threshold} hours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <FiSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer or product..."
              aria-label="Search old carts"
              className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
          </div>
          <select
            value={ageFilter}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setPage(1);
              setAgeFilter(event.target.value);
            }}
            aria-label="Filter by cart age"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          >
            <option value="">All ages</option>
            <option value="6-24h">6–24 hours</option>
            <option value="1-3d">1–3 days</option>
            <option value="3d+">3+ days</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setSummaryLoading(true);
              setReloadKey((key) => key + 1);
            }}
            aria-label="Refresh old carts"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Customers with Old Carts"
          value={formatNumber(summary?.customers ?? 0)}
          icon={FiShoppingCart}
          loading={summaryLoading}
          tooltip="Each customer is counted once, no matter how many old items their cart has."
        />
        <KpiCard
          label="Old cart units"
          value={formatNumber(summary?.old_items ?? 0)}
          loading={summaryLoading}
          tooltip={`Total quantity of items that have been in customer carts for more than ${threshold} hours.`}
        />
      </div>

      <div
        className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${
          loading ? "opacity-60" : ""
        }`}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Items</th>
              <th className="px-5 py-3 font-medium">Cart Value</th>
              <th className="px-5 py-3 font-medium">Oldest Item</th>
              <th className="px-5 py-3 font-medium">Last Added</th>
              <th className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">
                  Loading old carts...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-red-600">
                  {error}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      setReloadKey((key) => key + 1);
                    }}
                    className="font-semibold underline"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">
                  No old carts found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        id={row.customer?.id}
                        name={row.customer?.name}
                        email={row.customer?.email}
                        phone={row.customer?.phone}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {row.customer?.name || "—"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {row.customer?.phone || "No phone"}
                          {row.customer?.email ? ` · ${row.customer.email}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-600">
                    {formatNumber(row.item_count)}{" "}
                    <span className="text-xs text-neutral-400">
                      ({formatNumber(row.old_item_count)} old)
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-600">
                    {formatBDT(row.cart_value)}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <p className="text-neutral-600">{formatDateTime(row.oldest_item_at)}</p>
                    <p className="text-xs font-medium text-amber-700">
                      {formatAge(row.oldest_age_seconds)}
                    </p>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-500">
                    {formatDateTime(row.last_item_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setViewingId(row.id)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEye size={14} />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {viewingId && (
        <OldCartDetailModal cartId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  );
}
