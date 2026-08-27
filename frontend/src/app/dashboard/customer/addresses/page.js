"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2, FiStar } from "react-icons/fi";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/addresses";

const EMPTY_FORM = { name: "", phone: "", address: "", district: "", is_default: false };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = create, or an address id
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const data = await listAddresses();
      setAddresses(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
    setEditingId("new");
  };

  const openEditForm = (addr) => {
    setForm({
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      district: addr.district,
      is_default: addr.is_default,
    });
    setFieldErrors({});
    setFormError("");
    setEditingId(addr.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (editingId === "new") {
        await createAddress(form);
        toast.success("Address added");
      } else {
        await updateAddress(editingId, form);
        toast.success("Address updated");
      }
      closeForm();
      await loadAddresses();
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
    if (!confirm("Delete this address?")) return;
    setDeletingId(id);
    try {
      await deleteAddress(id);
      toast.success("Address deleted");
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (addr) => {
    try {
      await updateAddress(addr.id, { ...addr, is_default: true });
      toast.success("Default address updated");
      await loadAddresses();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">My Addresses</h1>
        {editingId === null && (
          <button
            type="button"
            onClick={openNewForm}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Add Address
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
            {editingId === "new" ? "New Address" : "Edit Address"}
          </h2>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Phone <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Address</label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
            {fieldErrors.address && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.address[0]}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">District</label>
            <input
              type="text"
              name="district"
              value={form.district}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
            {fieldErrors.district && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.district[0]}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="is_default"
              checked={form.is_default}
              onChange={handleChange}
              className="h-4 w-4 rounded border-neutral-300 accent-(--primary)"
            />
            Set as default address
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Address"}
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
          Loading addresses...
        </p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-neutral-500">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-neutral-900">{addr.name}</p>
                  {addr.phone && <p className="text-sm text-neutral-500">{addr.phone}</p>}
                </div>
                {addr.is_default && (
                  <span className="flex items-center gap-1 rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-semibold text-(--primary)">
                    <FiStar size={12} />
                    Default
                  </span>
                )}
              </div>

              <p className="text-sm text-neutral-600">{addr.address}</p>
              <p className="text-sm text-neutral-500">{addr.district}</p>

              <div className="mt-2 flex items-center gap-4 border-t border-neutral-100 pt-3 text-sm">
                <button
                  type="button"
                  onClick={() => openEditForm(addr)}
                  className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                >
                  <FiEdit2 size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  disabled={deletingId === addr.id}
                  className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <FiTrash2 size={14} />
                  {deletingId === addr.id ? "Deleting..." : "Delete"}
                </button>
                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr)}
                    className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                  >
                    <FiStar size={14} />
                    Set default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
