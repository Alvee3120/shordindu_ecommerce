"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiTrash2, FiPhone, FiUser, FiPackage } from "react-icons/fi";
import { listStockNotifications, deleteStockNotification } from "@/lib/stockNotifications";

export default function AdminStockNotificationsPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await listStockNotifications({ page: p });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this stock notification?")) return;
    setDeletingId(id);
    try {
      await deleteStockNotification(id);
      toast.success("Notification removed");
      setItems((prev) => prev.filter((n) => n.id !== id));
      setCount((c) => Math.max(0, c - 1));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Stock Notifications</h1>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
          {count} total
        </span>
      </div>

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading notifications...
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">No stock notifications yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((n) => (
            <div
              key={n.id}
              className="flex flex-col items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:flex-row"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-neutral-500">
                  <span className="text-xs">
                    {new Date(n.created_at).toLocaleDateString()} ·{" "}
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="flex items-center gap-2 font-medium text-neutral-900">
                  <FiPackage size={14} className="text-neutral-400" />
                  {n.product_name || `Product #${n.product}`}
                  <span className="text-sm font-normal text-neutral-500">
                    ({n.variation_sku || `Variation #${n.variation}`})
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm text-neutral-700">
                  <FiUser size={14} className="text-neutral-400" />
                  {n.user_email || n.customer_name || "Guest"}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-neutral-700">
                  <FiPhone size={14} className="text-neutral-400" />
                  {n.phone}
                </p>
                {n.note && (
                  <p className="mt-1 text-sm text-neutral-600">“{n.note}”</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                  className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <FiTrash2 size={14} />
                  {deletingId === n.id ? "Removing..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
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
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
