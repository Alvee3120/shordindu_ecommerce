"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiChevronLeft, FiEdit2, FiTrash2 } from "react-icons/fi";
import { getCart } from "@/lib/cart";
import { getMe } from "@/lib/auth";
import { listAddresses, updateAddress, deleteAddress } from "@/lib/addresses";
import { checkout } from "@/lib/orders";
import { getDeliveryFee } from "@/lib/districts";
import { useCart } from "@/context/CartContext";
import DistrictSelect from "@/components/shared/DistrictSelect";

const PHONE_RE = /^(?:\+?880|0)1[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_GUEST_FORM = {
  email: "",
  shipping_name: "",
  shipping_phone: "",
  shipping_address: "",
  shipping_district: "",
  order_note: "",
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
  const [createAccount, setCreateAccount] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Editing/deleting one of the user's saved addresses inline, right here on
  // checkout, instead of sending them away to the addresses page.
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);

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
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleDistrictChange = (district) => {
    setGuestForm((prev) => ({ ...prev, shipping_district: district }));
    if (formErrors.shipping_district) {
      setFormErrors((prev) => ({ ...prev, shipping_district: undefined }));
    }
  };

  const openEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setEditForm({
      name: addr.name,
      phone: addr.phone || "",
      address: addr.address,
      district: addr.district,
      is_default: addr.is_default,
    });
    setEditFieldErrors({});
  };

  const closeEditAddress = () => {
    setEditingAddressId(null);
    setEditForm(null);
    setEditFieldErrors({});
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    setEditFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleEditAddressSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const updated = await updateAddress(editingAddressId, editForm);
      setAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success("Address updated");
      closeEditAddress();
    } catch (err) {
      if (err.status === 400 && err.data) {
        setEditFieldErrors(err.data);
      } else {
        toast.error(err.message);
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addr) => {
    if (!confirm("Delete this address?")) return;
    setDeletingAddressId(addr.id);
    try {
      await deleteAddress(addr.id);
      const remaining = addresses.filter((a) => a.id !== addr.id);
      setAddresses(remaining);
      if (String(selectedAddressId) === String(addr.id)) {
        const next = remaining.find((a) => a.is_default) || remaining[0];
        if (next) setSelectedAddressId(next.id);
        else setUseNewAddress(true);
      }
      toast.success("Address deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingAddressId(null);
    }
  };

  const usingInlineAddress = !user || useNewAddress || addresses.length === 0;

  const validateGuestForm = () => {
    const errors = {};
    if (!user && createAccount && !guestForm.email.trim()) {
      errors.email = "Email is required to create an account.";
    } else if (!user && guestForm.email.trim() && !EMAIL_RE.test(guestForm.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!guestForm.shipping_name.trim()) {
      errors.shipping_name = "Full name is required.";
    }
    if (!guestForm.shipping_phone.trim()) {
      errors.shipping_phone = "Phone number is required.";
    } else if (!PHONE_RE.test(guestForm.shipping_phone.trim())) {
      errors.shipping_phone = "Enter a valid Bangladeshi mobile number.";
    }
    if (!guestForm.shipping_district) {
      errors.shipping_district = "Please select a district.";
    }
    if (!guestForm.shipping_address.trim()) {
      errors.shipping_address = "Street address / house details are required.";
    }
    return errors;
  };

  const handlePlaceOrder = async () => {
    if (!cart?.items?.length) return;

    const payload = {};
    if (user) {
      if (usingInlineAddress) {
        const errors = validateGuestForm();
        if (Object.keys(errors).length) {
          setFormErrors(errors);
          toast.error("Please fix the highlighted fields.");
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
      const errors = validateGuestForm();
      if (Object.keys(errors).length) {
        setFormErrors(errors);
        toast.error("Please fix the highlighted fields.");
        return;
      }
      payload.email = guestForm.email;
      payload.create_account = createAccount;
      payload.shipping_name = guestForm.shipping_name;
      payload.shipping_phone = guestForm.shipping_phone;
      payload.shipping_address = guestForm.shipping_address;
      payload.shipping_district = guestForm.shipping_district;
    }

    setPlacingOrder(true);
    try {
      const order = await checkout(payload);
      toast.success(`Order ${order.order_number} placed — cash on delivery`);
      if (!user && createAccount) {
        toast.success("Account created — check your email for your login password.");
      }
      refreshCart();
      router.push(`/dashboard/customer/orders/${order.id}`);
    } catch (err) {
      toast.error(err.message || "Could not place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const selectedAddress = addresses.find((a) => String(a.id) === String(selectedAddressId));
  const activeDistrict = usingInlineAddress ? guestForm.shipping_district : selectedAddress?.district;
  const deliveryFee = getDeliveryFee(activeDistrict);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading checkout...
      </div>
    );
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
  const total = subtotal + (deliveryFee ?? 0);

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
                {addresses.map((addr) =>
                  editingAddressId === addr.id ? (
                    <form
                      key={addr.id}
                      onSubmit={handleEditAddressSubmit}
                      className="flex flex-col gap-3 rounded-lg border border-(--primary) bg-(--primary)/5 p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-700">Name</label>
                          <input
                            type="text"
                            name="name"
                            value={editForm.name}
                            onChange={handleEditFormChange}
                            required
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                          {editFieldErrors.name && (
                            <p className="mt-1 text-xs text-red-600">{editFieldErrors.name[0]}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-700">Phone</label>
                          <input
                            type="tel"
                            name="phone"
                            value={editForm.phone}
                            onChange={handleEditFormChange}
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                          {editFieldErrors.phone && (
                            <p className="mt-1 text-xs text-red-600">{editFieldErrors.phone[0]}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">District</label>
                        <DistrictSelect
                          value={editForm.district}
                          onChange={(district) => setEditForm((prev) => ({ ...prev, district }))}
                          error={editFieldErrors.district?.[0]}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">Address</label>
                        <textarea
                          name="address"
                          value={editForm.address}
                          onChange={handleEditFormChange}
                          required
                          rows={2}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                        />
                        {editFieldErrors.address && (
                          <p className="mt-1 text-xs text-red-600">{editFieldErrors.address[0]}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={editSubmitting}
                          className="rounded-lg bg-(--primary) px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {editSubmitting ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={closeEditAddress}
                          className="rounded-lg px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      key={addr.id}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        String(selectedAddressId) === String(addr.id)
                          ? "border-(--primary) bg-(--primary)/10"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <label className="flex flex-1 cursor-pointer items-start gap-2">
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
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => openEditAddress(addr)}
                          aria-label="Edit address"
                          className="text-neutral-500 hover:text-(--primary)"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr)}
                          disabled={deletingAddressId === addr.id}
                          aria-label="Delete address"
                          className="text-neutral-500 hover:text-red-600 disabled:opacity-50"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setUseNewAddress(true)}
                  className="mt-1 text-left text-xs font-medium text-(--primary) hover:underline"
                >
                  Ship to a different address
                </button>
              </div>
            )}

            {usingInlineAddress && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="shipping_name" className="mb-1 block text-xs font-medium text-neutral-700">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="shipping_name"
                      name="shipping_name"
                      value={guestForm.shipping_name}
                      onChange={handleGuestChange}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
                        formErrors.shipping_name ? "border-red-400" : "border-neutral-300"
                      }`}
                    />
                    {formErrors.shipping_name && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.shipping_name}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="shipping_phone" className="mb-1 block text-xs font-medium text-neutral-700">
                      Phone number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="shipping_phone"
                      name="shipping_phone"
                      placeholder="01XXXXXXXXX"
                      value={guestForm.shipping_phone}
                      onChange={handleGuestChange}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
                        formErrors.shipping_phone ? "border-red-400" : "border-neutral-300"
                      }`}
                    />
                    {formErrors.shipping_phone && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.shipping_phone}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {!user && (
                    <div>
                      <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-700">
                        Email address {createAccount && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={guestForm.email}
                        onChange={handleGuestChange}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
                          formErrors.email ? "border-red-400" : "border-neutral-300"
                        }`}
                      />
                      {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
                    </div>
                  )}
                  <div>
                    <label htmlFor="district" className="mb-1 block text-xs font-medium text-neutral-700">
                      District <span className="text-red-500">*</span>
                    </label>
                    <DistrictSelect
                      id="district"
                      value={guestForm.shipping_district}
                      onChange={handleDistrictChange}
                      error={formErrors.shipping_district}
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      {deliveryFee != null
                        ? `Delivery charge: ৳${deliveryFee} (${
                            guestForm.shipping_district === "Dhaka" ? "inside Dhaka" : "outside Dhaka"
                          })`
                        : "Select a district to calculate delivery charge"}
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="shipping_address" className="mb-1 block text-xs font-medium text-neutral-700">
                    Full street address / house details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="shipping_address"
                    name="shipping_address"
                    value={guestForm.shipping_address}
                    onChange={handleGuestChange}
                    rows={3}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
                      formErrors.shipping_address ? "border-red-400" : "border-neutral-300"
                    }`}
                  />
                  {formErrors.shipping_address && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.shipping_address}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="order_note" className="mb-1 block text-xs font-medium text-neutral-700">
                    Order note / special instructions <span className="text-neutral-400">(optional)</span>
                  </label>
                  <textarea
                    id="order_note"
                    name="order_note"
                    value={guestForm.order_note}
                    onChange={handleGuestChange}
                    rows={2}
                    placeholder="E.g. call before delivery, leave with security guard, etc."
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                  />
                </div>
                {!user && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Save details to track orders</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        We&apos;ll create an account using your email to make your next order faster.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={createAccount}
                      onClick={() => setCreateAccount((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        createAccount ? "bg-(--primary)" : "bg-neutral-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          createAccount ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                )}
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
            <span className="text-neutral-500">Delivery charge</span>
            <span className="font-medium text-(--primary)">
              {deliveryFee != null ? `৳${deliveryFee.toFixed(2)}` : (
                <span className="text-xs font-normal text-neutral-400">Select a district</span>
              )}
            </span>
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
