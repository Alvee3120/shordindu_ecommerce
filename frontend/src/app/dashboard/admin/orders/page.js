"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { listOrders } from "@/lib/orders";

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusOptions = ["", "pending", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOrders({ page, status: status || undefined })
      .then((data) => {
        if (cancelled) return;
        setOrders(data.results);
        setCount(data.count);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Orders</h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        >
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt ? opt[0].toUpperCase() + opt.slice(1) : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Payment</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-neutral-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-neutral-900">
                    <Link
                      href={`/dashboard/admin/orders/${order.id}`}
                      className="hover:text-(--primary) hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {order.guest_email || `User #${order.user ?? "—"}`}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        statusColors[order.status] || "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-600 capitalize">{order.payment_status}</td>
                  <td className="px-5 py-3 text-neutral-900">৳{order.grand_total}</td>
                  <td className="px-5 py-3 text-neutral-500">
                    {new Date(order.placed_at).toLocaleDateString()}
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
