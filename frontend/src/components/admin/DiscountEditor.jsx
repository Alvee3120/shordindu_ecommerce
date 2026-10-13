"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FiArrowLeft, FiBox, FiInfo, FiX } from "react-icons/fi";
import { getCategories } from "@/lib/categories";
import { createDiscount, getDiscount, updateDiscount } from "@/lib/discounts";
import { formatBDT } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import CategorySelect from "@/components/admin/CategorySelect";
import ProductPicker from "@/components/cce/ProductPicker";

const LIST_PATH = "/dashboard/admin/discounts";

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  name: "",
  type: "percent",
  value: "",
  target_type: "category",
  category: null,
  start_date: "",
  start_time: "00:00",
  end_date: "",
  end_time: "23:59",
  is_active: true,
};

// API datetimes come back in Bangladesh time (+06:00), the same zone the
// backend reads these naive inputs in — so the date/time parts map 1:1.
function splitDateTime(value) {
  return value ? { date: value.slice(0, 10), time: value.slice(11, 16) } : { date: "", time: "" };
}

function toForm(discount) {
  const start = splitDateTime(discount.starts_at);
  const end = splitDateTime(discount.ends_at);
  return {
    name: discount.name,
    type: discount.type,
    value: String(Number(discount.value)),
    target_type: discount.target_type,
    category: discount.category,
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
    is_active: discount.is_active,
  };
}

function toSelectedProduct(product) {
  // From a ProductPicker search result.
  const variations = product.variations || [];
  const images = product.images || [];
  return {
    id: product.id,
    name: product.name,
    status: product.status,
    image: images.find((i) => i.is_primary)?.image || images[0]?.image || null,
    sku: variations.length === 1 ? variations[0].sku : product.sku_prefix || null,
    min_price: variations.length ? Math.min(...variations.map((v) => Number(v.price))) : null,
  };
}

const inputClass = (error) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

