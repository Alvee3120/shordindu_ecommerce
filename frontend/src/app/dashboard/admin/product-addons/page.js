"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import {
  listProductAddons,
  createProductAddon,
  deleteProductAddon,
} from "@/lib/productAddons";
import { listProducts } from "@/lib/products";

const EMPTY_FORM = {
  parent_product: "",
  addon_product: "",
  is_required: false,
  min_select: 0,
  max_select: 1,
  price_override: "",
  sort_order: 0,
};

export default function AdminProductAddonsPage() {
  const [addons, setAddons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [addonData, productData] = await Promise.all([
        listProductAddons(),
        listProducts({ page_size: 100 }),
      ]);
      setAddons(addonData);
      setProducts(productData.results ?? []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.parent_product || !form.addon_product) {
      setFormError("Select both a parent product and an addon product.");
      return;
    }

    setSubmitting(true);
    try {
      await createProductAddon({
        parent_product: Number(form.parent_product),
        addon_product: Number(form.addon_product),
        is_required: form.is_required,
        min_select: Number(form.min_select) || 0,
        max_select: Number(form.max_select) || 1,
        price_override: form.price_override === "" ? null : form.price_override,
        sort_order: Number(form.sort_order) || 0,
      });
      toast.success("Addon link created");
      closeForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this addon link?")) return;
    setDeletingId(id);
    try {
      await deleteProductAddon(id);
      toast.success("Addon link removed");
      setAddons((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const productName = (id) => products.find((p) => p.id === id)?.name || `Product #${id}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Product Addons</h1>
        {!showForm && (
          <button
            type="button"
            onClick={openForm}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Link Addon
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-neutral-900">New Addon Link</h2>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Parent Product
              </label>
              <select
                name="parent_product"
                value={form.parent_product}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Addon Product
              </label>
              <select
                name="addon_product"
                value={form.addon_product}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Min Select</label>
              <input
                type="number"
                name="min_select"
                min={0}
                value={form.min_select}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Max Select</label>
              <input
                type="number"
                name="max_select"
                min={1}
                value={form.max_select}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Price Override <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="price_override"
                value={form.price_override}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="is_required"
              checked={form.is_required}
              onChange={handleChange}
              className="h-4 w-4 rounded border-neutral-300 accent-(--primary)"
            />
            Required addon
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Link"}
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
        <p className="text-sm text-neutral-500">Loading addon links...</p>
      ) : addons.length === 0 ? (
        <p className="text-sm text-neutral-500">No addon links yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Parent Product</th>
                <th className="px-5 py-3 font-medium">Addon Product</th>
                <th className="px-5 py-3 font-medium">Required</th>
                <th className="px-5 py-3 font-medium">Min / Max</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((addon) => (
                <tr key={addon.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900">
                    {productName(addon.parent_product)}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">
                    {addon.addon_product_detail?.name || productName(addon.addon_product)}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{addon.is_required ? "Yes" : "No"}</td>
                  <td className="px-5 py-3 text-neutral-600">
                    {addon.min_select} / {addon.max_select}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(addon.id)}
                      disabled={deletingId === addon.id}
                      className="inline-flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      <FiTrash2 size={14} />
                      {deletingId === addon.id ? "Removing..." : "Remove"}
                    </button>
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
