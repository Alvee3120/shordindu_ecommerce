"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { FiArrowLeft } from "react-icons/fi";
import { getOrder } from "@/lib/orders";

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

function ItemRow({ item, depth = 0 }) {
  return (
    <>
      <div
        className="flex items-center justify-between gap-4 py-3"
        style={{ paddingLeft: depth * 20 }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-rose-100 via-violet-100 to-amber-100">
            {item.product_image ? (
              <Image
                src={item.product_image}
                alt={item.product_name_snapshot}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-1 text-center text-[9px] font-medium leading-tight text-neutral-400">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-neutral-900">
              {depth > 0 && <span className="text-neutral-400">+ </span>}
              {item.product_name_snapshot}
            </p>
            <p className="text-xs text-neutral-500">
              {item.variation_label_snapshot} &middot; Qty {item.quantity} &middot; ৳
              {item.unit_price} each
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-medium text-neutral-900">৳{item.line_total}</p>
      </div>
      {item.children?.map((child) => (
        <ItemRow key={child.id} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOrder(id)
      .then((data) => !cancelled && setOrder(data))
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.message);
        router.replace("/dashboard/customer/orders");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading) {
    return (
      <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading order...
      </p>
    );
  }

  if (!order) return null;

  return (
    <div>
      <Link
        href="/dashboard/customer/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-(--primary)"
      >
        <FiArrowLeft size={14} />
        Back to orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{order.order_number}</h1>
          <p className="text-sm text-neutral-500">
            Placed{" "}
            {new Date(order.placed_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge value={order.status} styles={STATUS_STYLES} />
          <Badge value={order.payment_status} styles={PAYMENT_STYLES} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Items</h2>
          <div className="divide-y divide-neutral-100">
            {order.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Summary</h2>
            <div className="flex flex-col gap-1.5 text-sm">
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
                <span>Delivery Charge</span>
                <span>৳{order.shipping_total}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Tax</span>
                <span>৳{order.tax_total}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-neutral-100 pt-2 font-semibold text-neutral-900">
                <span>Total</span>
                <span>৳{order.grand_total}</span>
              </div>
            </div>
            {order.coupons?.length > 0 && (
              <div className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                Coupon: <span className="font-medium">{order.coupons[0].code}</span>
              </div>
            )}
          </div>

          {order.shipping_address_detail && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Shipping Address</h2>
              <p className="text-sm text-neutral-900">{order.shipping_address_detail.name}</p>
              {order.shipping_address_detail.phone && (
                <p className="text-sm text-neutral-500">{order.shipping_address_detail.phone}</p>
              )}
              <p className="mt-1 text-sm text-neutral-600">
                {order.shipping_address_detail.address}
              </p>
              <p className="text-sm text-neutral-500">{order.shipping_address_detail.district}</p>
            </div>
          )}

          {order.payments?.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Payment</h2>
              {order.payments.map((payment) => (
                <div key={payment.id} className="text-sm text-neutral-600">
                  <p className="capitalize">{payment.method.replace("_", " ")}</p>
                  <p className="capitalize text-neutral-500">{payment.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
