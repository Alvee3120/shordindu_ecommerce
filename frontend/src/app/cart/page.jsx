"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiChevronLeft, FiCornerDownRight, FiMinus, FiPlus, FiX } from "react-icons/fi";
import { getCart, updateCartItem, deleteCartItem } from "@/lib/cart";
import { getMe } from "@/lib/auth";
import { listAddresses } from "@/lib/addresses";
import { useCart } from "@/context/CartContext";

const ESTIMATED_SHIPPING = 120;

export default function CartPage() {
  const router = useRouter();
  const { refreshCart } = useCart();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [shippingAddress, setShippingAddress] = useState(null);

  const loadCart = async () => {
    try {
      const data = await getCart();
      setCart(data);
      refreshCart();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([getCart(), getMe().catch(() => null)])
      .then(async ([cartData, me]) => {
        if (cancelled) return;
        setCart(cartData);
        if (me) {
          const addrList = await listAddresses().catch(() => []);
          if (cancelled) return;
          setShippingAddress(addrList.find((a) => a.is_default) || addrList[0] || null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleQuantityChange = async (item, nextQuantity) => {
    if (nextQuantity < 1) return;
    setUpdatingItemId(item.id);
    try {
      await updateCartItem(item.id, { quantity: nextQuantity });
      await loadCart();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (item) => {
    setUpdatingItemId(item.id);
    try {
      await deleteCartItem(item.id);
      await loadCart();
      toast.success("Item removed");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingItemId(null);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-16 text-sm text-neutral-500">Loading cart...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-sm text-neutral-500">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-(--primary) hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const items = cart?.items || [];
  const isEmpty = items.length === 0;
  const subtotal = Number(cart?.subtotal || 0);
  const total = subtotal + (isEmpty ? 0 : ESTIMATED_SHIPPING);

  // flatten each top-level item with its addon children, in display order
  const rows = items.flatMap((item) => [
    { ...item, isAddon: false },
    ...(item.children || []).map((addon) => ({ ...addon, isAddon: true })),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
      <Link
        href="/"
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)"
      >
        <FiChevronLeft size={16} />
        Continue shopping
      </Link>

      <h1 className="mb-6 font-sora text-2xl font-semibold text-neutral-900">Your Cart</h1>

      {isEmpty ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm text-neutral-500">Your cart is empty.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-(--primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--primary)/90"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white lg:col-span-2">
            <table className="w-full min-w-140 text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  <th className="w-8" />
                  <th className="px-3 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Price</th>
                  <th className="w-32 px-3 py-3 font-semibold">Quantity</th>
                  <th className="px-3 py-3 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-3 align-top">
                      {row.isAddon ? (
                        <FiCornerDownRight size={14} className="mt-2 text-neutral-300" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(row)}
                          disabled={updatingItemId === row.id}
                          aria-label="Remove item"
                          className="mt-1.5 flex h-6 w-4 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                          {row.product_image ? (
                            <Image src={row.product_image} alt="" fill className="object-cover" sizes="64px" />
                          ) : null}
                        </div>
                        <div>
                          <p className={row.isAddon ? "text-sm text-neutral-600" : "font-medium text-neutral-900"}>
                            {row.product_name}
                          </p>
                          {row.variation_label && (
                            <p className="text-xs text-neutral-400">{row.variation_label}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-600">
                      ৳{Number(row.unit_price_snapshot).toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      {row.isAddon ? (
                        <span className="text-neutral-600">{row.quantity}</span>
                      ) : (
                        <div className="flex w-fit shrink-0 items-center rounded-full border border-neutral-200">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(row, row.quantity - 1)}
                            disabled={row.quantity <= 1 || updatingItemId === row.id}
                            aria-label="Decrease quantity"
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiMinus size={11} />
                          </button>
                          <span className="w-6 shrink-0 text-center text-sm font-semibold">{row.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(row, row.quantity + 1)}
                            disabled={updatingItemId === row.id}
                            aria-label="Increase quantity"
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-500 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiPlus size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-neutral-900">
                      ৳{Number(row.line_total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-fit rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 font-sora text-lg font-semibold text-neutral-900">Cart Totals</h2>

            <div className="flex justify-between border-b border-neutral-100 py-3 text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span className="font-medium text-neutral-900">৳{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex flex-col gap-1 border-b border-neutral-100 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Shipment</span>
                <span className="text-right text-neutral-700">
                  {shippingAddress ? (
                    <>
                      Shipping to <span className="font-medium">{shippingAddress.district}</span>
                    </>
                  ) : (
                    "Add address at checkout"
                  )}
                </span>
              </div>
              <p className="text-right text-xs text-(--primary)">
                * Charges may vary: ৳{ESTIMATED_SHIPPING.toFixed(2)}
              </p>
            </div>

            <div className="flex justify-between py-4 text-base font-semibold text-neutral-900">
              <span>Total</span>
              <span>৳{total.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={() => router.push("/checkout")}
              className="h-12 w-full rounded-full bg-(--primary) text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary)/90"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
