"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { toast } from "sonner";
import { deleteAttributeValue } from "@/lib/attributes";
import {
  createProductColor,
  deleteProductColor,
  listColorLibrary,
  listProductColors,
  updateProductColor,
} from "@/lib/products";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--primary) ${
    error ? "border-red-400" : "border-neutral-300"
  }`;

function emptyRow(sortOrder) {
  return {
    key: `color-${Math.random().toString(36).slice(2)}`,
    id: null,
    name: "",
    hex_code: "#000000",
    is_active: true,
    sort_order: sortOrder,
    image: null,
    preview: null,
    image_url: null,
    removeImage: false,
    errors: {},
  };
}

function rowFromSaved(color) {
  return {
    key: `saved-${color.id}`,
    id: color.id,
    name: color.name,
    hex_code: color.hex_code,
    is_active: color.is_active,
    sort_order: color.sort_order,
    image: null,
    preview: null,
    image_url: color.image_url,
    removeImage: false,
    errors: {},
  };
}

/**
 * Product Colors editor.
 *
 * `productId` present -> colors are saved straight to the product. Without it
 * the section runs in draft mode and reports rows up through `onDraftChange`
 * so a brand new product can collect colors before it has an id.
 */
export default function ProductColorsSection({
  productId,
  draftRows,
  onDraftChange,
  onAttributesChanged,
}) {
  const isDraft = !productId;
  const [savedRows, setSavedRows] = useState([]);
  const [loading, setLoading] = useState(!isDraft);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [savingKey, setSavingKey] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const objectUrls = useRef(new Set());

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [deletingLibraryId, setDeletingLibraryId] = useState(null);

  const rows = isDraft ? draftRows || [] : savedRows;
  const setRows = (updater) => {
    if (isDraft) onDraftChange?.(updater);
    else setSavedRows(updater);
  };

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (isDraft) return undefined;
    let cancelled = false;
    listProductColors({ product: productId })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setSavedRows(results.map(rowFromSaved));
        setLoadError("");
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, isDraft, reloadKey]);

  useEffect(() => {
    if (!libraryOpen) return undefined;
    let cancelled = false;
    listColorLibrary({ search: librarySearch.trim() || undefined })
      .then((data) => {
        if (!cancelled) setLibrary(Array.isArray(data) ? data : data?.results ?? []);
      })
      .catch(() => !cancelled && setLibrary([]))
      .finally(() => !cancelled && setLibraryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [libraryOpen, librarySearch]);

  const toggleLibrary = () => {
    if (!libraryOpen) setLibraryLoading(true);
    setLibraryOpen(!libraryOpen);
  };

  const reloadLibrary = () => {
    setLibraryLoading(true);
    listColorLibrary({ search: librarySearch.trim() || undefined })
      .then((data) => setLibrary(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  };

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: value,
              errors: { ...row.errors, [field]: undefined },
            }
          : row
      )
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length)]);
  };

  const pickImage = (key, file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Images must be 5 MB or smaller.");
      return;
    }
    const preview = URL.createObjectURL(file);
    objectUrls.current.add(preview);
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, image: file, preview, removeImage: false } : row
      )
    );
  };

  const removeImage = (key) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              image: null,
              preview: null,
              removeImage: Boolean(row.id && row.image_url),
            }
          : row
      )
    );
  };

  const validateRow = (row) => {
    const errors = {};
    if (!row.name.trim()) errors.name = "Color name is required.";
    if (!HEX_RE.test(row.hex_code)) errors.hex_code = "Use a hex colour like #000000.";
    return errors;
  };

  const saveRow = async (row) => {
    const errors = validateRow(row);
    if (Object.keys(errors).length > 0) {
      setRows((prev) =>
        prev.map((item) => (item.key === row.key ? { ...item, errors } : item))
      );
      return;
    }

    if (isDraft) return;

    setSavingKey(row.key);
    try {
      const payload = {
        name: row.name.trim(),
        hex_code: row.hex_code,
        image: row.image,
        remove_image: row.removeImage,
        is_active: row.is_active,
        sort_order: row.sort_order,
      };
      const saved = row.id
        ? await updateProductColor(row.id, payload)
        : await createProductColor({ product: productId, ...payload });
      setSavedRows((prev) =>
        prev.map((item) => (item.key === row.key ? rowFromSaved(saved) : item))
      );
      toast.success(row.id ? "Color updated." : "Color added.");
      onAttributesChanged?.();
      reloadLibrary();
    } catch (err) {
      if (err.status === 400 && err.data && typeof err.data === "object") {
        const flat = {};
        Object.entries(err.data).forEach(([key, value]) => {
          flat[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setRows((prev) =>
          prev.map((item) =>
            item.key === row.key ? { ...item, errors: flat } : item
          )
        );
      }
      toast.error(err.message || "Could not save the color.");
    } finally {
      setSavingKey(null);
    }
  };

  const removeRow = async (row) => {
    if (row.id && !isDraft) {
      if (!confirm(`Remove the color “${row.name}” from this product?`)) return;
      setDeletingId(row.id);
      try {
        await deleteProductColor(row.id);
        toast.success("Color removed.");
        onAttributesChanged?.();
        reloadLibrary();
      } catch (err) {
        toast.error(err.message);
        setDeletingId(null);
        return;
      }
      setDeletingId(null);
    }
    setRows((prev) => prev.filter((item) => item.key !== row.key));
  };

  const moveRow = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((row, position) => ({ ...row, sort_order: position }));
    setRows(ordered);

    if (isDraft) return;

    try {
      for (const row of ordered) {
        if (row.id) {
          await updateProductColor(row.id, { sort_order: row.sort_order });
        }
      }
    } catch (err) {
      toast.error(err.message || "Could not save the new order.");
    }
  };

  const assignLibraryColor = async (color) => {
    const alreadyAssigned = rows.some(
      (row) => row.name.trim().toLowerCase() === color.name.trim().toLowerCase()
    );
    if (alreadyAssigned) {
      toast.error("This color is already assigned to the product.");
      return;
    }

    if (isDraft) {
      setRows((prev) => [
        ...prev,
        { ...emptyRow(prev.length), name: color.name, hex_code: color.hex_code },
      ]);
      return;
    }

    setAssigningId(color.id);
    try {
      const saved = await createProductColor({
        product: productId,
        name: color.name,
        hex_code: color.hex_code,
        is_active: true,
        sort_order: rows.length,
      });
      setSavedRows((prev) => [...prev, rowFromSaved(saved)]);
      toast.success("Color assigned.");
      onAttributesChanged?.();
      reloadLibrary();
    } catch (err) {
      toast.error(err.message || "Could not assign the color.");
    } finally {
      setAssigningId(null);
    }
  };

  const deleteLibraryColor = async (color) => {
    if (color.usage_count > 0) return;
    if (!confirm(`Delete “${color.name}” from the color library?`)) return;
    setDeletingLibraryId(color.id);
    try {
      await deleteAttributeValue(color.id);
      toast.success("Color deleted from the library.");
      setLibrary((prev) => prev.filter((item) => item.id !== color.id));
      onAttributesChanged?.();
    } catch (err) {
      toast.error(err.message || "Could not delete the color.");
    } finally {
      setDeletingLibraryId(null);
    }
  };

  if (!isDraft && loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-neutral-200" />
        <div className="h-16 rounded bg-neutral-100" />
      </div>
    );
  }

  if (!isDraft && loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReloadKey((value) => value + 1);
          }}
          className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Product Colors</h3>
          <p className="text-xs text-neutral-500">
            Colors come from the shared color library, so the same color can be reused
            across products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLibrary}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <FiSearch size={14} /> Saved Colors
          </button>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <FiPlus size={14} /> Add Color
          </button>
        </div>
      </div>

      {libraryOpen && (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FiSearch
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={librarySearch}
                onChange={(event) => {
                  setLibraryLoading(true);
                  setLibrarySearch(event.target.value);
                }}
                placeholder="Search saved colors..."
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pr-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
              />
            </div>
            <button
              type="button"
              onClick={() => setLibraryOpen(false)}
              aria-label="Close saved colors"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            >
              <FiX size={16} />
            </button>
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto">
            {libraryLoading ? (
              <p className="px-1 py-3 text-xs text-neutral-500">Loading colors...</p>
            ) : library.length === 0 ? (
              <p className="px-1 py-3 text-xs text-neutral-500">
                No saved colors yet. Use “Add Color” to create one.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-200">
                {library.map((color) => {
                  const assigned = rows.some(
                    (row) => row.name.trim().toLowerCase() === color.name.trim().toLowerCase()
                  );
                  return (
                    <li key={color.id} className="flex items-center gap-2.5 py-2">
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-neutral-300"
                        style={{ backgroundColor: color.hex_code }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                        {color.name}
                      </span>
                      <span className="text-[11px] whitespace-nowrap text-neutral-400">
                        {color.usage_count} product{color.usage_count === 1 ? "" : "s"}
                      </span>
                      {color.usage_count === 0 && (
                        <button
                          type="button"
                          onClick={() => deleteLibraryColor(color)}
                          disabled={deletingLibraryId === color.id}
                          aria-label={`Delete ${color.name} from the library`}
                          className="rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => assignLibraryColor(color)}
                        disabled={assigned || assigningId === color.id}
                        className="rounded-lg bg-(--primary) px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {assigned ? "Added" : assigningId === color.id ? "Adding..." : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
          No colors yet. Add a color to make swatches available on the product card.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const src = row.preview || (row.removeImage ? null : row.image_url);
            return (
              <div key={row.key} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-neutral-500">
                      Color name
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(event) => updateRow(row.key, "name", event.target.value)}
                      placeholder="Black"
                      className={inputClass(row.errors.name)}
                    />
                    {row.errors.name && (
                      <p className="mt-1 text-xs text-red-600">{row.errors.name}</p>
                    )}
                  </div>

                  <div className="min-w-[170px]">
                    <label className="mb-1 block text-xs font-medium text-neutral-500">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={HEX_RE.test(row.hex_code) ? row.hex_code : "#000000"}
                        onChange={(event) =>
                          updateRow(row.key, "hex_code", event.target.value.toUpperCase())
                        }
                        aria-label={`${row.name || "Color"} picker`}
                        className="h-10 w-12 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-1"
                      />
                      <input
                        type="text"
                        value={row.hex_code}
                        onChange={(event) => updateRow(row.key, "hex_code", event.target.value)}
                        className={inputClass(row.errors.hex_code)}
                      />
                    </div>
                    {row.errors.hex_code && (
                      <p className="mt-1 text-xs text-red-600">{row.errors.hex_code}</p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 pb-2 text-xs font-medium text-neutral-600">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(event) =>
                        updateRow(row.key, "is_active", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-neutral-300 accent-(--primary)"
                    />
                    Active
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-neutral-400">No image</span>
                    )}
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                    <FiUpload size={13} />
                    {src ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) pickImage(row.key, file);
                      }}
                    />
                  </label>
                  {src && (
                    <button
                      type="button"
                      onClick={() => removeImage(row.key)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <FiTrash2 size={13} /> Remove
                    </button>
                  )}

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      aria-label="Move color up"
                      className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <FiChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label="Move color down"
                      className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <FiChevronDown size={16} />
                    </button>
                    {!isDraft && (
                      <button
                        type="button"
                        onClick={() => saveRow(row)}
                        disabled={savingKey === row.key}
                        className="rounded-lg bg-(--primary) px-3 py-1.5 text-xs font-semibold text-white hover:bg-(--primary)/90 disabled:opacity-50"
                      >
                        {savingKey === row.key ? "Saving..." : row.id ? "Save" : "Add"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      disabled={row.id != null && deletingId === row.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {row.id != null && deletingId === row.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
