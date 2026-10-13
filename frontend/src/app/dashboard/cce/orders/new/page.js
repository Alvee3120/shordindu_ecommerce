"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FiArrowLeft, FiBox, FiCheckCircle, FiMinus, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { createManualOrder, quoteManualOrder } from "@/lib/orders";
import { isDhaka, resolveDeliveryCharge } from "@/lib/delivery";
import { formatBDT } from "@/lib/format";
import DistrictSelect from "@/components/shared/DistrictSelect";
import DhakaZoneSelect from "@/components/shared/DhakaZoneSelect";
import { useDeliveryCharges } from "@/components/shared/useDeliveryCharges";
import ProductPicker from "@/components/cce/ProductPicker";
import CustomerLookup from "@/components/cce/CustomerLookup";

// Same rules as the storefront checkout (and the backend serializer).
const PHONE_RE = /^(?:\+?880|0)1[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "", district: "", zone: "", note: "" };

function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
  );
}

function Field({ label, required, error, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-neutral-700">
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-neutral-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

function quantityError(line) {
  const qty = line.quantity;
  if (qty === "" || !Number.isInteger(qty) || qty < 1) return "Enter a quantity of at least 1.";
  if (qty > line.stock) return `Only ${line.stock} in stock.`;
  return null;
}

export default function AddOrderPage() {
  const { user } = useAuth();
  const delivery = useDeliveryCharges();
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [linkedCustomer, setLinkedCustomer] = useState(null);
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [quote, setQuote] = useState({ key: null, data: null });
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  // One id per draft: a double-click or retry re-sends it, and the backend
  // answers with the order the first request created instead of a duplicate.
  const [requestId, setRequestId] = useState(newRequestId);

  const canCreate = user?.role === "cce" || user?.role === "admin";

  // ---- order items ------------------------------------------------------
  const quantityInOrder = (variationId) => {
    const qty = lines.find((l) => l.variationId === variationId)?.quantity;
    return Number.isInteger(qty) ? qty : 0;
  };

  const addLine = (line) => {
    setItemErrors([]);
    setErrors((prev) => ({ ...prev, items: undefined }));
    const existing = lines.find((l) => l.variationId === line.variationId);
    if (existing) {
      const next = (Number.isInteger(existing.quantity) ? existing.quantity : 0) + 1;
      if (next > line.stock) {
        toast.error(`Only ${line.stock} of ${line.name} in stock.`);
        return;
      }
      setLines((prev) => prev.map((l) => (l.variationId === line.variationId ? { ...l, ...line, quantity: next } : l)));
      return;
    }
    if (line.stock < 1) {
      toast.error(`${line.name} is out of stock.`);
      return;
    }
    setLines((prev) => [...prev, { ...line, quantity: 1 }]);
  };

  const setQuantity = (variationId, raw) => {
    const value = raw === "" ? "" : Number.parseInt(raw, 10);
    setLines((prev) =>
      prev.map((l) => (l.variationId === variationId ? { ...l, quantity: Number.isNaN(value) ? "" : value } : l))
    );
  };

  const stepQuantity = (variationId, delta) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.variationId !== variationId) return l;
        const current = Number.isInteger(l.quantity) ? l.quantity : 0;
        return { ...l, quantity: Math.min(Math.max(current + delta, 1), Math.max(l.stock, 1)) };
      })
    );
  };

  const removeLine = (variationId) => setLines((prev) => prev.filter((l) => l.variationId !== variationId));

  // ---- customer ---------------------------------------------------------
  const updateCustomer = (field, value) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleDistrictChange = (district) => {
    setCustomer((prev) => ({ ...prev, district, zone: district === prev.district ? prev.zone : "" }));
    setErrors((prev) => ({ ...prev, district: undefined, zone: undefined }));
  };

  const handleSelectCustomer = (found) => {
    const address = found.addresses?.[0];
    setLinkedCustomer({ id: found.id, name: found.name });
    setCustomer((prev) => ({
      ...prev,
      name: address?.name || found.name || "",
      phone: address?.phone || found.phone || "",
      email: found.email || "",
      address: address?.address || "",
      district: address?.district || "",
      zone: address?.zone || "",
    }));
    setErrors({});
  };

  // ---- totals -----------------------------------------------------------
  const allQuantitiesValid = lines.length > 0 && lines.every((l) => !quantityError(l));
  const localSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * (Number.isInteger(l.quantity) ? l.quantity : 0), 0);
  const totalItems = lines.reduce((sum, l) => sum + (Number.isInteger(l.quantity) ? l.quantity : 0), 0);
  const deliveryCharge = resolveDeliveryCharge(delivery.config, customer.district, customer.zone);

  const quotePayload = useMemo(
    () =>
      allQuantitiesValid
        ? {
            items: lines.map((l) => ({ variation: l.variationId, quantity: l.quantity })),
            district: customer.district,
            zone: customer.zone,
            coupon_code: appliedCoupon || undefined,
          }
        : null,
    [allQuantitiesValid, lines, customer.district, customer.zone, appliedCoupon]
  );
  const quoteKey = quotePayload ? JSON.stringify(quotePayload) : null;

  // Server-side quote (same pricing code as order creation) keeps the summary
  // honest: discount eligibility, current prices and stock are all re-checked.
  useEffect(() => {
    if (!quoteKey) return undefined;
    let cancelled = false;
    const timeout = setTimeout(() => {
      quoteManualOrder(JSON.parse(quoteKey))
        .then((data) => {
          if (cancelled) return;
          setQuote({ key: quoteKey, data });
          setItemErrors([]);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.data?.coupon_code) {
            setCouponError(err.data.coupon_code[0]);
            setAppliedCoupon("");
          } else if (err.data?.items) {
            setItemErrors(err.data.items);
          }
          setQuote({ key: quoteKey, data: null });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [quoteKey]);

  const freshQuote = quote.key === quoteKey ? quote.data : null;
  const subtotal = freshQuote ? Number(freshQuote.subtotal) : localSubtotal;
  const discount = freshQuote ? Number(freshQuote.discount_total) : 0;
  const deliveryFee = deliveryCharge?.fee ?? null;
  const grandTotal = subtotal - discount + (deliveryFee ?? 0);
  const quotePending = Boolean(quoteKey) && !freshQuote && !itemErrors.length;
  const priceChanged = freshQuote && Math.abs(Number(freshQuote.subtotal) - localSubtotal) > 0.001;

  const applyCoupon = () => {
    const code = couponInput.trim();
    setCouponError("");
    if (!code) return;
    if (!lines.length) {
      setCouponError("Add products before applying a coupon.");
      return;
    }
    setAppliedCoupon(code);
  };

  // ---- submit -----------------------------------------------------------
  const validate = () => {
    const next = {};
    if (!customer.name.trim()) next.name = "Customer name is required.";
    if (!customer.phone.trim()) next.phone = "Phone number is required.";
    else if (!PHONE_RE.test(customer.phone.trim())) next.phone = "Enter a valid Bangladeshi mobile number.";
    if (customer.email.trim() && !EMAIL_RE.test(customer.email.trim())) next.email = "Enter a valid email address.";
    if (!customer.address.trim()) next.address = "Delivery address is required.";
    if (!customer.district) next.district = "Select a district.";
    else if (isDhaka(delivery.config, customer.district) && !customer.zone) next.zone = "Select a Dhaka zone.";
    if (!lines.length) next.items = "Add at least one product.";
    else if (!allQuantitiesValid) next.items = "Fix the highlighted quantities.";
    return next;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await createManualOrder({
        customer: linkedCustomer?.id ?? null,
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        address: customer.address.trim(),
        district: customer.district,
        zone: customer.zone,
        note: customer.note.trim(),
        items: lines.map((l) => ({ variation: l.variationId, quantity: l.quantity })),
        coupon_code: appliedCoupon || undefined,
        client_request_id: requestId,
      });
      toast.success(`Order ${order.order_number} created.`);
      setCreatedOrder(order);
    } catch (err) {
      const data = err.data || {};
      const fieldErrors = {};
      ["name", "phone", "email", "address", "district", "zone"].forEach((field) => {
        if (data[field]) fieldErrors[field] = data[field][0];
      });
      if (data.shipping_zone) fieldErrors.zone = data.shipping_zone[0];
      if (Array.isArray(data.items)) {
        setItemErrors(data.items.map((item) => (typeof item === "string" ? item : Object.values(item).flat()[0])));
      }
      if (data.coupon_code) setCouponError(data.coupon_code[0]);
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      toast.error(err.message || "Could not create the order.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetDraft = () => {
    setCustomer(EMPTY_CUSTOMER);
    setLinkedCustomer(null);
    setLines([]);
    setErrors({});
    setItemErrors([]);
    setCouponInput("");
    setAppliedCoupon("");
    setCouponError("");
    setQuote({ key: null, data: null });
    setCreatedOrder(null);
    setRequestId(newRequestId());
  };

  const clearDraft = () => {
    if (confirm("Clear this order? All entered customer details and products will be removed.")) resetDraft();
  };

  if (!canCreate) {
    return <p className="text-sm text-neutral-500">Only customer care staff and administrators can create orders.</p>;
  }

  if (createdOrder) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <FiCheckCircle size={36} className="mx-auto text-emerald-600" />
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">Order {createdOrder.order_number} created</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {formatBDT(createdOrder.grand_total)} · cash on delivery · status{" "}
          <span className="capitalize">{createdOrder.status}</span>
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/dashboard/cce/orders/${createdOrder.id}`}
            className="rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--primary)/90"
          >
            View order
          </Link>
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Create another order
          </button>
        </div>
      </div>
    );
  }

  const showZone = isDhaka(delivery.config, customer.district);

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/cce/orders"
            className="mb-1 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)"
          >
            <FiArrowLeft size={14} /> Orders
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900">Add Order</h1>
        </div>
        {(lines.length > 0 || customer.name || customer.phone) && (
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Customer information */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">1. Customer Information</h2>

            {linkedCustomer ? (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-(--primary)/5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-neutral-700">
                  Linked to account <span className="font-semibold text-neutral-900">{linkedCustomer.name}</span>
                  <span className="block text-xs text-neutral-500">
                    Changes below apply to this order only — the saved profile is not modified.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setLinkedCustomer(null)}
                  aria-label="Unlink customer account"
                  className="shrink-0 rounded-full p-1 text-neutral-500 hover:bg-white hover:text-red-600"
                >
                  <FiX size={16} />
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <CustomerLookup onSelect={handleSelectCustomer} />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" required error={errors.name} htmlFor="name">
                <input
                  id="name"
                  value={customer.name}
                  onChange={(e) => updateCustomer("name", e.target.value)}
                  className={inputClass(errors.name)}
                />
              </Field>
              <Field label="Phone number" required error={errors.phone} htmlFor="phone">
                <input
                  id="phone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value)}
                  className={inputClass(errors.phone)}
                />
              </Field>
              <Field label="District" required error={errors.district} htmlFor="district">
                <DistrictSelect value={customer.district} onChange={handleDistrictChange} />
              </Field>
              {showZone && (
                <Field label="Zone" required htmlFor="zone">
                  <DhakaZoneSelect
                    config={delivery.config}
                    value={customer.zone}
                    onChange={(zone) => updateCustomer("zone", zone)}
                    error={errors.zone}
                  />
                </Field>
              )}
              <Field label="Full delivery address" required error={errors.address} htmlFor="address" className="sm:col-span-2">
                <textarea
                  id="address"
                  rows={2}
                  value={customer.address}
                  onChange={(e) => updateCustomer("address", e.target.value)}
                  placeholder="House, road, area"
                  className={inputClass(errors.address)}
                />
              </Field>
              <Field label="Email" error={errors.email} htmlFor="email">
                <input
                  id="email"
                  type="email"
                  value={customer.email}
                  onChange={(e) => updateCustomer("email", e.target.value)}
                  className={inputClass(errors.email)}
                />
              </Field>
              <Field label="Order note" htmlFor="note">
                <input
                  id="note"
                  value={customer.note}
                  onChange={(e) => updateCustomer("note", e.target.value)}
                  placeholder="E.g. call before delivery"
                  className={inputClass(false)}
                />
              </Field>
            </div>
          </section>

          {/* 2. Products */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">2. Products</h2>
            <ProductPicker onAdd={addLine} quantityInOrder={quantityInOrder} />

            {(errors.items || itemErrors.length > 0) && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {errors.items && <p>{errors.items}</p>}
                {itemErrors.map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
              </div>
            )}

            {lines.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 py-8 text-neutral-400">
                <FiBox size={22} />
                <p className="text-sm">No products added yet. Search above to add items.</p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {lines.map((line) => {
                  const qtyError = quantityError(line);
                  const qty = Number.isInteger(line.quantity) ? line.quantity : 0;
                  return (
                    <li key={line.variationId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        {line.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={line.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <FiBox size={16} className="text-neutral-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-medium text-neutral-900">{line.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {[line.variationLabel, line.sku].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatBDT(line.unitPrice)} each · {line.stock} in stock
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center rounded-lg border ${qtyError ? "border-red-400" : "border-neutral-300"}`}>
                            <button
                              type="button"
                              onClick={() => stepQuantity(line.variationId, -1)}
                              disabled={qty <= 1}
                              aria-label="Decrease quantity"
                              className="px-2 py-1.5 text-neutral-600 hover:text-(--primary) disabled:opacity-40"
                            >
                              <FiMinus size={14} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={line.stock}
                              value={line.quantity}
                              onChange={(e) => setQuantity(line.variationId, e.target.value)}
                              aria-label={`Quantity for ${line.name}`}
                              className="w-12 [appearance:textfield] text-center text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => stepQuantity(line.variationId, 1)}
                              disabled={qty >= line.stock}
                              aria-label="Increase quantity"
                              className="px-2 py-1.5 text-neutral-600 hover:text-(--primary) disabled:opacity-40"
                            >
                              <FiPlus size={14} />
                            </button>
                          </div>
                          <span className="w-24 text-right text-sm font-semibold text-neutral-900">
                            {formatBDT(line.unitPrice * qty)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(line.variationId)}
                            aria-label={`Remove ${line.name}`}
                            className="rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                        {qtyError && <p className="text-xs text-red-500">{qtyError}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* 3. Summary + delivery */}
        <aside className="h-fit rounded-xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">3. Order Summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Total items</span>
              <span className="font-medium text-neutral-900">{totalItems}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="font-medium text-neutral-900">{formatBDT(subtotal)}</span>
            </div>
            {priceChanged && (
              <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                A product price changed — the subtotal shows the current price.
              </p>
            )}
            <div className="flex justify-between text-neutral-600">
              <span>Discount{appliedCoupon && freshQuote?.coupon_code ? ` (${freshQuote.coupon_code})` : ""}</span>
              <span className="font-medium text-neutral-900">{discount > 0 ? `−${formatBDT(discount)}` : formatBDT(0)}</span>
            </div>
            <div className="flex justify-between gap-3 text-neutral-600">
              <span>
                Delivery charge
                <span className="block text-xs text-neutral-400">
                  {deliveryCharge
                    ? `${customer.zone || customer.district} · ${deliveryCharge.label}`
                    : delivery.error
                      ? "Could not load delivery charges"
                      : showZone
                        ? "Select a Dhaka zone"
                        : "Select a district"}
                </span>
              </span>
              <span className="font-medium text-neutral-900">{deliveryFee != null ? formatBDT(deliveryFee) : "—"}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-neutral-100 pt-3">
            <label htmlFor="coupon" className="mb-1 block text-xs font-medium text-neutral-700">
              Coupon <span className="text-neutral-400">(optional)</span>
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-lg bg-(--primary)/5 px-3 py-2 text-sm">
                <span className="font-semibold text-(--primary) uppercase">{appliedCoupon}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon("");
                    setCouponInput("");
                  }}
                  className="text-xs font-medium text-neutral-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setCouponError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  className={`${inputClass(couponError)} uppercase`}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Apply
                </button>
              </div>
            )}
            {couponError && <p className="mt-1 text-xs text-red-500">{couponError}</p>}
          </div>

          <div className="mt-4 flex justify-between border-t border-neutral-100 pt-3 text-base font-semibold text-neutral-900">
            <span>Grand total</span>
            <span>{formatBDT(grandTotal)}</span>
          </div>
          <p className="mt-1 min-h-4 text-right text-xs text-neutral-400">
            {quotePending ? "Checking prices…" : freshQuote ? "Verified with current prices" : ""}
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || lines.length === 0}
            className="mt-3 h-11 w-full rounded-lg bg-(--primary) text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating order..." : "Create Order"}
          </button>
          <p className="mt-2 text-center text-xs text-neutral-400">Cash on delivery · stock is reserved when the order is created</p>
        </aside>
      </div>
    </div>
  );
}
