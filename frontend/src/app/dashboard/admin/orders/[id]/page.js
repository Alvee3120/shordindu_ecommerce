"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FiArrowLeft } from "react-icons/fi";
import { getOrder } from "@/lib/orders";

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOrder(id)
      .then((data) => !cancelled && setOrder(data))
      .catch((err) => toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading)
    return (
      <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading order...
      </p>
    );
  if (!order) return <p className="text-sm text-neutral-500">Order not found.</p>;

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/dashboard/admin/orders")}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-(--primary)"
      >
        <FiArrowLeft size={16} />
        Back to orders
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{order.order_number}</h1>
          <p className="text-sm text-neutral-500">
            Placed {new Date(order.placed_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              statusColors[order.status] || "bg-neutral-100 text-neutral-600"
            }`}
          >
            {order.status}
          </span>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 capitalize">
            {order.payment_status}
          </span>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Items</h2>
          <div className="divide-y divide-neutral-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-neutral-900">{item.product_name_snapshot}</p>
                  <p className="text-sm text-neutral-500">{item.variation_label_snapshot}</p>
                  <p className="text-xs text-neutral-400">Qty {item.quantity} × ৳{item.unit_price}</p>
                </div>
                <p className="font-medium text-neutral-900">৳{item.line_total}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>৳{order.subtotal}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Discount</span>
              <span>-৳{order.discount_total}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Shipping</span>
              <span>৳{order.shipping_total}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Tax</span>
              <span>৳{order.tax_total}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-semibold text-neutral-900">
              <span>Total</span>
              <span>৳{order.grand_total}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Shipping Address</h2>
            {order.shipping_address_detail ? (
              <div className="text-sm text-neutral-600">
                <p className="font-medium text-neutral-900">{order.shipping_address_detail.name}</p>
                <p>{order.shipping_address_detail.phone}</p>
                <p>{order.shipping_address_detail.address}</p>
                <p>{order.shipping_address_detail.district}</p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">—</p>
            )}
          </div>

          {order.coupons?.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Coupons</h2>
              {order.coupons.map((c) => (
                <div key={c.coupon} className="flex justify-between text-sm text-neutral-600">
                  <span>{c.code}</span>
                  <span>-৳{c.discount_amount}</span>
                </div>
              ))}
            </div>
          )}

          {order.payments?.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Payments</h2>
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm text-neutral-600">
                  <span className="capitalize">
                    {p.method} — {p.status}
                  </span>
                  <span>৳{p.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
