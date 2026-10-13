"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FiEdit2, FiPercent, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { deleteDiscount, formatDiscountValue, listDiscounts } from "@/lib/discounts";
import { formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

const selectClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)";

function targetSummary(discount) {
  if (discount.target_type === "category") return discount.category_name || "Deleted category";
  return `${discount.product_count} product${discount.product_count === 1 ? "" : "s"}`;
}

export default function AdminDiscountsPage() {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchPage = useCallback(
    () =>
      listDiscounts({ page, search, status, type, target_type: target })
        .then((data) => {
          setDiscounts(data.results);
          setCount(data.count);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false)),
    [page, search, status, type, target]
  );

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const reload = () => {
    setLoading(true);
    fetchPage();
  };

  const changeFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
    setLoading(true);
  };

  const handleDelete = async (discount) => {
    if (!confirm(`Delete "${discount.name}"? Product prices return to normal immediately. Past orders keep their prices.`)) {
      return;
    }
    setDeletingId(discount.id);
    try {
      await deleteDiscount(discount.id);
      toast.success("Discount deleted.");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (user?.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only administrators can manage discounts.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasFilters = Boolean(search || status || type || target);

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Discounts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Automatic price reductions for a category or chosen products. Coupons are managed separately.
          </p>
        </div>
        <Link
          href="/dashboard/admin/discounts/new"
          className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
        >
          <FiPlus size={16} />
          Add Discount
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <FiSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search discounts..."
            aria-label="Search discounts"
            className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          />
        </div>
        <select value={status} onChange={changeFilter(setStatus)} aria-label="Filter by status" className={selectClass}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={type} onChange={changeFilter(setType)} aria-label="Filter by type" className={selectClass}>
          <option value="">All types</option>
          <option value="percent">Percentage</option>
          <option value="fixed">Fixed amount</option>
        </select>
        <select value={target} onChange={changeFilter(setTarget)} aria-label="Filter by target" className={selectClass}>
          <option value="">All targets</option>
          <option value="category">Category</option>
          <option value="products">Products</option>
        </select>
      </div>

      {loading && discounts.length === 0 ? (
        <div className="animate-pulse space-y-2 rounded-xl border border-neutral-200 bg-white p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-neutral-100" />
          ))}
        </div>
      ) : error && discounts.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : discounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white py-12 text-neutral-400">
          <FiPercent size={22} />
          <p className="text-sm">{hasFilters ? "No discounts match these filters." : "No discounts yet."}</p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
                <th className="px-5 py-3 font-medium">Discount</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Schedule</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id} className="border-b border-neutral-100 whitespace-nowrap last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/admin/discounts/${discount.id}`}
                      className="font-medium text-neutral-900 hover:text-(--primary) hover:underline"
                    >
                      {discount.name}
                    </Link>
                    <p className="text-xs text-neutral-500">{discount.type === "percent" ? "Percentage" : "Fixed amount"}</p>
                  </td>
                  <td className="px-5 py-3 font-semibold text-neutral-900">{formatDiscountValue(discount)}</td>
                  <td className="px-5 py-3">
                    <p className="text-neutral-900">{targetSummary(discount)}</p>
                    <p className="text-xs text-neutral-500">{discount.target_type === "category" ? "Category" : "Products"}</p>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {formatDate(discount.starts_at)} → {formatDate(discount.ends_at)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge value={discount.status} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/dashboard/admin/discounts/${discount.id}`}
                        aria-label={`Edit ${discount.name}`}
                        title="Edit"
                        className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-(--primary)"
                      >
                        <FiEdit2 size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(discount)}
                        disabled={deletingId === discount.id}
                        aria-label={`Delete ${discount.name}`}
                        title="Delete"
                        className="rounded-full p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
              setLoading(true);
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
              setPage((p) => p + 1);
              setLoading(true);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
