"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiStar, FiUpload, FiSave, FiDownload } from "react-icons/fi";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductVariation,
  updateProductVariation,
  deleteProductVariation,
  addProductAttributeValue,
  removeProductAttributeValue,
  createProductImage,
  deleteProductImage,
  bulkImportProducts,
  downloadImportTemplate,
} from "@/lib/products";
import { getCategories } from "@/lib/categories";
import { listAttributes } from "@/lib/attributes";
import {
  listProductAddons,
  createProductAddon,
  deleteProductAddon,
} from "@/lib/productAddons";

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  product_type: "simple",
  visibility_type: "standalone",
  status: "draft",
  sku_prefix: "",
};

const EMPTY_VARIATION_ROW = () => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  id: null,
  sku: "",
  price: "",
  compare_at_price: "",
  stock_quantity: "0",
  is_active: true,
  attribute_value_ids: [],
  saving: false,
});

const EMPTY_ADDON_FORM = {
  addon_product: "",
  is_required: false,
  min_select: 0,
  max_select: 1,
  price_override: "",
};

const statusColors = {
  draft: "bg-neutral-100 text-neutral-600",
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-red-100 text-red-700",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null); // null | "new" | product id
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // { [attributeValueId]: linkId | "pending" }
  const [selectedValues, setSelectedValues] = useState({});
  const [variations, setVariations] = useState([EMPTY_VARIATION_ROW()]);
  const [deletingVariationKey, setDeletingVariationKey] = useState(null);

  const [productImages, setProductImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]); // [{key, file, preview}] for "new" products
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const [productAddons, setProductAddons] = useState([]);
  const [addonForm, setAddonForm] = useState(EMPTY_ADDON_FORM);
  const [savingAddon, setSavingAddon] = useState(false);
  const [deletingAddonId, setDeletingAddonId] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [productData, categoryData, allProductData, attributeData] = await Promise.all([
        listProducts({ page, search: search || undefined }),
        categories.length ? Promise.resolve({ results: categories }) : getCategories(),
        listProducts({ page_size: 100 }),
        attributes.length ? Promise.resolve(attributes) : listAttributes(),
      ]);
      setProducts(productData.results);
      setCount(productData.count);
      setAllProducts(allProductData.results ?? []);
      if (!categories.length) setCategories(categoryData.results ?? categoryData);
      if (!attributes.length) setAttributes(attributeData);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const resetEditorState = () => {
    setForm(EMPTY_FORM);
    setSelectedValues({});
    setVariations([EMPTY_VARIATION_ROW()]);
    setProductImages([]);
    pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setPendingImages([]);
    setProductAddons([]);
    setAddonForm(EMPTY_ADDON_FORM);
    setFieldErrors({});
    setFormError("");
  };

  const openNewForm = () => {
    resetEditorState();
    setShowImport(false);
    setEditingId("new");
  };

  // ---- Bulk import ----
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadImportTemplate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportFileChange = (e) => {
    setImportFile(e.target.files?.[0] || null);
    setImportResult(null);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Choose an .xlsx file first");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await bulkImportProducts(importFile);
      setImportResult(result);
      setImportFile(null);

      const changed =
        result.created.products +
        result.updated.products +
        result.created.variations +
        result.updated.variations +
        result.created.addons +
        result.updated.addons;
      if (changed > 0) {
        toast.success(
          `${result.created.products} product(s) created, ${result.updated.products} updated`
        );
        setPage(1);
        await load();
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} row(s) had errors - see details below`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const loadEditorFor = async (id) => {
    const full = await getProduct(id);
    setForm({
      name: full.name,
      category: full.category,
      description: full.description || "",
      product_type: full.product_type,
      visibility_type: full.visibility_type,
      status: full.status,
      sku_prefix: full.sku_prefix || "",
    });
    const valueMap = {};
    (full.attribute_values || []).forEach((av) => {
      valueMap[av.attribute_value] = av.id;
    });
    setSelectedValues(valueMap);
    setVariations(
      (full.variations || []).map((v) => ({
        key: `existing-${v.id}`,
        id: v.id,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price ?? "",
        stock_quantity: v.stock_quantity,
        is_active: v.is_active,
        attribute_value_ids: (v.attribute_values || []).map((av) => av.attribute_value),
        saving: false,
      }))
    );
    setProductImages(full.images || []);

    const addonLinks = await listProductAddons();
    setProductAddons(addonLinks.filter((a) => a.parent_product === full.id));
  };

  const openEditForm = async (product) => {
    setFieldErrors({});
    setFormError("");
    setShowImport(false);
    setEditingId(product.id);
    try {
      await loadEditorFor(product.id);
    } catch (err) {
      toast.error(err.message);
      setEditingId(null);
    }
  };

  const closeForm = () => {
    setEditingId(null);
    resetEditorState();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    if (name === "product_type" && value === "simple") {
      setVariations((prev) => (prev.length > 1 ? [prev[0]] : prev));
    }
  };

  // ---- Attribute values ----
  const toggleAttributeValue = async (valueId) => {
    const isSelected = selectedValues[valueId] != null;

    if (editingId === "new") {
      setSelectedValues((prev) => {
        const next = { ...prev };
        if (isSelected) delete next[valueId];
        else next[valueId] = "pending";
        return next;
      });
      return;
    }

    if (isSelected) {
      const linkId = selectedValues[valueId];
      try {
        await removeProductAttributeValue(linkId);
        setSelectedValues((prev) => {
          const next = { ...prev };
          delete next[valueId];
          return next;
        });
      } catch (err) {
        toast.error(err.message);
      }
    } else {
      try {
        const link = await addProductAttributeValue({ product: editingId, attribute_value: valueId });
        setSelectedValues((prev) => ({ ...prev, [valueId]: link.id }));
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  // ---- Variations ----
  const handleVariationChange = (key, field, value) => {
    setVariations((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  };

  const addVariationRow = () => {
    setVariations((prev) => [...prev, EMPTY_VARIATION_ROW()]);
  };

  const toggleVariationAttributeValue = (key, valueId) => {
    setVariations((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const has = row.attribute_value_ids.includes(valueId);
        return {
          ...row,
          attribute_value_ids: has
            ? row.attribute_value_ids.filter((id) => id !== valueId)
            : [...row.attribute_value_ids, valueId],
        };
      })
    );
  };

  const saveVariationRow = async (row) => {
    if (editingId === "new") return; // new-product rows are sent with the create call
    if (!row.sku) {
      toast.error("SKU is required");
      return;
    }
    setVariations((prev) => prev.map((r) => (r.key === row.key ? { ...r, saving: true } : r)));
    try {
      const payload = {
        sku: row.sku,
        price: row.price || 0,
        compare_at_price: row.compare_at_price === "" ? null : row.compare_at_price,
        stock_quantity: row.stock_quantity || 0,
        is_active: row.is_active,
        attribute_value_ids: row.attribute_value_ids,
      };
      if (row.id) {
        await updateProductVariation(row.id, payload);
      } else {
        const created = await createProductVariation({ ...payload, product: editingId });
        setVariations((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, id: created.id } : r))
        );
      }
      toast.success("Variation saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVariations((prev) => prev.map((r) => (r.key === row.key ? { ...r, saving: false } : r)));
    }
  };

  const deleteVariationRow = async (row) => {
    if (row.id) {
      if (!confirm("Delete this variation?")) return;
      setDeletingVariationKey(row.key);
      try {
        await deleteProductVariation(row.id);
        setVariations((prev) => prev.filter((r) => r.key !== row.key));
      } catch (err) {
        toast.error(err.message);
      } finally {
        setDeletingVariationKey(null);
      }
    } else {
      setVariations((prev) => prev.filter((r) => r.key !== row.key));
    }
  };

  // ---- Images ----
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    if (editingId === "new") {
      setPendingImages((prev) => [
        ...prev,
        ...files.map((file) => ({
          key: `pending-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(file),
        })),
      ]);
      return;
    }

    setUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const image = await createProductImage({
          product: editingId,
          image: files[i],
          is_primary: productImages.length === 0 && i === 0,
        });
        setProductImages((prev) => [...prev, image]);
      }
      toast.success(files.length > 1 ? "Images uploaded" : "Image uploaded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePendingImage = (key) => {
    setPendingImages((prev) => {
      const target = prev.find((img) => img.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((img) => img.key !== key);
    });
  };

  const handleDeleteImage = async (id) => {
    setDeletingImageId(id);
    try {
      await deleteProductImage(id);
      setProductImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Image removed");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingImageId(null);
    }
  };

  // ---- Addons ----
  const handleAddonFormChange = (e) => {
    const { name, type, checked, value } = e.target;
    setAddonForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleAddAddon = async (e) => {
    e.preventDefault();
    if (!addonForm.addon_product) {
      toast.error("Select an addon product");
      return;
    }
    setSavingAddon(true);
    try {
      const link = await createProductAddon({
        parent_product: editingId,
        addon_product: Number(addonForm.addon_product),
        is_required: addonForm.is_required,
        min_select: Number(addonForm.min_select) || 0,
        max_select: Number(addonForm.max_select) || 1,
        price_override: addonForm.price_override === "" ? null : addonForm.price_override,
        sort_order: productAddons.length,
      });
      setProductAddons((prev) => [...prev, link]);
      setAddonForm(EMPTY_ADDON_FORM);
      toast.success("Addon linked");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAddon(false);
    }
  };

  const handleDeleteAddon = async (id) => {
    setDeletingAddonId(id);
    try {
      await deleteProductAddon(id);
      setProductAddons((prev) => prev.filter((a) => a.id !== id));
      toast.success("Addon removed");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingAddonId(null);
    }
  };

  // ---- Product form submit ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    if (form.product_type === "simple" && !variations[0]?.sku) {
      setFormError("SKU is required to save price & stock.");
      return;
    }

    setSubmitting(true);

    try {
      if (editingId === "new") {
        const created = await createProduct({
          name: form.name,
          category: Number(form.category),
          description: form.description,
          product_type: form.product_type,
          visibility_type: form.visibility_type,
          status: form.status,
          sku_prefix: form.sku_prefix,
          attribute_value_ids: Object.keys(selectedValues).map(Number),
          variations: variations
            .filter((v) => v.sku)
            .map((v) => ({
              sku: v.sku,
              price: v.price || 0,
              compare_at_price: v.compare_at_price === "" ? null : v.compare_at_price,
              stock_quantity: v.stock_quantity || 0,
              is_active: v.is_active,
              attribute_value_ids: v.attribute_value_ids,
            })),
        });
        if (pendingImages.length > 0) {
          for (let i = 0; i < pendingImages.length; i += 1) {
            const img = pendingImages[i];
            try {
              await createProductImage({
                product: created.id,
                image: img.file,
                is_primary: i === 0,
              });
            } catch (err) {
              toast.error(`Failed to upload an image: ${err.message}`);
            }
            URL.revokeObjectURL(img.preview);
          }
          setPendingImages([]);
        }
        toast.success("Product created");
        setEditingId(created.id);
        await loadEditorFor(created.id);
        await load();
      } else {
        await updateProduct(editingId, {
          name: form.name,
          category: Number(form.category),
          description: form.description,
          product_type: form.product_type,
          visibility_type: form.visibility_type,
          status: form.status,
          sku_prefix: form.sku_prefix,
        });

        const rowsToSave = variations.filter((v) => v.sku);
        for (const row of rowsToSave) {
          const payload = {
            sku: row.sku,
            price: row.price || 0,
            compare_at_price: row.compare_at_price === "" ? null : row.compare_at_price,
            stock_quantity: row.stock_quantity || 0,
            is_active: row.is_active,
            attribute_value_ids: row.attribute_value_ids,
          };
          try {
            if (row.id) {
              await updateProductVariation(row.id, payload);
            } else {
              await createProductVariation({ ...payload, product: editingId });
            }
          } catch (err) {
            toast.error(`Failed to save variation "${row.sku}": ${err.message}`);
          }
        }

        toast.success("Product updated");
        closeForm();
        await load();
      }
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
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    try {
      await deleteProduct(id);
      toast.success("Product deleted");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const inputClass =
    "w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Products</h1>
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2">
              <FiSearch size={14} className="text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products"
                className="w-40 bg-transparent text-sm outline-none"
              />
            </div>
          </form>
          {editingId === null && (
            <>
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <FiUpload size={16} />
                Import from Excel
              </button>
              <button
                type="button"
                onClick={openNewForm}
                className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90"
              >
                <FiPlus size={16} />
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {showImport && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Import Products from Excel</h2>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportResult(null);
                setImportFile(null);
              }}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-neutral-500">
            Download the template, fill in your products, variations, and addon links, then upload it
            here. Re-uploading the same file updates existing products matched by SKU instead of
            duplicating them. Images are still added per-product below after import.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <FiDownload size={14} />
              {downloadingTemplate ? "Preparing..." : "Download template"}
            </button>
            <form onSubmit={handleImportSubmit} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImportFileChange}
                className="text-sm text-neutral-600"
              />
              <button
                type="submit"
                disabled={importing || !importFile}
                className="flex items-center gap-1.5 rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiUpload size={14} />
                {importing ? "Importing..." : "Import"}
              </button>
            </form>
          </div>

          {importResult && (
            <div className="rounded-lg border border-neutral-200 p-4 text-sm">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-neutral-700">
                <span>
                  Products: {importResult.created.products} created, {importResult.updated.products}{" "}
                  updated
                </span>
                <span>
                  Variations: {importResult.created.variations} created,{" "}
                  {importResult.updated.variations} updated
                </span>
                <span>
                  Addons: {importResult.created.addons} created, {importResult.updated.addons} updated
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-red-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-red-200 bg-red-50 text-red-700">
                        <th className="px-3 py-2 font-medium">Sheet</th>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, idx) => (
                        <tr key={idx} className="border-b border-red-100 last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap">{err.sheet}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{err.row}</td>
                          <td className="px-3 py-2 text-red-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mb-6 flex flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-neutral-900">
            {editingId === "new" ? "New Product" : "Edit Product"}
          </h2>

          {formError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
          )}

          {/* Basic fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className={inputClass}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.category[0]}</p>
              )}
            </div>
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
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Product Type</label>
              <select
                name="product_type"
                value={form.product_type}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="simple">Simple</option>
                <option value="variable">Variable</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Visibility Type</label>
              <select
                name="visibility_type"
                value={form.visibility_type}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="standalone">Standalone</option>
                <option value="addon_only">Addon only</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                SKU Prefix <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="text"
                name="sku_prefix"
                value={form.sku_prefix}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Attribute values */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Product Attribute Values
            </label>
            {attributes.length === 0 ? (
              <p className="text-sm text-neutral-400">No attributes defined yet.</p>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
                {attributes.map((attr) => (
                  <div key={attr.id}>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                      {attr.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.length === 0 && (
                        <span className="text-xs text-neutral-400">No values</span>
                      )}
                      {attr.values.map((v) => {
                        const checked = selectedValues[v.id] != null;
                        return (
                          <button
                            type="button"
                            key={v.id}
                            onClick={() => toggleAttributeValue(v.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              checked
                                ? "border-(--primary) bg-(--primary)/10 text-(--primary)"
                                : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                            }`}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Simple product pricing */}
          {form.product_type === "simple" && variations[0] && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Price &amp; Stock</label>
              <div className="grid gap-4 rounded-lg border border-neutral-200 p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">SKU</label>
                  <input
                    type="text"
                    value={variations[0].sku}
                    onChange={(e) => handleVariationChange(variations[0].key, "sku", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={variations[0].price}
                    onChange={(e) => handleVariationChange(variations[0].key, "price", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Compare at price <span className="text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={variations[0].compare_at_price}
                    onChange={(e) =>
                      handleVariationChange(variations[0].key, "compare_at_price", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Stock quantity</label>
                  <input
                    type="number"
                    value={variations[0].stock_quantity}
                    onChange={(e) =>
                      handleVariationChange(variations[0].key, "stock_quantity", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              {editingId !== "new" && (
                <button
                  type="button"
                  onClick={() => saveVariationRow(variations[0])}
                  disabled={variations[0].saving}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-(--primary) hover:underline disabled:opacity-50"
                >
                  <FiSave size={12} />
                  {variations[0].saving ? "Saving..." : "Save price & stock"}
                </button>
              )}
            </div>
          )}

          {/* Variations */}
          {form.product_type === "variable" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-neutral-700">Product Variations</label>
                <button
                  type="button"
                  onClick={addVariationRow}
                  className="flex items-center gap-1 text-xs font-medium text-(--primary) hover:underline"
                >
                  <FiPlus size={12} />
                  Add Row
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                      <th className="px-3 py-2 font-medium">Sku</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Compare at price</th>
                      <th className="px-3 py-2 font-medium">Stock quantity</th>
                      <th className="px-3 py-2 font-medium">Attributes</th>
                      <th className="px-3 py-2 font-medium">Is active</th>
                      <th className="px-3 py-2 font-medium text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variations.map((row) => (
                      <tr key={row.key} className="border-b border-neutral-100 last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) => handleVariationChange(row.key, "sku", e.target.value)}
                            className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.price}
                            onChange={(e) => handleVariationChange(row.key, "price", e.target.value)}
                            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.compare_at_price}
                            onChange={(e) =>
                              handleVariationChange(row.key, "compare_at_price", e.target.value)
                            }
                            className="w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={row.stock_quantity}
                            onChange={(e) =>
                              handleVariationChange(row.key, "stock_quantity", e.target.value)
                            }
                            className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {attributes.length === 0 ? (
                            <span className="text-xs text-neutral-400">No attributes</span>
                          ) : (
                            <div className="flex max-w-56 flex-col gap-1.5">
                              {attributes.map((attr) => (
                                <div key={attr.id} className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                                    {attr.name}:
                                  </span>
                                  {attr.values.map((v) => {
                                    const checked = row.attribute_value_ids.includes(v.id);
                                    return (
                                      <button
                                        type="button"
                                        key={v.id}
                                        onClick={() => toggleVariationAttributeValue(row.key, v.id)}
                                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                          checked
                                            ? "border-(--primary) bg-(--primary)/10 text-(--primary)"
                                            : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                                        }`}
                                      >
                                        {v.value}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) =>
                              handleVariationChange(row.key, "is_active", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-neutral-300 accent-(--primary)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            {editingId !== "new" && (
                              <button
                                type="button"
                                onClick={() => saveVariationRow(row)}
                                disabled={row.saving}
                                aria-label="Save variation"
                                className="flex items-center justify-center rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-(--primary) disabled:opacity-50"
                              >
                                <FiSave size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteVariationRow(row)}
                              disabled={deletingVariationKey === row.key}
                              aria-label="Delete variation"
                              className="flex items-center justify-center rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editingId === "new" && (
                <p className="mt-1.5 text-xs text-neutral-400">
                  Variations are saved together when you create the product.
                </p>
              )}
            </div>
          )}

          {/* Images */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Product Images</label>
            <div className="flex flex-wrap gap-3">
              {editingId === "new"
                ? pendingImages.map((img, idx) => (
                    <div
                      key={img.key}
                      className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt="" className="h-full w-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-(--primary)">
                          <FiStar size={10} />
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePendingImage(img.key)}
                        aria-label="Remove image"
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                      >
                        <FiTrash2 size={11} />
                      </button>
                    </div>
                  ))
                : productImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image} alt={img.alt_text || ""} className="h-full w-full object-cover" />
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-(--primary)">
                          <FiStar size={10} />
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        disabled={deletingImageId === img.id}
                        aria-label="Remove image"
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        <FiTrash2 size={11} />
                      </button>
                    </div>
                  ))}

              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-400 hover:border-(--primary) hover:text-(--primary)">
                <FiUpload size={16} />
                <span className="text-[10px] font-medium">
                  {uploadingImage ? "Uploading..." : "Add"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>
            {editingId === "new" && (
              <p className="mt-1.5 text-xs text-neutral-400">
                Images are uploaded once you create the product.
              </p>
            )}
          </div>

          {/* Addons */}
          {editingId !== "new" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Product Addons</label>

              {productAddons.length > 0 && (
                <div className="mb-3 flex flex-col gap-2">
                  {productAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-neutral-900">
                        {addon.addon_product_detail?.name ||
                          allProducts.find((p) => p.id === addon.addon_product)?.name ||
                          `Product #${addon.addon_product}`}
                      </span>
                      <div className="flex items-center gap-3 text-neutral-500">
                        <span>{addon.is_required ? "Required" : "Optional"}</span>
                        <span>
                          {addon.min_select}/{addon.max_select}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddon(addon.id)}
                          disabled={deletingAddonId === addon.id}
                          aria-label="Remove addon"
                          className="flex items-center justify-center rounded-md p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
                <select
                  name="addon_product"
                  value={addonForm.addon_product}
                  onChange={handleAddonFormChange}
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="">Select addon product</option>
                  {allProducts
                    .filter((p) => p.id !== editingId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  name="min_select"
                  placeholder="Min"
                  value={addonForm.min_select}
                  onChange={handleAddonFormChange}
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                />
                <input
                  type="number"
                  name="max_select"
                  placeholder="Max"
                  value={addonForm.max_select}
                  onChange={handleAddonFormChange}
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                />
                <input
                  type="number"
                  step="0.01"
                  name="price_override"
                  placeholder="Price override"
                  value={addonForm.price_override}
                  onChange={handleAddonFormChange}
                  className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
                />
                <label className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <input
                    type="checkbox"
                    name="is_required"
                    checked={addonForm.is_required}
                    onChange={handleAddonFormChange}
                    className="h-4 w-4 rounded border-neutral-300 accent-(--primary)"
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={handleAddAddon}
                  disabled={savingAddon}
                  className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  <FiPlus size={14} />
                  Link
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : editingId === "new" ? "Create Product" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              {editingId === "new" ? "Cancel" : "Done"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading products...
        </p>
      ) : products.length === 0 ? (
        <p className="text-sm text-neutral-500">No products found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Rating</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-900">{product.name}</td>
                  <td className="px-5 py-3 text-neutral-500">{product.category_name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        statusColors[product.status] || "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">
                    {product.average_rating ? `${product.average_rating} ★` : "—"} (
                    {product.review_count})
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="flex items-center gap-1.5 font-medium text-neutral-600 hover:text-(--primary)"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                        className="flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <FiTrash2 size={14} />
                        {deletingId === product.id ? "Deleting..." : "Delete"}
                      </button>
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
    </div>
  );
}
