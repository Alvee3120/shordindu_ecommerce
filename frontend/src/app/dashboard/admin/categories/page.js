"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2, FiImage } from "react-icons/fi";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/categories";

const EMPTY_FORM = { name: "", parent: "", description: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data.results ?? data);
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
    setImageFile(null);
    setImagePreview(null);
    setFieldErrors({});
    setFormError("");
    setEditingId("new");
  };

  const openEditForm = (cat) => {
    setForm({ name: cat.name, parent: cat.parent ?? "", description: cat.description ?? "" });
    setImageFile(null);
    setImagePreview(cat.image || null);
    setFieldErrors({});
    setFormError("");
    setEditingId(cat.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (editingId === "new") {
        await createCategory({ ...form, image: imageFile });
        toast.success("Category created");
      } else {
        await updateCategory(editingId, { ...form, image: imageFile });
        toast.success("Category updated");
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
    if (!confirm("Delete this category?")) return;
    setDeletingId(id);
    try {
      await deleteCategory(id);
      toast.success("Category deleted");
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Categories</h1>
        {editingId === null && (
          <button
            type="button"
            onClick={openNewForm}
            className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
          >
            <FiPlus size={16} />
            Add Category
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
            {editingId === "new" ? "New Category" : "Edit Category"}
          </h2>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

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
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Parent Category <span className="text-neutral-400">(optional)</span>
            </label>
            <select
              name="parent"
              value={form.parent}
              onChange={handleChange}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            >
              <option value="">None</option>
              {categories
                .filter((c) => c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Description <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Image <span className="text-neutral-400">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FiImage size={20} className="text-neutral-300" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="flex-1 text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
              />
            </div>
            {fieldErrors.image && <p className="mt-1 text-xs text-red-600">{fieldErrors.image[0]}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Category"}
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
        <p className="text-sm text-neutral-500">Loading categories...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-neutral-500">No categories yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Image</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Parent</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                      {cat.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FiImage size={16} className="text-neutral-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-neutral-900">{cat.name}</td>
                  <td className="px-5 py-3 text-neutral-500">
                    {categories.find((c) => c.id === cat.parent)?.name || "—"}
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{cat.slug}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(cat)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        disabled={deletingId === cat.id}
                        className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <FiTrash2 size={14} />
                        {deletingId === cat.id ? "Deleting..." : "Delete"}
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