function Field({ label, error, hint, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value ? "bg-white text-(--primary) shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function validate(form, products) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Give the discount a name.";
  const value = Number(form.value);
  if (form.value === "" || !Number.isFinite(value)) errors.value = "Enter a discount value.";
  else if (value <= 0) errors.value = "The value must be greater than 0.";
  else if (form.type === "percent" && value > 100) errors.value = "A percentage can't be more than 100.";
  else if (!/^\d+(\.\d{1,2})?$/.test(form.value.trim())) errors.value = "Use at most 2 decimal places.";
  if (form.target_type === "category" && !form.category) errors.category = "Choose a category.";
  if (form.target_type === "products" && products.length === 0) errors.products = "Choose at least one product.";
  if (!form.start_date || !form.start_time) errors.starts_at = "Choose a start date and time.";
  if (!form.end_date || !form.end_time) errors.ends_at = "Choose an end date and time.";
  if (!errors.starts_at && !errors.ends_at) {
    if (`${form.end_date}T${form.end_time}` <= `${form.start_date}T${form.start_time}`) {
      errors.ends_at = "The end must be after the start.";
    }
  }
  return errors;
}

/** Create (no `discountId`) or edit an automatic discount. */
export default function DiscountEditor({ discountId }) {
  const router = useRouter();
  const isNew = !discountId;
  const [form, setForm] = useState(() => (isNew ? { ...EMPTY_FORM, start_date: todayISO() } : null));
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCategories({ pageSize: 100 })
      .then((data) => !cancelled && setCategories(data.results ?? data))
      .catch((err) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setCategoriesLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;
    getDiscount(discountId)
      .then((discount) => {
        if (cancelled) return;
        setForm(toForm(discount));
        setProducts(discount.product_details ?? []);
        setStatus(discount.status);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [discountId, isNew]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const errorKey = field.startsWith("start_") ? "starts_at" : field.startsWith("end_") ? "ends_at" : field;
    setErrors((prev) => ({ ...prev, [errorKey]: undefined }));
  };

  const addProduct = (product) => {
    setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, toSelectedProduct(product)]));
    setErrors((prev) => ({ ...prev, products: undefined, value: undefined }));
  };

  const removeProduct = (id) => setProducts((prev) => prev.filter((p) => p.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = validate(form, products);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      value: form.value.trim(),
      target_type: form.target_type,
      category: form.target_type === "category" ? form.category : null,
      products: form.target_type === "products" ? products.map((p) => p.id) : [],
      starts_at: `${form.start_date}T${form.start_time}`,
      ends_at: `${form.end_date}T${form.end_time}`,
      is_active: form.is_active,
    };
    setSaving(true);
    try {
      if (isNew) await createDiscount(payload);
      else await updateDiscount(discountId, payload);
      toast.success(isNew ? "Discount created." : "Discount updated.");
      router.push(LIST_PATH);
    } catch (err) {
      if (err.status === 400 && err.data) {
        setErrors(Object.fromEntries(Object.entries(err.data).map(([key, value]) => [key, value?.[0] ?? value])));
      }
      toast.error(err.message);
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{loadError}</p>
        <Link href={LIST_PATH} className="mt-3 inline-block font-semibold underline">
          Back to discounts
        </Link>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-3xl animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-neutral-200" />
        <div className="h-56 rounded-xl bg-neutral-100" />
        <div className="h-40 rounded-xl bg-neutral-100" />
      </div>
    );
  }

  const value = Number(form.value);
  const example = Number.isFinite(value) && value > 0
    ? form.type === "percent"
      ? `A ৳2,000 item becomes ${formatBDT(Math.max(0, 2000 - Math.round(2000 * Math.min(value, 100)) / 100))}.`
      : `Every targeted item's price drops by ${formatBDT(value)}.`
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl pb-10">
      <Link href={LIST_PATH} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-(--primary)">
        <FiArrowLeft size={14} /> Discounts
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">{isNew ? "Add Discount" : "Edit Discount"}</h1>
        {status && <StatusBadge value={status} />}
      </div>

      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-neutral-900">Discount</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discount name" error={errors.name} htmlFor="name" className="sm:col-span-2">
            <input
              id="name"
              value={form.name}
              maxLength={120}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Summer Sale"
              className={inputClass(errors.name)}
            />
          </Field>
          <Field label="Discount type" error={errors.type}>
            <Segmented
              label="Discount type"
              value={form.type}
              onChange={(v) => update("type", v)}
              options={[
                { value: "percent", label: "Percentage" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
          </Field>
          <Field label="Discount value" error={errors.value} hint={example} htmlFor="value">
            <div className={`flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-(--primary) ${errors.value ? "border-red-400" : "border-neutral-300"}`}>
              {form.type === "fixed" && <span className="pl-3 text-sm text-neutral-500">৳</span>}
              <input
                id="value"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={form.type === "percent" ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => update("value", e.target.value)}
                className="w-full min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
              />
              {form.type === "percent" && <span className="pr-3 text-sm text-neutral-500">%</span>}
            </div>
          </Field>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-neutral-900">Applies to</h2>
        <Segmented
          label="Target type"
          value={form.target_type}
          onChange={(v) => update("target_type", v)}
          options={[
            { value: "category", label: "Category" },
            { value: "products", label: "Specific products" },
          ]}
        />

        {form.target_type === "category" ? (
          <div className="mt-4">
            <Field label="Target category" error={null} htmlFor="category">
              <CategorySelect
                categories={categories}
                loading={categoriesLoading}
                value={form.category}
                onChange={(id) => update("category", id)}
                error={errors.category}
              />
            </Field>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-500">
              <FiInfo size={13} className="mt-0.5 shrink-0" />
              Includes products in this category and all of its sub-categories — the same products the shop shows
              for it.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <ProductPicker
              status={null}
              onSelectProduct={addProduct}
              isProductSelected={(product) => products.some((p) => p.id === product.id)}
            />
            {errors.products && <p className="mt-2 text-xs text-red-600">{errors.products}</p>}
            <p className="mt-4 mb-2 text-xs font-medium text-neutral-700">
              Selected products {products.length > 0 && <span className="text-neutral-400">({products.length})</span>}
            </p>
            {products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 py-6 text-center text-sm text-neutral-400">
                Search above and click a product to add it.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {products.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FiBox size={15} className="text-neutral-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {[product.sku, product.min_price != null && `from ${formatBDT(product.min_price)}`, product.status !== "active" && product.status]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      aria-label={`Remove ${product.name}`}
                      className="rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiX size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-neutral-900">Schedule</h2>
        <p className="mb-4 text-xs text-neutral-500">Bangladesh time. Prices change automatically at the start and end.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" error={errors.starts_at}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                className={inputClass(errors.starts_at)}
              />
              <input
                type="time"
                aria-label="Start time"
                value={form.start_time}
                onChange={(e) => update("start_time", e.target.value)}
                className={inputClass(errors.starts_at)}
              />
            </div>
          </Field>
          <Field label="End" error={errors.ends_at}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                type="date"
                aria-label="End date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => update("end_date", e.target.value)}
                className={inputClass(errors.ends_at)}
              />
              <input
                type="time"
                aria-label="End time"
                value={form.end_time}
                onChange={(e) => update("end_time", e.target.value)}
                className={inputClass(errors.ends_at)}
              />
            </div>
          </Field>
        </div>

        <label className="mt-5 flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-neutral-800">Active</span>
            <span className="block text-xs text-neutral-500">Turn off to pause the discount without deleting it.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            aria-label="Active"
            onClick={() => update("is_active", !form.is_active)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              form.is_active ? "bg-(--primary)" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.is_active ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={LIST_PATH} className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-(--primary) px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : isNew ? "Create Discount" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
