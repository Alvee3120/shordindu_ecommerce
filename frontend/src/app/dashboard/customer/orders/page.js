"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FiChevronRight } from "react-icons/fi";
import { listOrders } from "@/lib/orders";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-cyan-50 text-cyan-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

const PAYMENT_STYLES = {
  unpaid: "bg-neutral-100 text-neutral-600",
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-orange-50 text-orange-700",
};

function Badge({ value, styles }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[value] || "bg-neutral-100 text-neutral-600"
      }`}
    >
      {value}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const pageSize = 20;
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOrders({ page, status: statusFilter || undefined, mine: true })
      .then((data) => {
        if (cancelled) return;
        setOrders(data.results);
        setCount(data.count);
      })
      .catch((err) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">My Orders</h1>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading orders...
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-neutral-500">No orders found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Order #</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      {order.order_number}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">
                      {new Date(order.placed_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={order.status} styles={STATUS_STYLES} />
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={order.payment_status} styles={PAYMENT_STYLES} />
                    </td>
                    <td className="px-5 py-3 font-medium text-neutral-900">
                      ৳{order.grand_total}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/customer/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-(--primary) hover:underline"
                      >
                        Details <FiChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
