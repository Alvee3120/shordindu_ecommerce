"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiSearch } from "react-icons/fi";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/coupons";
import { useAuth } from "@/context/AuthContext";
import { formatBDT, formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import CouponDetailModal, { formatCouponValue } from "@/components/admin/CouponDetailModal";

const EMPTY_FORM = {
  code: "",
  type: "flat",
  value: "",
  min_order_amount: "0",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
};

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "exhausted", label: "Usage limit reached" },
];

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

/**
 * One coupon screen for both roles (also served at /dashboard/cce/coupons).
 * Admins can add/edit/delete; CCE users get the same list, filters and
 * details read-only. The role comes from the authenticated session, and the
 * backend independently rejects coupon writes from anyone but an admin.
 */
export default function AdminCouponsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [coupons, setCoupons] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewing, setViewing] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await listCoupons({ page, search, type: typeFilter, status: statusFilter });
      setCoupons(data.results);
      setCount(data.count);
    } catch (err) {
      setLoadError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasFilters = Boolean(search || typeFilter || statusFilter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Coupons</h1>
          {!canManage && (
            <p className="mt-1 text-sm text-neutral-500">View-only — coupons are managed by administrators.</p>
          )}
        </div>
        {canManage && editingId === null && (
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

      {canManage && editingId !== null && (
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <FiSearch
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search coupon code..."
            aria-label="Search coupons"
            className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by type"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        >
          <option value="">All types</option>
          <option value="flat">Flat</option>
          <option value="percent">Percent</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && coupons.length === 0 ? (
        <div className="animate-pulse space-y-2 rounded-xl border border-neutral-200 bg-white p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-neutral-100" />
          ))}
        </div>
      ) : loadError && coupons.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-neutral-500">{hasFilters ? "No coupons match these filters." : "No coupons yet."}</p>
      ) : (
        <div className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 whitespace-nowrap text-neutral-500">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Min Order</th>
                <th className="px-5 py-3 font-medium">Starts</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Usage</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-neutral-100 whitespace-nowrap last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900">{coupon.code}</td>
                  <td className="px-5 py-3 text-neutral-600 capitalize">{coupon.type}</td>
                  <td className="px-5 py-3 text-neutral-600">{formatCouponValue(coupon)}</td>
                  <td className="px-5 py-3 text-neutral-600">{formatBDT(coupon.min_order_amount)}</td>
                  <td className="px-5 py-3 text-neutral-600">{coupon.starts_at ? formatDate(coupon.starts_at) : "—"}</td>
                  <td className="px-5 py-3 text-neutral-600">{coupon.ends_at ? formatDate(coupon.ends_at) : "Never"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge value={coupon.status} />
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {coupon.usage_count} / {coupon.usage_limit ?? "∞"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => setViewing(coupon)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEye size={14} />
                        View
                      </button>
                      {canManage && (
                        <>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {viewing && <CouponDetailModal coupon={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
