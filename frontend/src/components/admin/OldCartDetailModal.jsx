"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FiImage, FiX } from "react-icons/fi";
import { formatAge, formatBDT, formatDateTime, formatNumber } from "@/lib/format";
import { getOldCart } from "@/lib/oldCarts";

function StockBadge({ item }) {
  const inStock = Number(item.stock_quantity) > 0;
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        inStock ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {inStock ? `${formatNumber(item.stock_quantity)} in stock` : "Out of stock"}
    </span>
  );
}

function ItemRow({ item, isAddon = false }) {
  return (
    <div
      className={`flex gap-3 border-b border-neutral-100 py-3 last:border-0 ${
        isAddon ? "pl-8" : ""
      }`}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
        {item.product_image ? (
          <Image
            src={item.product_image}
            alt={item.product_name || ""}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <FiImage size={18} className="text-neutral-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-neutral-900">
              {item.product_name}
              {isAddon && (
                <span className="ml-1.5 text-[11px] font-normal text-neutral-400">Add-on</span>
              )}
            </p>
            {item.variation_label && (
              <p className="text-xs text-neutral-500">{item.variation_label}</p>
            )}
            <p className="mt-0.5 text-xs text-neutral-500">
              Qty {item.quantity} · {formatBDT(item.unit_price_snapshot)} each
              {item.original_unit_price && (
                <span className="ml-1.5 text-neutral-400 line-through">
                  {formatBDT(item.original_unit_price)}
                </span>
              )}
            </p>
            {Number(item.promotion_discount) > 0 && (
              <p className="text-xs font-medium text-emerald-600">
                {item.promotion_label || "Offer applied"}
                {Number(item.free_quantity) > 0 && ` · ${item.free_quantity} free`}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-neutral-900">{formatBDT(item.line_total)}</p>
            <StockBadge item={item} />
          </div>
        </div>

        <p className="mt-1 text-xs text-neutral-400">
          Added {formatDateTime(item.created_at)} · {formatAge(item.age_seconds)}
        </p>
      </div>
    </div>
  );
}

export default function OldCartDetailModal({ cartId, onClose }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getOldCart(cartId)
      .then((data) => !cancelled && setCart(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [cartId]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const gross = cart
    ? Number(cart.subtotal || 0) + Number(cart.promotion_discount_total || 0)
    : 0;
  const promotionTotal = cart ? Number(cart.promotion_discount_total || 0) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="old-cart-title"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="old-cart-title" className="truncate text-lg font-semibold text-neutral-900">
              {cart?.customer?.name || "Cart details"}
            </h2>
            {cart && (
              <p className="truncate text-xs text-neutral-500">
                {cart.customer?.phone || "No phone"}
                {cart.customer?.email ? ` · ${cart.customer.email}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-neutral-500">Loading cart…</p>
          ) : error ? (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
          ) : cart ? (
            <>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
                  <span>
                    Oldest item:{" "}
                    <span className="font-medium text-neutral-700">
                      {formatAge(cart.oldest_age_seconds)}
                    </span>
                  </span>
                  <span>Last added: {formatDateTime(cart.last_item_at)}</span>
                  <span>Cart created: {formatDateTime(cart.created_at)}</span>
                </div>
                <p className="mt-2 text-[11px] text-neutral-400">
                  Items are considered old after {cart.threshold_hours} hours. Stock and prices are
                  shown as they are right now.
                </p>
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-neutral-700">
                  Items ({formatNumber(cart.item_count)})
                </h3>
                <div className="rounded-xl border border-neutral-200 px-4">
                  {(cart.items || []).map((item) => (
                    <div key={item.id}>
                      <ItemRow item={item} />
                      {(item.children || []).map((child) => (
                        <ItemRow key={child.id} item={child} isAddon />
                      ))}
                    </div>
                  ))}
                  {!(cart.items || []).length && (
                    <p className="py-6 text-center text-sm text-neutral-500">
                      This cart has no items.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-1 rounded-xl border border-neutral-200 p-4 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Items subtotal</span>
                  <span>{formatBDT(gross)}</span>
                </div>
                {promotionTotal > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Promotion discount</span>
                    <span>-{formatBDT(promotionTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-100 pt-2 font-semibold text-neutral-900">
                  <span>Cart total</span>
                  <span>{formatBDT(cart.subtotal)}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
