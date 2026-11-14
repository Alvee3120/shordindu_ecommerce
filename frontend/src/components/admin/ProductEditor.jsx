"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiPlus, FiTrash2, FiStar, FiUpload, FiSave } from "react-icons/fi";
import {
  getProduct,
  createProduct,
  updateProduct,
  createProductVariation,
  updateProductVariation,
  deleteProductVariation,
  addProductAttributeValue,
  removeProductAttributeValue,
  createProductImage,
  deleteProductImage,
  listProducts,
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
  categories: [],
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

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)";

/**
 * Full create/edit product form. `productId` null means "creating a new
 * product"; once created, `onCreated` receives the new product so the caller
 * can transition to editing it (images/variations/addons all require an id).
 */
export default function ProductEditor({ productId, onCreated, onSaved }) {
  const isNew = productId == null;

  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedValues, setSelectedValues] = useState({});
  const [variations, setVariations] = useState([EMPTY_VARIATION_ROW()]);
  const [deletingVariationKey, setDeletingVariationKey] = useState(null);

  const [productImages, setProductImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const [productAddons, setProductAddons] = useState([]);
  const [pendingAddons, setPendingAddons] = useState([]); // [{key, addon_product, is_required, min_select, max_select, price_override}] for "new" products
  const [addonForm, setAddonForm] = useState(EMPTY_ADDON_FORM);
  const [savingAddon, setSavingAddon] = useState(false);
  const [deletingAddonId, setDeletingAddonId] = useState(null);

  const loadEditorFor = async (id) => {
    const full = await getProduct(id);
    setForm({
      name: full.name,
      categories: full.categories || [],
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [categoryData, attributeData, allProductData] = await Promise.all([
          getCategories(),
          listAttributes(),
          listProducts({ page_size: 100 }),
        ]);
        if (cancelled) return;
        setCategories(categoryData.results ?? categoryData);
        setAttributes(attributeData);
        setAllProducts(allProductData.results ?? []);

        if (!isNew) {
          await loadEditorFor(productId);
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    if (name === "product_type" && value === "simple") {
      setVariations((prev) => (prev.length > 1 ? [prev[0]] : prev));
    }
  };

  const toggleCategory = (categoryId) => {
    setForm((prev) => {
      const has = prev.categories.includes(categoryId);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((id) => id !== categoryId)
          : [...prev.categories, categoryId],
      };
    });
    setFieldErrors((prev) => ({ ...prev, categories: undefined }));
  };

  // ---- Attribute values ----
  const toggleAttributeValue = async (valueId) => {
    const isSelected = selectedValues[valueId] != null;

    if (isNew) {
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
        const link = await addProductAttributeValue({ product: productId, attribute_value: valueId });
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
    if (isNew) return; // new-product rows are sent with the create call
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
        const created = await createProductVariation({ ...payload, product: productId });
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

    if (isNew) {
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
          product: productId,
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

    if (isNew) {
      setPendingAddons((prev) => [
        ...prev,
        {
          key: `pending-${Math.random().toString(36).slice(2)}`,
          addon_product: Number(addonForm.addon_product),
          is_required: addonForm.is_required,
          min_select: Number(addonForm.min_select) || 0,
          max_select: Number(addonForm.max_select) || 1,
          price_override: addonForm.price_override === "" ? null : addonForm.price_override,
        },
      ]);
      setAddonForm(EMPTY_ADDON_FORM);
      return;
    }

    setSavingAddon(true);
    try {
      const link = await createProductAddon({
        parent_product: productId,
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

  const handleRemovePendingAddon = (key) => {
    setPendingAddons((prev) => prev.filter((a) => a.key !== key));
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

    if (form.categories.length === 0) {
      setFormError("Select at least one category.");
      return;
    }

    setSubmitting(true);

    try {
      if (isNew) {
        const created = await createProduct({
          name: form.name,
          categories: form.categories,
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
        if (pendingAddons.length > 0) {
          for (let i = 0; i < pendingAddons.length; i += 1) {
            const addon = pendingAddons[i];
            try {
              await createProductAddon({
                parent_product: created.id,
                addon_product: addon.addon_product,
                is_required: addon.is_required,
                min_select: addon.min_select,
                max_select: addon.max_select,
                price_override: addon.price_override,
                sort_order: i,
              });
            } catch (err) {
              toast.error(`Failed to link an addon: ${err.message}`);
            }
          }
          setPendingAddons([]);
        }
        toast.success("Product created");
        onCreated?.(created);
      } else {
        await updateProduct(productId, {
          name: form.name,
          categories: form.categories,
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
              await createProductVariation({ ...payload, product: productId });
            }
          } catch (err) {
            toast.error(`Failed to save variation "${row.sku}": ${err.message}`);
          }
        }

        toast.success("Product updated");
        onSaved?.();
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

  if (loading) {
    return (
      <p className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading...
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-5"
    >
      {formError && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
      )}

      {/* Basic fields */}
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

      {/* Categories */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">Categories</label>
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-400">No categories defined yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 p-4">
            {categories.map((c) => {
              const checked = form.categories.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    checked
                      ? "border-(--primary) bg-(--primary)/10 text-(--primary)"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        {fieldErrors.categories && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.categories[0]}</p>
        )}
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
          {!isNew && (
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
                        {!isNew && (
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
          {isNew && (
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
          {isNew
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
        {isNew && (
          <p className="mt-1.5 text-xs text-neutral-400">
            Images are uploaded once you create the product.
          </p>
        )}
      </div>

      {/* Addons */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">Product Addons</label>

        {isNew
          ? pendingAddons.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {pendingAddons.map((addon) => (
                  <div
                    key={addon.key}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-neutral-900">
                      {allProducts.find((p) => p.id === addon.addon_product)?.name ||
                        `Product #${addon.addon_product}`}
                    </span>
                    <div className="flex items-center gap-3 text-neutral-500">
                      <span>{addon.is_required ? "Required" : "Optional"}</span>
                      <span>
                        {addon.min_select}/{addon.max_select}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingAddon(addon.key)}
                        aria-label="Remove addon"
                        className="flex items-center justify-center rounded-md p-1 text-red-500 hover:bg-red-50"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          : productAddons.length > 0 && (
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
              .filter((p) => p.id !== productId)
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
