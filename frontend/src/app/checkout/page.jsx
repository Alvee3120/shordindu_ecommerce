"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiChevronLeft } from "react-icons/fi";
import { getCart } from "@/lib/cart";
import { getMe } from "@/lib/auth";
import { listAddresses } from "@/lib/addresses";
import { checkout } from "@/lib/orders";
import { useCart } from "@/context/CartContext";

const ESTIMATED_SHIPPING = 120;

const EMPTY_GUEST_FORM = {
  email: "",
  shipping_name: "",
  shipping_phone: "",
  shipping_address: "",
  shipping_district: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { refreshCart } = useCart();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [guestForm, setGuestForm] = useState(EMPTY_GUEST_FORM);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([getCart(), getMe().catch(() => null)])
      .then(async ([cartData, me]) => {
        if (cancelled) return;
        if (!cartData.items?.length) {
          router.replace("/cart");
          return;
        }
        setCart(cartData);
        setUser(me);
        if (me) {
          const addrList = await listAddresses().catch(() => []);
          if (cancelled) return;
          setAddresses(addrList);
          const defaultAddr = addrList.find((a) => a.is_default) || addrList[0];
          if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          else setUseNewAddress(true);
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
  }, [router]);

  const handleGuestChange = (e) => {
    const { name, value } = e.target;
    setGuestForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async () => {
    if (!cart?.items?.length) return;

    const payload = {};
    if (user) {
      if (useNewAddress || !selectedAddressId) {
        if (!guestForm.shipping_address) {
          toast.error("Please enter a shipping address.");
          return;
        }
        payload.shipping_name = guestForm.shipping_name;
        payload.shipping_phone = guestForm.shipping_phone;
        payload.shipping_address = guestForm.shipping_address;
        payload.shipping_district = guestForm.shipping_district;
      } else {
        payload.shipping_address_id = Number(selectedAddressId);
      }
    } else {
      if (!guestForm.email) {
        toast.error("Please enter your email.");
        return;
      }
      if (!guestForm.shipping_address) {
        toast.error("Please enter a shipping address.");
        return;
      }
      payload.email = guestForm.email;
      payload.shipping_name = guestForm.shipping_name;
      payload.shipping_phone = guestForm.shipping_phone;
      payload.shipping_address = guestForm.shipping_address;
      payload.shipping_district = guestForm.shipping_district;
    }

    setPlacingOrder(true);
    try {
      const order = await checkout(payload);
      toast.success(`Order ${order.order_number} placed — cash on delivery`);
      refreshCart();
      router.push(`/dashboard/customer/orders/${order.id}`);
    } catch (err) {
      toast.error(err.message || "Could not place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-neutral-500">Loading checkout...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="text-sm text-neutral-500">{error}</p>
        <Link href="/cart" className="mt-4 inline-block text-sm font-semibold text-(--primary) hover:underline">
          Back to cart
        </Link>
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const total = subtotal + ESTIMATED_SHIPPING;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
      <Link
        href="/cart"
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)"
      >
        <FiChevronLeft size={16} />
        Back to cart
      </Link>

      <h1 className="mb-6 font-sora text-2xl font-semibold text-(--primary)">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-(--primary)">Shipping details</h2>

            {user && addresses.length > 0 && !useNewAddress && (
              <div className="flex flex-col gap-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      String(selectedAddressId) === String(addr.id)
                        ? "border-(--primary) bg-(--primary)/10"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping_address_id"
                      checked={String(selectedAddressId) === String(addr.id)}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-0.5 h-4 w-4 accent-(--primary)"
                    />
                    <span>
                      <span className="block font-medium text-neutral-800">{addr.name}</span>
                      <span className="block text-neutral-500">
                        {addr.address}, {addr.district}
                      </span>
                      {addr.phone && <span className="block text-neutral-500">{addr.phone}</span>}
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setUseNewAddress(true)}
                  className="mt-1 text-left text-xs font-medium text-(--primary) hover:underline"
                >
                  Ship to a different address
                </button>
              </div>
            )}

            {(!user || useNewAddress || addresses.length === 0) && (
              <div className="flex flex-col gap-3">
                {!user && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={guestForm.email}
                      onChange={handleGuestChange}
                      required
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Full name</label>
                    <input
                      type="text"
                      name="shipping_name"
                      value={guestForm.shipping_name}
                      onChange={handleGuestChange}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Phone</label>
                    <input
                      type="tel"
                      name="shipping_phone"
                      value={guestForm.shipping_phone}
                      onChange={handleGuestChange}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Address</label>
                  <textarea
                    name="shipping_address"
                    value={guestForm.shipping_address}
                    onChange={handleGuestChange}
                    rows={3}
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">District</label>
                  <input
                    type="text"
                    name="shipping_district"
                    value={guestForm.shipping_district}
                    onChange={handleGuestChange}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                  />
                </div>
                {user && addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseNewAddress(false)}
                    className="text-left text-xs font-medium text-(--primary) hover:underline"
                  >
                    Use a saved address instead
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-(--primary)">Payment method</h2>
            <div className="flex items-center gap-2 rounded-lg border border-(--primary) bg-(--primary)/10 px-3 py-2.5 text-sm font-medium text-(--primary)">
              Cash on Delivery
            </div>
          </div>
        </div>

        <div className="h-fit rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-sora text-lg font-semibold text-(--primary)">Order Summary</h2>

          <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {item.product_image ? (
                    <Image src={item.product_image} alt="" fill className="object-cover" sizes="48px" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-neutral-800">
                    {item.product_name} <span className="text-neutral-400">x{item.quantity}</span>
                  </p>
                  {item.children?.map((addon) => (
                    <p key={addon.id} className="text-xs text-neutral-400">
                      + {addon.product_name} x{addon.quantity}
                    </p>
                  ))}
                </div>
                <span className="font-medium text-(--primary)">
                  ৳
                  {(
                    Number(item.line_total) +
                    (item.children || []).reduce((s, a) => s + Number(a.line_total), 0)
                  ).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between border-b border-neutral-100 py-3 text-sm">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-medium text-(--primary)">৳{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 py-3 text-sm">
            <span className="text-neutral-500">Shipping</span>
            <span className="font-medium text-(--primary)">৳{ESTIMATED_SHIPPING.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-4 text-base font-semibold text-(--primary)">
            <span>Total</span>
            <span>৳{total.toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placingOrder}
            className="h-12 w-full rounded-full bg-(--primary) text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placingOrder ? "Placing order..." : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
