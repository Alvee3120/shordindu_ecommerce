"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FiX } from "react-icons/fi";
import { getOrder, confirmOrder, cancelOrder, shipOrder, deliverOrder } from "@/lib/orders";

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

// All possible status transitions — always shown minus whichever matches the
// order's current status, so status stays changeable even from
// cancelled/delivered (e.g. correcting a mistaken cancel).
const ALL_ACTIONS = [
  { label: "Confirm", value: "processing", action: confirmOrder },
  { label: "Ship", value: "shipped", action: shipOrder },
  { label: "Mark delivered", value: "delivered", action: deliverOrder },
  { label: "Cancel", value: "cancelled", action: cancelOrder },
];

export default function OrderDetailModal({ orderId, onClose, onStatusChange }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const overlayRef = useRef(null);
  const contentRef = useRef(null);

  // Body scroll lock while the modal is open. `overflow: hidden` alone is
  // unreliable — it doesn't stop keyboard scroll and can leak on some
  // touchpads/browsers — so the body is physically pinned in place at its
  // current scroll offset instead, and unpinned (with the scroll position
  // restored) when the modal closes.
  useEffect(() => {
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body.style;
    const prev = {
      position: body.position,
      top: body.top,
      left: body.left,
      right: body.right,
      width: body.width,
      paddingRight: body.paddingRight,
    };

    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.left = "0";
    body.right = "0";
    body.width = "100%";
    if (scrollbarWidth > 0) {
      body.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.position = prev.position;
      body.top = prev.top;
      body.left = prev.left;
      body.right = prev.right;
      body.width = prev.width;
      body.paddingRight = prev.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Belt-and-suspenders scroll routing: every wheel event anywhere over the
  // overlay is redirected to the content div and stopped there, so the page
  // behind can never receive it — regardless of any CSS scroll-chaining
  // edge case. React's onWheel prop is passive by default (preventDefault
  // would silently no-op there), so this needs a native listener.
  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;

    function handleWheel(e) {
      e.preventDefault();
      contentRef.current?.scrollBy({ top: e.deltaY, behavior: "smooth" });
    }

    overlayEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => overlayEl.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrder(orderId)
      .then((data) => !cancelled && setOrder(data))
      .catch((err) => toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function handleActionChange(e) {
    const value = e.target.value;
    const opt = ALL_ACTIONS.find((o) => o.value === value);
    if (!opt) return;
    setUpdating(true);
    try {
      const updated = await opt.action(orderId);
      setOrder(updated);
      onStatusChange?.(updated);
      toast.success(`Order marked as ${updated.status}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />

      {/* Fixed h-[80vh] (not max-h) — gives the box a definite height so the
          flex-1/min-h-0 content region below always establishes a real
          scroll context, regardless of how much or little the order has. */}
      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {order ? order.order_number : "Order details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={18} />
          </button>
        </div>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <p className="text-sm text-neutral-500">Loading order...</p>
          ) : !order ? (
            <p className="text-sm text-neutral-500">Order not found.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-500">
                  Placed {new Date(order.placed_at).toLocaleString()}
                </p>
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

              {order.shipping_address_detail && (
                <div className="mb-4 rounded-xl border border-neutral-200 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-900">Shipping Address</h3>
                  <div className="text-sm text-neutral-600">
                    <p className="font-medium text-neutral-900">
                      {order.shipping_address_detail.name}
                    </p>
                    <p>{order.shipping_address_detail.phone}</p>
                    <p className="mt-1">{order.shipping_address_detail.address}</p>
                    <p>{order.shipping_address_detail.district}</p>
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-xl border border-neutral-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Items</h3>
                <div className="divide-y divide-neutral-100">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {item.product_name_snapshot}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {item.variation_label_snapshot} &middot; Qty {item.quantity} &middot; ৳
                          {item.unit_price} each
                        </p>
                      </div>
                      <p className="text-sm font-medium text-neutral-900">৳{item.line_total}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span>৳{order.subtotal}</span>
                  </div>
                  {Number(order.discount_total) > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Discount</span>
                      <span>-৳{order.discount_total}</span>
                    </div>
                  )}
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
            </>
          )}
        </div>

        {order && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
            <label htmlFor="order-status-action" className="text-sm text-neutral-500">
              Update status
            </label>
            <select
              id="order-status-action"
              value=""
              onChange={handleActionChange}
              disabled={updating}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-(--primary) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                {updating ? "Updating..." : "Choose action"}
              </option>
              {ALL_ACTIONS.filter((opt) => opt.value !== order.status).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
