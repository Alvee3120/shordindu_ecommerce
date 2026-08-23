"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/coupons";

const EMPTY_FORM = {
  code: "",
  type: "flat",
  value: "",
  min_order_amount: "0",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
};

function toInputPayload(form) {
  return {
    code: form.code,
    type: form.type,
    value: form.value,
    min_order_amount: form.min_order_amount || "0",
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
  };
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCoupons();
      setCoupons(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
    setEditingId("new");
  };

  const openEditForm = (coupon) => {
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      min_order_amount: coupon.min_order_amount,
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : "",
      ends_at: coupon.ends_at ? coupon.ends_at.slice(0, 16) : "",
      usage_limit: coupon.usage_limit ?? "",
    });
    setFieldErrors({});
    setFormError("");
    setEditingId(coupon.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = toInputPayload(form);
      if (editingId === "new") {
        await createCoupon(payload);
        toast.success("Coupon created");
      } else {
        await updateCoupon(editingId, payload);
        toast.success("Coupon updated");
      }
      closeForm();
      await load();
    } catch (err) {
      if (err.status === 400 && err.data) {
        setFieldErrors(err.data);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this coupon?")) return;
    setDeletingId(id);
    try {
      await deleteCoupon(id);
      toast.success("Coupon deleted");
      setCoupons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Coupons</h1>
        {editingId === null && (
          <button
            type="button"
            onClick={openNewForm}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Add Coupon
          </button>
        )}
      </div>

      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-neutral-900">
            {editingId === "new" ? "New Coupon" : "Edit Coupon"}
          </h2>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Code</label>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm uppercase outline-none focus:ring-2 focus:ring-(--primary)"
              />
              {fieldErrors.code && <p className="mt-1 text-xs text-red-600">{fieldErrors.code[0]}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              >
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Value {form.type === "percent" ? "(%)" : "(৳)"}
              </label>
              <input
                type="number"
                step="0.01"
                name="value"
                value={form.value}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
              {fieldErrors.value && <p className="mt-1 text-xs text-red-600">{fieldErrors.value[0]}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Min Order Amount
              </label>
              <input
                type="number"
                step="0.01"
                name="min_order_amount"
                value={form.min_order_amount}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Starts At <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                name="starts_at"
                value={form.starts_at}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Ends At <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                name="ends_at"
                value={form.ends_at}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Usage Limit <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="number"
                name="usage_limit"
                value={form.usage_limit}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Coupon"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading coupons...
        </p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-neutral-500">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Min Order</th>
                <th className="px-5 py-3 font-medium">Usage Limit</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900">{coupon.code}</td>
                  <td className="px-5 py-3 text-neutral-600 capitalize">{coupon.type}</td>
                  <td className="px-5 py-3 text-neutral-600">
                    {coupon.type === "percent" ? `${coupon.value}%` : `৳${coupon.value}`}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">৳{coupon.min_order_amount}</td>
                  <td className="px-5 py-3 text-neutral-600">{coupon.usage_limit ?? "Unlimited"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(coupon)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(coupon.id)}
                        disabled={deletingId === coupon.id}
                        className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <FiTrash2 size={14} />
                        {deletingId === coupon.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
